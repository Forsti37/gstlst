import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Section, TextField } from '../../app/ui'
import { useReferenceData } from '../checkin/api'
import { Chip, EventRow, UnderReview } from '../checkin/components'
import { genreFamily, useArtists, useEvents, usePromoters, useVenues } from './api'

function BrowseLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="px-4 py-6">
      <Link to="/discover" className="inline-flex min-h-touch items-center text-sm text-text-secondary">← {t('nav.discover')}</Link>
      <h1 className="font-display text-4xl tracking-wide uppercase">{title}</h1>
      {children}
    </div>
  )
}

const matches = (name: string, filter: string) => name.toLowerCase().includes(filter.trim().toLowerCase())

function Filter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="mt-4">
      <TextField label={t('discover.filter')} type="search" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  )
}

function NameRow({ to, name, detail, status }: { to: string; name: string; detail?: string; status?: 'pending' | 'approved' | 'rejected' }) {
  return (
    <li>
      <Link to={to} className="flex min-h-touch items-center gap-3 rounded-lg bg-surface-1 px-4 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          {detail && <span className="block truncate text-sm text-text-secondary">{detail}</span>}
        </span>
        <UnderReview status={status} />
      </Link>
    </li>
  )
}

export function EventsBrowsePage() {
  const { t } = useTranslation()
  const [direction, setDirection] = useState<'upcoming' | 'past'>('upcoming')
  const [filter, setFilter] = useState('')
  const events = useEvents(direction, 200)
  const list = (events.data ?? []).filter((event) => matches(`${event.name} ${event.venue?.name ?? ''} ${event.venue?.city ?? ''}`, filter))
  return (
    <BrowseLayout title={t('discover.categories.event')}>
      <div className="mt-4 flex gap-2">
        <Chip selected={direction === 'upcoming'} onClick={() => setDirection('upcoming')}>{t('discover.upcoming')}</Chip>
        <Chip selected={direction === 'past'} onClick={() => setDirection('past')}>{t('discover.past')}</Chip>
      </div>
      <Filter value={filter} onChange={setFilter} />
      {events.isPending && <p className="mt-4 text-text-secondary">{t('common.loading')}</p>}
      {events.data && list.length === 0 && <p className="mt-4 text-text-secondary">{t('discover.nothing')}</p>}
      <ul className="mt-4 space-y-2">
        {list.map((event) => <EventRow key={event.id} event={event} to={`/events/${event.id}`} />)}
      </ul>
    </BrowseLayout>
  )
}

export function ArtistsBrowsePage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const genreId = params.get('genre')
  const [filter, setFilter] = useState('')
  const artists = useArtists()
  const { genres } = useReferenceData()
  const genreNames = useMemo(() => new Map(genres.map((genre) => [genre.id, genre.name])), [genres])
  const root = genres.find((genre) => !genre.parent_id)
  const mainGenres = genres.filter((genre) => genre.parent_id === root?.id)
  const family = genreId ? genreFamily(genreId, genres) : null
  const list = (artists.data ?? [])
    .filter((artist) => !family || artist.genreIds.some((id) => family.has(id)))
    .filter((artist) => matches(artist.name, filter))
  const selectedName = genreId ? genreNames.get(genreId) : null

  return (
    <BrowseLayout title={selectedName ?? t('discover.categories.artist')}>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip selected={!genreId} onClick={() => setParams({})}>{t('discover.allGenres')}</Chip>
        {mainGenres.map((genre) => (
          <Chip key={genre.id} selected={genreId === genre.id} onClick={() => setParams({ genre: genre.id })}>{genre.name}</Chip>
        ))}
      </div>
      <Filter value={filter} onChange={setFilter} />
      {artists.isPending && <p className="mt-4 text-text-secondary">{t('common.loading')}</p>}
      {artists.data && <p className="mt-4 text-sm text-text-secondary">{t('discover.artistCount', { count: list.length })}</p>}
      <ul className="mt-2 space-y-1">
        {list.map((artist) => (
          <NameRow
            key={artist.id}
            to={`/artists/${artist.id}`}
            name={artist.name}
            status={artist.status}
            detail={artist.genreIds.map((id) => genreNames.get(id)).filter(Boolean).join(' · ') || undefined}
          />
        ))}
      </ul>
    </BrowseLayout>
  )
}

