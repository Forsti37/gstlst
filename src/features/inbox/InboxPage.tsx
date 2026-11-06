import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Button } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'

interface DecisionPayload {
  entity_type?: string
  name?: string
  decision?: 'approve' | 'reject' | 'merge'
  reason?: string | null
  merged_into?: string
}

function useNotificationText() {
  const { t } = useTranslation()
  return (type: string, payload: DecisionPayload) => {
    const outcome = payload.decision ?? 'approve'
    switch (type) {
      case 'data_decision':
        return t(`inbox.data.${outcome}`, { name: payload.name, into: payload.merged_into })
      case 'request_decision':
        return t(`inbox.request.${outcome === 'reject' ? 'reject' : 'approve'}`)
      case 'photo_decision':
        return t(`inbox.photo.${outcome === 'reject' ? 'reject' : 'approve'}`)
      default:
        return type
    }
  }
}

/** Decisions about the user's contributions. Phase 5 adds the social notifications and push. */
export function InboxPage() {
  const { t, i18n } = useTranslation()
  const me = useMember()
  const queryClient = useQueryClient()
  const text = useNotificationText()
  const key = ['notifications', me.id]

  const notifications = useQuery({
    queryKey: key,
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase().from('notifications').select('id, type, payload, read_at, created_at').eq('recipient_id', me.id).order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return data
    },
  })
  const unread = notifications.data?.filter((n) => !n.read_at) ?? []
  const markRead = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', me.id).is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  })

  if (!notifications.isPending && notifications.data?.length === 0) {
    return <PlaceholderPage title={t('nav.inbox')} body={t('pages.inbox.body')} />
  }

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('nav.inbox')}</h1>
      {unread.length > 0 && <Button className="mt-4" onClick={() => markRead.mutate()}>{t('inbox.markRead')}</Button>}
      <ul className="mt-4 space-y-2">
        {notifications.data?.map((notification) => {
          const payload = notification.payload as DecisionPayload
          return (
            <li key={notification.id} className={`rounded-lg p-3 ${notification.read_at ? 'bg-surface-1' : 'bg-surface-2'}`}>
              <p>{text(notification.type, payload)}</p>
              {payload.reason && <p className="mt-1 text-sm text-text-secondary">{t('inbox.reason', { reason: payload.reason })}</p>}
              <p className="mt-1 text-xs text-text-secondary">{new Date(notification.created_at).toLocaleDateString(i18n.resolvedLanguage)}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
