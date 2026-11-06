import { useQueryClient } from '@tanstack/react-query'
import { LocateFixed, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, Section, TextField } from '../../app/ui'
import { distanceKm, getPosition, hasLocationPermission, toDateString, type Position } from '../../lib/geo'
import { EventRow, UnderReview } from './components'
import { fetchLineup, formatEventDate, lineupKey, useEventsAround, useEventSearch, type EventSummary } from './api'

function sortByRelevance(events: EventSummary[], position: Position | null, today: string) {
  const distance = (event: EventSummary) =>
    position && event.venue?.lat != null && event.venue.lng != null
      ? distanceKm(position.lat, position.lng, event.venue.lat, event.venue.lng)
      : Number.POSITIVE_INFINITY
  const isToday = (event: EventSummary) => event.date_start <= today && (event.date_end ?? event.date_start) >= today
  return [...events].sort((a, b) => distance(a) - distance(b) || Number(isToday(b)) - Number(isToday(a)))
}

/** Step 1: find the event. The location is only used on this device, to sort the list. */
export function CheckinPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<Position | null>(null)

  const [today, yesterday] = useMemo(() => {
    const now = new Date()
    const before = new Date(now)
    before.setDate(now.getDate() - 1)
    return [toDateString(now), toDateString(before)]
  }, [])

  const around = useEventsAround(today, yesterday)
  const search = useEventSearch(query)

  useEffect(() => {
    void hasLocationPermission().then((granted) => {
      if (granted) void getPosition().then(setPosition)
    })
  }, [])

  // Lineups of tonight's events get cached now, in case the reception is gone at the venue.
  const aroundIds = around.data?.map((event) => event.id).join(',')
  useEffect(() => {
    for (const id of aroundIds?.split(',').filter(Boolean) ?? []) {
      void queryClient.prefetchQuery({ queryKey: lineupKey(id), queryFn: () => fetchLineup(id), meta: { persist: true } })
    }
  }, [aroundIds, queryClient])

  const nearby = sortByRelevance(around.data ?? [], position, today)
  const searching = query.trim().length >= 2

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('nav.checkin')}</h1>

      <div className="mt-6">
        <TextField label={t('checkin.searchEvent')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>

      {searching ? (
        <Section title={t('checkin.results')}>
          <ul className="space-y-2">
            {search.data?.map((event) => (
              <li key={event.id}>
                <Link to={`/check-in/${event.id}`} className="block min-h-touch rounded-lg bg-surface-1 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2 font-medium">{event.name} <UnderReview status={event.status} /></span>
                  <span className="block truncate text-sm text-text-secondary">
                    {formatEventDate(event, i18n.resolvedLanguage)}
                    {event.venue_name && ` · ${event.venue_name}, ${event.venue_city}`}
                  </span>
                </Link>
              </li>
            ))}
            {search.data?.length === 0 && <li className="text-text-secondary">{t('checkin.noResults')}</li>}
            {search.isError && <li className="text-text-secondary">{t('checkin.searchOffline')}</li>}
          </ul>
        </Section>
      ) : (
        <Section title={t('checkin.nearNow')}>
          {!position && (
            <Button className="mb-3 w-full" onClick={() => void getPosition().then(setPosition)}>
              <LocateFixed aria-hidden className="size-5" />
              {t('checkin.useLocation')}
            </Button>
          )}
          <ul className="space-y-2">
            {nearby.map((event) => <EventRow key={event.id} event={event} to={`/check-in/${event.id}`} />)}
          </ul>
          {nearby.length === 0 && !around.isPending && <p className="text-text-secondary">{t('checkin.nothingNow')}</p>}
        </Section>
      )}

      <Link to="/check-in/new" className="mt-6 inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-surface-2 px-4 font-semibold">
        <Plus aria-hidden className="size-5" />
        {t('checkin.createEvent')}
      </Link>
    </div>
  )
}