export function GenresBrowsePage() {
  const { t } = useTranslation()
  const { genres } = useReferenceData()
  const artists = useArtists()
  const root = genres.find((genre) => !genre.parent_id)
  const children = (parentId: string) => genres.filter((genre) => genre.parent_id === parentId)
  // How many artists play a genre, its subgenres included.
  const countFor = (genreId: string) => {
    const family = genreFamily(genreId, genres)
    return (artists.data ?? []).filter((artist) => artist.genreIds.some((id) => family.has(id))).length
  }
  const mains = root ? children(root.id) : []

  return (
    <BrowseLayout title={t('discover.categories.genre')}>
      {mains
        .map((main) => ({ main, count: countFor(main.id) }))
        .sort((a, b) => b.count - a.count || a.main.name.localeCompare(b.main.name))
        .map(({ main, count }) => (
          <Section key={main.id} title={main.name}>
            <Link to={`/discover/artists?genre=${main.id}`} className="flex min-h-touch items-center justify-between rounded-lg bg-surface-1 px-4 font-medium">
              <span>{t('discover.allOf', { name: main.name })}</span>
              <span className="text-sm text-text-secondary tabular-nums">{count}</span>
            </Link>
            {children(main.id).length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {children(main.id).map((sub) => (
                  <li key={sub.id}>
                    <Link to={`/discover/artists?genre=${sub.id}`} className="inline-flex min-h-touch items-center gap-2 rounded-full bg-surface-2 px-4 text-sm">
                      {sub.name}
                      <span className="text-text-secondary tabular-nums">{countFor(sub.id)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}
    </BrowseLayout>
  )
}

export function VenuesBrowsePage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const venues = useVenues()
  const list = (venues.data ?? []).filter((venue) => matches(`${venue.name} ${venue.city}`, filter))
  const cities = [...new Set(list.map((venue) => venue.city))]
    .map((city) => ({ city, venues: list.filter((venue) => venue.city === city) }))
    .sort((a, b) => b.venues.length - a.venues.length || a.city.localeCompare(b.city))

  return (
    <BrowseLayout title={t('discover.categories.venue')}>
      <Filter value={filter} onChange={setFilter} />
      {venues.isPending && <p className="mt-4 text-text-secondary">{t('common.loading')}</p>}
      {cities.map(({ city, venues: inCity }) => (
        <Section key={city} title={`${city} · ${inCity.length}`}>
          <ul className="space-y-1">
            {inCity.map((venue) => (
              <NameRow
                key={venue.id}
                to={`/venues/${venue.id}`}
                name={venue.name}
                status={venue.status}
                detail={`${t(`checkin.venueTypes.${venue.venue_type}`, { defaultValue: venue.venue_type })} ·${t('stats.eventCount', { count: venue.events[0]?.count ?? 0 })}`}
              />
            ))}
          </ul>
        </Section>
      ))}
    </BrowseLayout>
  )
}

export function PromotersBrowsePage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const promoters = usePromoters()
  const list = (promoters.data ?? [])
    .filter((promoter) => matches(promoter.name, filter))
    .sort((a, b) => (b.event_promoters[0]?.count ?? 0) - (a.event_promoters[0]?.count ?? 0) || a.name.localeCompare(b.name))
  return (
    <BrowseLayout title={t('discover.categories.promoter')}>
      <Filter value={filter} onChange={setFilter} />
      {promoters.isPending && <p className="mt-4 text-text-secondary">{t('common.loading')}</p>}
      <ul className="mt-4 space-y-1">
        {list.map((promoter) => (
          <NameRow
            key={promoter.id}
            to={`/promoters/${promoter.id}`}
            name={promoter.name}
            status={promoter.status}
            detail={t('stats.eventCount', { count: promoter.event_promoters[0]?.count ?? 0 })}
          />
        ))}
      </ul>
    </BrowseLayout>
  )
}
