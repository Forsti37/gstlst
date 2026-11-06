import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Button, ErrorText, Section, TextField } from '../../app/ui'
import type { Database } from '../../lib/database.types'
import { SUPPORTED_LANGUAGES } from '../../lib/i18n'
import { compressPhoto } from '../../lib/images'
import { getSupabase } from '../../lib/supabase'
import { ownProfileKey, useAuth, useMember, type OwnProfile } from '../auth/auth'
import { clearQueue, MEDIA_BUCKET } from '../offline/queue'
import { UserAvatar } from '../profile/UserAvatar'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
type Level = 'public' | 'friends' | 'private'

const AREAS = ['profile', 'stats', 'checkins', 'photos', 'badges', 'map'] as const
const LEVELS: Level[] = ['public', 'friends', 'private']

function useUpdateProfile() {
  const me = useMember()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: ProfileUpdate) => {
      const { error } = await getSupabase().from('profiles').update(changes).eq('id', me.id)
      if (error) throw error
    },
    onSuccess: (_data, changes) => {
      queryClient.setQueryData<OwnProfile | null>(ownProfileKey(me.id), (old) => (old ? ({ ...old, ...changes } as OwnProfile) : old))
    },
  })
}

function AvatarPicker() {
  const { t } = useTranslation()
  const me = useMember()
  const update = useUpdateProfile()
  const input = useRef<HTMLInputElement>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setFailed(false)
    try {
      const compressed = await compressPhoto(file, 512, 0.3)
      const path = `${me.id}/${crypto.randomUUID()}.webp`
      const storage = getSupabase().storage.from('avatars')
      const { error } = await storage.upload(path, compressed, { contentType: 'image/webp' })
      if (error) throw error
      await update.mutateAsync({ avatar_path: path })
      if (me.avatar_path) await storage.remove([me.avatar_path])
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar path={me.avatar_path} name={me.display_name} size="md" />
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e)} />
      <Button disabled={busy} onClick={() => input.current?.click()}>
        {busy ? t('common.loading') : t('settings.changePhoto')}
      </Button>
      {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}

function ProfileForm() {
  const { t } = useTranslation()
  const me = useMember()
  const update = useUpdateProfile()
  const [displayName, setDisplayName] = useState(me.display_name)
  const [homeCity, setHomeCity] = useState(me.home_city ?? '')

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        update.mutate({ display_name: displayName.trim(), home_city: homeCity.trim() || null })
      }}
    >
      <TextField label={t('onboarding.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={60} />
      <TextField label={t('settings.homeCity')} hint={t('settings.homeCityHint')} value={homeCity} onChange={(e) => setHomeCity(e.target.value)} maxLength={80} />
      <Button type="submit" variant="primary" disabled={update.isPending}>{t('common.save')}</Button>
      {update.isSuccess && <p className="text-sm text-text-secondary">{t('common.saved')}</p>}
      {update.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </form>
  )
}

function LanguagePicker() {
  const { t, i18n } = useTranslation()
  const update = useUpdateProfile()
  return (
    <div className="flex gap-2">
      {SUPPORTED_LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          aria-pressed={i18n.resolvedLanguage === language}
          onClick={() => {
            void i18n.changeLanguage(language)
            update.mutate({ language })
          }}
          className="min-h-touch rounded-lg bg-surface-2 px-4 font-medium text-text-secondary aria-pressed:bg-text-primary aria-pressed:text-bg"
        >
          {t(`language.${language}`)}
        </button>
      ))}
    </div>
  )
}

function PrivacySettings() {
  const { t } = useTranslation()
  const me = useMember()
  const update = useUpdateProfile()
  const privacy = me.privacy as Partial<Record<(typeof AREAS)[number], Level>>

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">{t('settings.privacyIntro')}</p>
      {AREAS.map((area) => (
        <fieldset key={area}>
          <legend className="mb-1 text-sm font-medium">{t(`settings.areas.${area}`)}</legend>
          <div className="grid grid-cols-3 gap-1">
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={(privacy[area] ?? 'friends') === level}
                onClick={() => update.mutate({ privacy: { ...privacy, [area]: level } })}
                className="min-h-touch rounded-lg bg-surface-2 px-2 text-sm font-medium text-text-secondary aria-pressed:bg-text-primary aria-pressed:text-bg"
              >
                {t(`settings.levels.${level}`)}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {update.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}

function DataSection() {
  const { t } = useTranslation()
  const me = useMember()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [confirmation, setConfirmation] = useState('')

  const exportData = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().rpc('export_my_data')
      if (error) throw error
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `gstlst-export-${me.username}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
  })

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const supabase = getSupabase()
      for (const bucket of ['avatars', MEDIA_BUCKET]) {
        const storage = supabase.storage.from(bucket)
        const { data: files, error: listError } = await storage.list(me.id, { limit: 10000 })
        if (listError) throw listError
        if (files.length > 0) {
          const { error } = await storage.remove(files.map((file) => `${me.id}/${file.name}`))
          if (error) throw error
        }
      }
      await clearQueue(me.id)
      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw error
      await signOut()
    },
    onSuccess: () => void navigate('/login', { replace: true }),
  })

  return (
    <div className="space-y-6">
      <div>
        <Button onClick={() => exportData.mutate()} disabled={exportData.isPending}>{t('settings.export')}</Button>
        {exportData.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      </div>
      <div>
        <p className="mb-3 text-sm text-text-secondary">{t('settings.deleteBody')}</p>
        <TextField
          label={t('settings.deleteConfirm', { username: me.username })}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoCapitalize="none"
          autoComplete="off"
        />
        <Button
          variant="danger"
          className="mt-3"
          disabled={confirmation !== me.username || deleteAccount.isPending}
          onClick={() => deleteAccount.mutate()}
        >
          {t('settings.delete')}
        </Button>
        {deleteAccount.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const me = useMember()
  const { signOut } = useAuth()

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('settings.title')}</h1>

      <Section title={t('settings.profile')}>
        <AvatarPicker />
        <ProfileForm />
      </Section>
      <Section title={t('language.label')}><LanguagePicker /></Section>
      <Section title={t('settings.privacy')}><PrivacySettings /></Section>

      {me.role === 'admin' && (
        <Section title={t('admin.title')}>
          <Link to="/admin/invites" className="inline-flex min-h-touch items-center rounded-lg bg-surface-2 px-4 font-semibold">
            {t('admin.invites')}
          </Link>
        </Section>
      )}

      <Section title={t('settings.yourData')}><DataSection /></Section>

      <Section title={t('legal.label')}>
        <div className="flex flex-col items-start">
          <Link to="/legal/privacy" className="py-3">{t('legal.privacy.title')}</Link>
          <Link to="/legal/terms" className="py-3">{t('legal.terms.title')}</Link>
          <Link to="/legal/imprint" className="py-3">{t('legal.imprint.title')}</Link>
        </div>
      </Section>

      <Button className="mt-8 w-full" onClick={() => void signOut()}>{t('settings.signOut')}</Button>
    </div>
  )
}
