import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { Button, FullScreenMessage } from '../../app/ui'
import { readStored, removeStored, writeStored } from '../../lib/safeStorage'
import { useAuth } from './auth'

const RETURN_TO_KEY = 'gstlst.return-to'

function LoadingOrError() {
  const { t } = useTranslation()
  const { status, retry } = useAuth()
  if (status === 'error') {
    return (
      <FullScreenMessage>
        <div>
          <p className="mb-4">{t('auth.loadFailed')}</p>
          <Button onClick={retry}>{t('common.retry')}</Button>
        </div>
      </FullScreenMessage>
    )
  }
  return <FullScreenMessage>{t('common.loading')}</FullScreenMessage>
}

/** Deep links such as /u/lisa survive the trip to Google and back. */
function rememberDestination(path: string) {
  if (path !== '/') writeStored(RETURN_TO_KEY, path)
}

export function RequireMember() {
  const { status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (status !== 'member') return
    const destination = readStored(RETURN_TO_KEY)
    if (destination) {
      removeStored(RETURN_TO_KEY)
      void navigate(destination, { replace: true })
    }
  }, [status, navigate])

  if (status === 'loading' || status === 'error') return <LoadingOrError />
  if (status === 'signedOut' || status === 'onboarding') {
    rememberDestination(`${location.pathname}${location.search}`)
    return <Navigate to={status === 'signedOut' ? '/login' : '/onboarding'} replace />
  }
  return <Outlet />
}

export function RequireOnboarding() {
  const { status } = useAuth()
  if (status === 'loading' || status === 'error') return <LoadingOrError />
  if (status === 'signedOut') return <Navigate to="/login" replace />
  if (status === 'member') return <Navigate to="/" replace />
  return <Outlet />
}
