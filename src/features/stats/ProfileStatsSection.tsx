import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Section } from '../../app/ui'
import { Chip } from '../checkin/components'
import { useProfileMap, useProfileStats, type StatRow } from './api'
import { BarList, CalendarHeatmap, type Tone } from './charts'
import { MapSection } from './MapSection'

const toRows = (rows: StatRow[], by: 'sets' | 'events', link?: (row: StatRow) => string) =>
  rows.map((row) => ({ key: row.key, label: row.label, value: row[by], to: link?.(row) }))

export function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col-reverse rounded-lg bg-surface-1 p-3">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="font-display text-3xl tracking-wide tabular-nums">{value}</dd>
    </div>
  )
}

function ProfileMap({ userId, tone }: { userId: string; tone: Tone }) {
  const { t } = useTranslation()
  const map = useProfileMap(userId)
  const points = useMemo(
    () => (map.data ?? []).map((venue) => ({ id: venue.venue_id, lat: venue.lat, lng: venue.lng, events: venue.events })),
    [map.data],
  )
  if (points.length === 0) return null
  return (
    <Section title={t('stats.map')}>
      <MapSection points={points} tone={tone} />
    </Section>
  )
}

export function ProfileStatsSection({ userId, own }: { userId: string; own: boolean }) {
  const { t, i18n } = useTranslation()
  const stats = useProfileStats(userId, own)
  const [genreBy, setGenreBy] = useState<'sets' | 'events'>('sets')
  const tone: Tone = own ? 'own' : 'social'

  if (stats.isPending) return <p className="mt-6 text-text-secondary">{t('common.loading')}</p>
  if (stats.isError) return <p className="mt-6 text-text-secondary">{t('stats.loadFailed')}</p>
  if (!stats.data) return own ? null : <p className="mt-6 text-text-secondary">{t('stats.hidden')}</p>

  const { headline, genres, top_artists, top_venues, top_promoters, b2b, calendar, streaks, travel_km, travel_missing } = stats.data
  const rating = headline.avg_rating == null ? '–' : headline.avg_rating.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })

  return (
    <>
      <Section title={t('stats.title')}>
        <dl className="grid grid-cols-3 gap-2">
          <StatTile label={t('stats.events')} value={headline.events} />
          <StatTile label={t('stats.sets')} value={headline.sets} />
          <StatTile label={t('stats.artists')} value={headline.artists} />
          <StatTile label={t('stats.venues')} value={headline.venues} />
          <StatTile label={t('stats.cities')} value={headline.cities} />
          <StatTile label={t('stats.countries')} value={headline.countries} />
          <StatTile label={t('stats.promoters')} value={headline.promoters} />
          <StatTile label={t('stats.avgRating')} value={rating} />
          <StatTile label={t('stats.verified')} value={headline.verified} />
          <StatTile label={t('stats.streakCurrent')} value={streaks.current} />
          <StatTile label={t('stats.streakLongest')} value={streaks.longest} />
          {travel_km != null && <StatTile label={t('stats.travelKm')} value={travel_km.toLocaleString(i18n.resolvedLanguage)} />}
        </dl>
        {travel_missing === 'checkins' && <p className="mt-2 text-sm text-text-secondary">{t('stats.travelNeedsCheckins')}</p>}
        {travel_missing === 'home' && (
          <Link to="/settings" className="mt-2 flex min-h-touch items-center text-sm text-blue">{t('stats.travelNeedsHome')}</Link>
        )}
        <Link to={`/explore/${userId}`} className="mt-3 flex min-h-touch items-center justify-center rounded-lg bg-surface-2 px-4 font-semibold">{t('stats.openExplorer')}</Link>
      </Section>

      {genres.length > 0 && (
        <Section title={t('stats.genres')}>
          <div className="mb-2 flex gap-2">
            <Chip selected={genreBy === 'sets'} onClick={() => setGenreBy('sets')}>{t('stats.bySets')}</Chip>
            <Chip selected={genreBy === 'events'} onClick={() => setGenreBy('events')}>{t('stats.byEvents')}</Chip>
          </div>
          <BarList rows={toRows(genres, genreBy)} tone={tone} />
        </Section>
      )}
      {top_artists.length > 0 && (
        <Section title={t('stats.topArtists')}>
          <BarList rows={toRows(top_artists, 'sets', (row) => `/artists/${row.key}`)} tone={tone} />
        </Section>
      )}
      {top_venues.length > 0 && (
        <Section title={t('stats.topVenues')}>
          <BarList rows={toRows(top_venues, 'events', (row) => `/venues/${row.key}`)} tone={tone} />
        </Section>
      )}
      {top_promoters.length > 0 && (
        <Section title={t('stats.topPromoters')}>
          <BarList rows={toRows(top_promoters, 'events', (row) => `/promoters/${row.key}`)} tone={tone} />
        </Section>
      )}
      {b2b.length > 0 && (
        <Section title={t('stats.b2b')}>
          <BarList rows={b2b.map((row) => ({ key: row.label, label: row.label, value: row.sets }))} tone={tone} />
        </Section>
      )}
      <ProfileMap userId={userId} tone={tone} />
      <Section title={t('stats.calendar')}>
        <CalendarHeatmap days={calendar} tone={tone} />
      </Section>
    </>
  )
}
