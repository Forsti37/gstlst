import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Button, ErrorText } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'

const REACTIONS: Record<string, string> = { bassface: '😤', dance: '💃', fire: '🔥' }

interface Payload {
  actor?: string
  username?: string
  event?: string
  event_id?: string
  checkin_id?: string
  sets?: number
  count?: number
  kind?: string
  artist?: string
  artist_id?: string
  city?: string
  name?: string
  decision?: 'approve' | 'reject' | 'merge'
  reason?: string | null
  merged_into?: string
}

function useNotificationView() {
  const { t } = useTranslation()
  return (kind: string, p: Payload): { text: string; to?: string } => {
    const event = p.event_id ? `/events/${p.event_id}` : undefined
    const outcome = p.decision ?? 'approve'
    switch (kind) {
      case 'friend_checkin':
        return { text: (p.sets ?? 0) > 0 ? t('inbox.friendCheckinSets', { actor: p.actor, event: p.event, count: p.sets }) : t('inbox.friendCheckin', { actor: p.actor, event: p.event }), to: event }
      case 'reaction':
        return { text: (p.count ?? 1) > 1 ? t('inbox.reactionMany', { actor: p.actor, event: p.event, count: (p.count ?? 2) - 1 }) : t('inbox.reaction', { actor: p.actor, event: p.event, emoji: REACTIONS[p.kind ?? ''] ?? '' }), to: event }
      case 'friend_request':
        return { text: t('inbox.friendRequest', { actor: p.actor }), to: '/friends' }
      case 'friend_accepted':
        return { text: t('inbox.friendAccepted', { actor: p.actor }), to: `/u/${p.username}` }
      case 'tagged':
        return { text: t('inbox.tagged', { actor: p.actor, event: p.event }), to: p.event_id && p.checkin_id ? `/check-in/${p.event_id}?adopt=${p.checkin_id}` : event }
      case 'friend_going':
        return { text: t('inbox.friendGoing', { actor: p.actor, event: p.event }), to: event }
      case 'wishlist':
        return p.kind === 'plays'
          ? { text: t('inbox.wishlistPlays', { artist: p.artist, event: p.event, city: p.city }), to: event }
          : { text: t('inbox.wishlistSeen', { actor: p.actor, artist: p.artist }), to: p.artist_id ? `/artists/${p.artist_id}` : undefined }
      case 'data_decision':
        return { text: t(`inbox.data.${outcome}`, { name: p.name, into: p.merged_into }) }
      case 'request_decision':
        return { text: t(`inbox.request.${outcome === 'reject' ? 'reject' : 'approve'}`) }
      case 'photo_decision':
        return { text: t(`inbox.photo.${outcome === 'reject' ? 'reject' : 'approve'}`) }
      default:
        return { text: t('inbox.generic') }
    }
  }
}

export function InboxPage() {
  const { t, i18n } = useTranslation()
  const me = useMember()
  const queryClient = useQueryClient()
  const view = useNotificationView()
  const key = ['notifications', me.id]

  const notifications = useQuery({
    queryKey: key,
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('notifications')
        .select('id, type, payload, read_at, updated_at')
        .eq('recipient_id', me.id)
        .order('updated_at', { ascending: false })
        .limit(100)
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
      {markRead.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      <ul className="mt-4 space-y-2">
        {notifications.data?.map((notification) => {
          const payload = notification.payload as Payload
          const { text, to } = view(notification.type, payload)
          const body = (
            <>
              <p>{text}</p>
              {payload.reason && <p className="mt-1 text-sm text-text-secondary">{t('inbox.reason', { reason: payload.reason })}</p>}
              <p className="mt-1 text-xs text-text-secondary">{new Date(notification.updated_at).toLocaleDateString(i18n.resolvedLanguage)}</p>
            </>
          )
          const style = `block rounded-lg p-3 ${notification.read_at ? 'bg-surface-1' : 'bg-surface-2'}`
          return <li key={notification.id}>{to ? <Link to={to} className={style}>{body}</Link> : <div className={style}>{body}</div>}</li>
        })}
      </ul>
    </div>
  )
}
