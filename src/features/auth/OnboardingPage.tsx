import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, ErrorText, TextField } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { ownProfileKey, useAuth } from './auth'
import { clearInviteCode, readInviteCode } from './invite'

const SIGNUP_ERRORS = ['invalid_invite', 'too_young', 'username_taken', 'invalid_username', 'terms_not_accepted'] as const
type SignupError = (typeof SIGNUP_ERRORS)[number]

export function signupErrorFrom(message: string): SignupError | 'unknown' {
  return SIGNUP_ERRORS.find((code) => message.includes(code)) ?? 'unknown'
}

export const toUsername = (value: string) => value.toLowerCase().replace(/[^a-z0-9_.]/g, '')

function TooYoungScreen() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const leave = async () => {
    // Removes the login that Google just created, so that no data stays behind.
    await getSupabase().rpc('delete_own_account')
    await signOut()
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 text-center">
      <h1 className="font-display text-4xl uppercase">{t('onboarding.tooYoungTitle')}</h1>
      <p className="mt-4 text-text-secondary">{t('onboarding.tooYoungBody')}</p>
      <Button className="mt-8" onClick={() => void leave()}>{t('common.ok')}</Button>
    </main>
  )
}

export function OnboardingPage() {
  const { t, i18n } = useTranslation()
  const { session, signOut } = useAuth()
  const queryClient = useQueryClient()
  const googleName = session?.user.user_metadata.full_name as string | undefined

  const [inviteCode, setInviteCode] = useState(() => readInviteCode() ?? '')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState(googleName ?? '')
  const [birthYear, setBirthYear] = useState('')
  const [accepted, setAccepted] = useState(false)

  const signup = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().rpc('complete_signup', {
        invite_code: inviteCode.trim(),
        username,
        display_name: displayName.trim(),
        birth_year: Number(birthYear),
        language: i18n.resolvedLanguage ?? 'en',
        accepted_terms: accepted,
      })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      clearInviteCode()
      await queryClient.invalidateQueries({ queryKey: ownProfileKey(session?.user.id) })
    },
  })

  const error = signup.error ? signupErrorFrom(signup.error.message) : null
  if (error === 'too_young') return <TooYoungScreen />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    signup.mutate()
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-10">
      <h1 className="font-display text-4xl uppercase">{t('onboarding.title')}</h1>
      <p className="mt-2 text-text-secondary">{t('onboarding.intro')}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <TextField label={t('onboarding.inviteCode')} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required autoComplete="off" />
        <TextField
          label={t('onboarding.username')}
          hint={t('onboarding.usernameHint')}
          value={username}
          onChange={(e) => setUsername(toUsername(e.target.value))}
          required
          minLength={3}
          maxLength={30}
          autoCapitalize="none"
          autoComplete="off"
        />
        <TextField label={t('onboarding.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={60} />
        <TextField
          label={t('onboarding.birthYear')}
          hint={t('onboarding.birthYearHint')}
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          required
          inputMode="numeric"
          pattern="[0-9]{4}"
        />

        <label className="flex min-h-touch items-start gap-3 py-2 text-sm">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required className="mt-0.5 size-5 shrink-0 accent-red" />
          <span>
            <Trans
              i18nKey="onboarding.accept"
              components={{
                terms: <Link to="/legal/terms" className="underline" />,
                privacy: <Link to="/legal/privacy" className="underline" />,
              }}
            />
          </span>
        </label>

        {error && <ErrorText>{t(`onboarding.errors.${error}`)}</ErrorText>}

        <Button type="submit" variant="own" className="w-full" disabled={signup.isPending}>
          {t('onboarding.submit')}
        </Button>
      </form>

      <Button className="mt-3 w-full" onClick={() => void signOut()}>{t('onboarding.otherAccount')}</Button>
    </main>
  )
}
