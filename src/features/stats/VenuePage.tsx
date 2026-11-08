import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Section } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { formatEventDate } from '../checkin/api'
import { MapLink } from '../checkin/components'
import { CheckinsSection, EntityHeader, FriendsSection, PersonalSection, UpcomingSection } from '../entity/parts'
import { UserAvatar } from '../profile/UserAvatar'
import { useVenueStats } from './api'
import { BarList } from './charts'
import { MapSection } from './MapSection'

const RATINGS = ['overall', 'sound', 'crowd', 'location', 'lineup'] as const

export function VenuePage() {
  const { t, i18n } = useTranslation()
  const { venueId } = useParams()
  const venue = useQuery({
    queryKey: ['venue', venueId],
    enabled: Boolean(venueId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('venues').select('id, name, city, country_code, venue_type, lat, lng, status').eq('id', venueId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const events = useQuery({
    queryKey: ['venue', venueId, 'events'],
    enabled: Boolean(venueId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('events')
        .select('id, name, date_start, date_end')
        .eq('venue_id', venueId!)
        .lt('date_start', new Date().toISOString().slice(0, 10))
        .order('date_start', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
  })
  const stats = useVenueStats(venueId)
  const points = useMemo(() => {
    const v = venue.data
    return v && v.lat != null && v.lng != null ? [{ id: v.id, lat: v.lat, lng: v.lng, events: 1 }] : []
  }, [venue.data])

  if (venue.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!venue.data) return <PlaceholderPage title={t('pages.notFound.title')} body={t('venue.notFound')} />
  const v = venue.data
  const averages = stats.data?.averages
  const rated = RATINGS.filter((key) => averages?.[key] != null)
  const format = (value: number) => value.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })

  return (
    <div className="px-4 pb-6">
      <EntityHeader
        id={v.id}
        kicker={
          v.venue_type === 'other'
            ? t('entity.kicker.venue')
            : `${t('entity.kicker.venue')} · ${t(`checkin.venueTypes.${v.venue_type}`, { defaultValue: v.venue_type })}`
        }
        name={v.name}
        status={v.status}
        subline={<p>{v.city}, {v.country_code}</p>}
      >
        {v.lat != null && v.lng != null && <MapLink lat={v.lat} lng={v.lng}>{t('entity.route')}</MapLink>}
      </EntityHeader>

      {points.length > 0 && (
        <div className="mt-4">
          <MapSection points={points} tone="social" initiallyOpen />
        </div>
      )}

      <UpcomingSection entity="venue" id={v.id} />
      <PersonalSection entity="venue" id={v.id} />

      {rated.length > 0 && averages && (
        <Section title={t('entity.app')}>
          <BarList
            tone="social"
            max={5}
            rows={rated.map((key) => ({ key, label: t(`venue.rating.${key}`), value: averages[key]!, display: format(averages[key]!) }))}
          />
          {stats.data?.sound_rank != null && (
            <Link to="/best-sound" className="mt-2 inline-flex min-h-touch items-center text-blue">{t('venue.soundRank', { rank: stats.data.sound_rank })}</Link>
          )}
        </Section>
      )}
      {stats.data?.resident && (
        <Section title={t('venue.resident')}>
          <Link to={`/u/${stats.data.resident.username}`} className="flex min-h-touch items-center gap-3">
            <UserAvatar path={stats.data.resident.avatar_path} name={stats.data.resident.display_name} />
            <span className="min-w-0 flex-1 truncate font-medium">{stats.data.resident.display_name}</span>
            <span className="text-sm text-text-secondary">{t('stats.eventCount', { count: stats.data.resident.checkins })}</span>
          </Link>
        </Section>
      )}
      {stats.data && stats.data.top_artists.length > 0 && (
        <Section title={t('stats.topArtists')}>
          <BarList tone="social" rows={stats.data.top_artists.map((a) => ({ key: a.id, label: a.name, value: a.sets, to: `/artists/${a.id}` }))} />
        </Section>
      )}

      <FriendsSection entity="venue" id={v.id} />

      {events.data && events.data.length > 0 && (
        <Section title={t('entity.pastEvents')}>
          <ul>
            {events.data.map((event) => (
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

      <CheckinsSection entity="venue" id={v.id} />
    </div>
  )
}
