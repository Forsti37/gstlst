import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Section, TextField } from '../../app/ui'
import { formatEventDate, useEventSearch, useRecentEvents } from '../checkin/api'
import { EventRow, UnderReview } from '../checkin/components'

export function DiscoverPage() {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const recent = useRecentEvents()
  const search = useEventSearch(query)
  const searching = query.trim().length >= 2

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('nav.discover')}</h1>
      <div className="mt-6">
        <TextField label={t('checkin.searchEvent')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>
      {searching ? (
        <Section title={t('checkin.results')}>
          <ul className="space-y-2">
            {search.data?.map((event) => (
              <li key={event.id}>
                <Link to={`/events/${event.id}`} className="block min-h-touch rounded-lg bg-surface-1 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2 font-medium">{event.name} <UnderReview status={event.status} /></span>
                  <span className="block truncate text-sm text-text-secondary">
                    {formatEventDate(event, i18n.resolvedLanguage)}
                    {event.venue_name && ` · ${event.venue_name}, ${event.venue_city}`}
                  </span>
                </Link>
              </li>
            ))}
            {search.data?.length === 0 && <li className="text-text-secondary">{t('checkin.noResults')}</li>}
          </ul>
        </Section>
      ) : (
        <Section title={t('discover.recent')}>
          <ul className="space-y-2">
            {recent.data?.map((event) => <EventRow key={event.id} event={event} to={`/events/${event.id}`} />)}
          </ul>
        </Section>
      )}
    </div>
  )
}
