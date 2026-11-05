import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'
import { Button, ErrorText, FullScreenMessage } from '../../app/ui'
import { isSupabaseConfigured } from '../../lib/supabase'
import { signInWithGoogle, useAuth } from './auth'
import { readInviteCode } from './invite'

export function LoginPage() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const [failed, setFailed] = useState(false)

  if (status === 'loading') return <FullScreenMessage>{t('common.loading')}</FullScreenMessage>
  if (status !== 'signedOut') return <Navigate to="/" replace />

  const signIn = async () => {
    setFailed(false)
    const { error } = await signInWithGoogle()
    if (error) setFailed(true)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10 text-center">
      <img src={`${import.meta.env.BASE_URL}icons/logo.svg`} alt="GSTLST" className="mx-auto size-44" />
      <p className="mt-4 text-text-secondary">{t('brand.tagline')}</p>

      {readInviteCode() && <p className="mt-8 text-sm">{t('auth.inviteReady')}</p>}

      <Button variant="primary" className="mt-8 w-full" disabled={!isSupabaseConfigured} onClick={() => void signIn()}>
        {t('auth.signInWithGoogle')}
      </Button>
      {!isSupabaseConfigured && <ErrorText>{t('auth.notAvailable')}</ErrorText>}
      {failed && <ErrorText>{t('auth.signInFailed')}</ErrorText>}

      <p className="mt-4 text-sm text-text-secondary">{t('auth.inviteOnly')}</p>

      <nav aria-label={t('legal.label')} className="mt-10 flex justify-center gap-4 text-sm text-text-secondary">
        <Link to="/legal/privacy" className="py-3">{t('legal.privacy.title')}</Link>
        <Link to="/legal/terms" className="py-3">{t('legal.terms.title')}</Link>
        <Link to="/legal/imprint" className="py-3">{t('legal.imprint.title')}</Link>
      </nav>
    </main>
  )
}
