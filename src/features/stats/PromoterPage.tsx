import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Section } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { formatEventDate } from '../checkin/api'
import { UnderReview } from '../checkin/components'

interface PromoterEvent {
  event: { id: string; name: string; date_start: string; date_end: string | null } | null
}

export function PromoterPage() {
  const { t, i18n } = useTranslation()
  const { promoterId } = useParams()
  const promoter = useQuery({
    queryKey: ['promoter', promoterId],
    enabled: Boolean(promoterId),
    queryFn: async () => {
      const client = getSupabase()
      const [details, events, series] = await Promise.all([
        client.from('promoters').select('id, name, instagram_url, status').eq('id', promoterId!).maybeSingle(),
        client.from('event_promoters').select('event:events(id, name, date_start, date_end)').eq('promoter_id', promoterId!),
        client.from('event_series').select('id, name').eq('default_promoter_id', promoterId!).order('name'),
      ])
      if (details.error) throw details.error
      if (events.error) throw events.error
      if (series.error) throw series.error
      const list = (events.data as unknown as PromoterEvent[]).flatMap((row) => (row.event ? [row.event] : []))
      return { details: details.data, series: series.data, events: list.sort((a, b) => b.date_start.localeCompare(a.date_start)) }
    },
  })
  if (promoter.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!promoter.data?.details) return <PlaceholderPage title={t('pages.notFound.title')} body={t('promoter.notFound')} />
  const { details, series, events } = promoter.data
  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{details.name}</h1>
      <UnderReview status={details.status} />
      {details.instagram_url && <a href={details.instagram_url} target="_blank" rel="noreferrer" className="mt-2 flex min-h-touch items-center text-blue">Instagram</a>}
      {series.length > 0 && (
        <Section title={t('promoter.series')}>
          <ul className="flex flex-wrap gap-2">
            {series.map((entry) => <li key={entry.id} className="rounded-lg bg-surface-1 px-3 py-2">{entry.name}</li>)}
          </ul>
        </Section>
      )}
      <Section title={t('venue.events')}>
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
    </div>
  )
}
