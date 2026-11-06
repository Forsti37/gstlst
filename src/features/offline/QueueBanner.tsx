import { CloudOff, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../app/ui'
import { useAuth } from '../auth/auth'
import { discardFailed, retryFailed, startQueueSync, useQueueStatus } from './queue'

export function QueueBanner() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user.id
  const { waiting, failed, error } = useQueueStatus(userId)

  useEffect(() => {
    if (userId) startQueueSync()
  }, [userId])

  if (!userId || (waiting === 0 && failed === 0)) return null

  return (
    <aside className="mx-3 mb-3 space-y-2 rounded-xl bg-surface-2 p-3 text-sm" aria-live="polite">
      {waiting > 0 && (
        <p className="flex items-center gap-2">
          <CloudOff aria-hidden className="size-4 shrink-0" />
          {t('queue.waiting', { count: waiting })}
        </p>
      )}
      {failed > 0 && (
        <div>
          <p className="flex items-center gap-2 text-red">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {t('queue.failed', { count: failed })}
          </p>
          {error && <p className="mt-1 text-xs break-words text-text-secondary">{error}</p>}
          <div className="mt-2 flex gap-2">
            <Button onClick={() => void retryFailed(userId)}>{t('common.retry')}</Button>
            <Button variant="danger" onClick={() => void discardFailed(userId)}>{t('queue.discard')}</Button>
          </div>
        </div>
      )}
    </aside>
  )
}
