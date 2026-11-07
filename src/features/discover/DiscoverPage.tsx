import { CalendarDays, Headphones, MapPin, Megaphone, Mic2, Trophy, Volume2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Section, TextField } from '../../app/ui'
import { EventRow } from '../checkin/components'
import { useCounts, useEverythingSearch, useEvents, type SearchHit } from './api'

function Tile({ to, icon: Icon, label, count }: { to: string; icon: LucideIcon; label: string; count?: number }) {
  return (
    <Link to={to} className="flex min-h-24 flex-col justify-between rounded-xl bg-surface-1 p-4">
      <Icon aria-hidden className="size-6 text-text-secondary" />
      <span>
        <span className="block font-semibold">{label}</span>
        {count !== undefined && <span className="block text-sm text-text-secondary tabular-nums">{count}</span>}
      </span>
    </Link>
  )
}

const HIT_LINK: Record<SearchHit['type'], (id: string) => string> = {
  event: (id) => `/events/${id}`,
  artist: (id) => `/artists/${id}`,
  venue: (id) => `/venues/${id}`,
  promoter: (id) => `/promoters/${id}`,
}

function SearchResults({ query }: { query: string }) {
  const { t } = useTranslation()
  const search = useEverythingSearch(query)
  if (search.isPending) return <p className="mt-4 text-text-secondary">{t('common.loading')}</p>
  const hits = search.data ?? []
  if (hits.length === 0) return <p className="mt-4 text-text-secondary">{t('checkin.noResults')}</p>
  const groups = (['event', 'artist', 'venue', 'promoter'] as const).map((type) => [type, hits.filter((hit) => hit.type === type)] as const)
  return (
    <>
      {groups.map(([type, list]) =>
        list.length === 0 ? null : (
          <Section key={type} title={t(`discover.categories.${type}`)}>
            <ul className="space-y-1">
              {list.map((hit) => (
                <li key={hit.id}>
                  <Link to={HIT_LINK[type](hit.id)} className="flex min-h-touch flex-col justify-center rounded-lg bg-surface-1 px-4 py-2">
                    <span className="truncate font-medium">{hit.name}</span>
                    {hit.detail && <span className="truncate text-sm text-text-secondary">{hit.detail}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ),
      )}
    </>
  )
}

/** A starting point to click through: one search for everything, then categories. */
export function DiscoverPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const counts = useCounts()
  const upcoming = useEvents('upcoming', 5)
  const past = useEvents('past', 5)
  const searching = query.trim().length >= 2

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('nav.discover')}</h1>
      <div className="mt-4">
        <TextField label={t('discover.search')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>

      {searching ? (
        <SearchResults query={query} />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Tile to="/discover/events" icon={CalendarDays} label={t('discover.categories.event')} count={counts.data?.events} />
            <Tile to="/discover/artists" icon={Mic2} label={t('discover.categories.artist')} count={counts.data?.artists} />
            <Tile to="/discover/genres" icon={Headphones} label={t('discover.categories.genre')} />
            <Tile to="/discover/venues" icon={MapPin} label={t('discover.categories.venue')} count={counts.data?.venues} />
            <Tile to="/discover/promoters" icon={Megaphone} label={t('discover.categories.promoter')} count={counts.data?.promoters} />
            <Tile to="/leaderboard" icon={Trophy} label={t('leaderboard.title')} />
            <Tile to="/best-sound" icon={Volume2} label={t('bestSound.title')} />
          </div>

          {(upcoming.data?.length ?? 0) > 0 && (
            <Section title={t('discover.upcoming')}>
              <ul className="space-y-2">
                {upcoming.data?.map((event) => <EventRow key={event.id} event={event} to={`/events/${event.id}`} />)}
              </ul>
            </Section>
          )}
          <Section title={t('discover.recent')}>
            <ul className="space-y-2">
              {past.data?.map((event) => <EventRow key={event.id} event={event} to={`/events/${event.id}`} />)}
            </ul>
            <Link to="/discover/events" className="mt-2 flex min-h-touch items-center text-blue">{t('discover.allEvents')}</Link>
          </Section>
        </>
      )}
    </div>
  )
}
