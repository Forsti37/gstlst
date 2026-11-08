import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Section } from '../../app/ui'
import { instagramHandle } from '../../lib/instagram'
import { getSupabase } from '../../lib/supabase'
import { formatEventDate } from '../checkin/api'
import { usePromoterStats } from '../entity/api'
import { CheckinsSection, EntityHeader, FriendsSection, PersonalSection, UpcomingSection } from '../entity/parts'
import { BarList } from './charts'
import { StatTile } from './ProfileStatsSection'

interface PromoterEvent {
  event: { id: string; name: string; date_start: string; date_end: string | null } | null
}

export function PromoterPage() {
  const { t, i18n } = useTranslation()
  const { promoterId } = useParams()
  const stats = usePromoterStats(promoterId)
  const promoter = useQuery({
    queryKey: ['promoter', promoterId],
    enabled: Boolean(promoterId),
    queryFn: async () => {
      const client = getSupabase()
      const [details, events] = await Promise.all([
        client.from('promoters').select('id, name, instagram_url, status').eq('id', promoterId!).maybeSingle(),
        client.from('event_promoters').select('event:events(id, name, date_start, date_end)').eq('promoter_id', promoterId!),
      ])
      if (details.error) throw details.error
      if (events.error) throw events.error
      const today = new Date().toISOString().slice(0, 10)
      const list = (events.data as unknown as PromoterEvent[]).flatMap((row) => (row.event && row.event.date_start < today ? [row.event] : []))
      return { details: details.data, events: list.sort((a, b) => b.date_start.localeCompare(a.date_start)) }
    },
  })
  if (promoter.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!promoter.data?.details) return <PlaceholderPage title={t('pages.notFound.title')} body={t('promoter.notFound')} />
  const { details, events } = promoter.data
  const s = stats.data

  return (
    <div className="px-4 pb-6">
      <EntityHeader
        id={details.id}
        kicker={t('entity.kicker.promoter')}
        name={details.name}
        status={details.status}
        subline={s && s.series.length > 0 ? <p>{s.series.map((series) => series.name).join(' · ')}</p> : undefined}
      >
        {details.instagram_url && (
          <a href={details.instagram_url} target="_blank" rel="noreferrer" className="inline-flex min-h-touch items-center rounded-lg bg-bg/60 px-4 font-semibold">
            {t('common.instagram', { handle: instagramHandle(details.instagram_url) })}
          </a>
        )}
      </EntityHeader>

      <UpcomingSection entity="promoter" id={details.id} />
      <PersonalSection entity="promoter" id={details.id} />

      {s && (
        <Section title={t('entity.app')}>
          <dl className="grid grid-cols-2 gap-2">
            <StatTile label={t('stats.events')} value={s.events} />
            <StatTile label={t('artist.checkins')} value={s.checkins} />
          </dl>
        </Section>
      )}
      {s && s.series.length > 0 && (
        <Section title={t('promoter.series')}>
          <ul className="space-y-1">
            {s.series.map((series) => (
              <li key={series.id} className="flex min-h-touch items-center justify-between rounded-lg bg-surface-1 px-4">
                <span className="font-medium">{series.name}</span>
                <span className="text-sm text-text-secondary">{t('entity.editions', { count: series.editions })}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {s && s.top_artists.length > 0 && (
        <Section title={t('entity.mostBooked')}>
          <BarList tone="social" rows={s.top_artists.map((a) => ({ key: a.id, label: a.name, value: a.events, to: `/artists/${a.id}` }))} />
        </Section>
      )}
      {s && s.venues.length > 0 && (
        <Section title={t('entity.homeVenues')}>
          <BarList tone="social" rows={s.venues.map((v) => ({ key: v.id, label: `${v.name}, ${v.city}`, value: v.events, to: `/venues/${v.id}` }))} />
        </Section>
      )}

      <FriendsSection entity="promoter" id={details.id} />

      {events.length > 0 && (
        <Section title={t('entity.pastEvents')}>
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                <Link to={`/events/${event.id}`} className="flex min-h-touch items-center justify-between gap-3">
                  <span className="truncate">{event.name}</span>
                  <span className="shrink-0 text-sm text-text-secondary">{formatEventDate(event, i18n.resolvedLanguage)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CheckinsSection entity="promoter" id={details.id} />
    </div>
  )
}
