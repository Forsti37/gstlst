import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { getSupabase } from '../../lib/supabase'
import type { FeedCard as Card } from './api'
import { FeedCard } from './FeedCard'

export function useCheckinCard(checkinId: string | undefined) {
  return useQuery({
    queryKey: ['checkinCard', checkinId],
    enabled: Boolean(checkinId),
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_checkin_card', { target_checkin: checkinId! })
      if (error) throw error
      return data as unknown as Card | null
    },
  })
}

/** A single check-in, like a check-in page on Untappd. Anyone who may see it can open it. */
export function CheckinViewPage() {
  const { t } = useTranslation()
  const { checkinId } = useParams()
  const navigate = useNavigate()
  const card = useCheckinCard(checkinId)

  if (card.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!card.data) return <PlaceholderPage title={t('pages.notFound.title')} body={t('feed.checkinNotFound')} />

  return (
    <div className="px-4 py-4">
      <button type="button" onClick={() => (window.history.length > 1 ? void navigate(-1) : void navigate('/'))} className="inline-flex min-h-touch items-center text-sm text-text-secondary">
        ← {t('common.back')}
      </button>
      <FeedCard card={card.data} detail />
      <Link to={`/events/${card.data.event.id}`} className="mt-3 flex min-h-touch items-center justify-center rounded-lg bg-surface-1 px-4 font-semibold">
        {t('feed.toEvent')}
      </Link>
    </div>
  )
}
