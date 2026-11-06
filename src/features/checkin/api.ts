import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'
import { queuedCheckinFor } from '../offline/queue'

export type Status = 'pending' | 'approved' | 'rejected'
export type SetType = 'solo' | 'b2b' | 'b2b2b' | 'f2f' | 'live' | 'hybrid'
export type Visibility = 'public' | 'friends' | 'private'

export interface VenueSummary {
  id: string
  name: string
  city: string
  lat: number | null
  lng: number | null
  status: Status
}

export interface EventSummary {
  id: string
  name: string
  date_start: string
  date_end: string | null
  status: Status
  venue: VenueSummary | null
}

export interface EventDetail extends EventSummary {
  series: { id: string; name: string } | null
  event_promoters: { promoter: { id: string; name: string } | null }[]
  event_event_tags: { tag: { id: string; name: string } | null }[]
}

export interface LineupArtist {
  role: 'dj' | 'live' | 'mc'
  artist: { id: string; name: string; status: Status; artist_default_genres: { genre_id: string }[] } | null
}

export interface LineupSet {
  id: string
  floor_id: string | null
  set_type: SetType
  start_at: string | null
  end_at: string | null
  status: Status
  set_artists: LineupArtist[]
}

export interface Floor {
  id: string
  name: string
  sort: number
}

export interface Lineup {
  floors: Floor[]
  sets: LineupSet[]
}

export interface CheckinListItem {
  id: string
  rating: number | null
  verified_gps: boolean
  verified_admin: boolean
  imported: boolean
  event: EventSummary | null
  set_checkins: { id: string; rating: number | null }[]
}

export interface CheckinDetail {
  id: string
  user_id: string
  rating: number | null
  rating_sound: number | null
  rating_crowd: number | null
  rating_location: number | null
  rating_lineup: number | null
  text: string | null
  visibility: Visibility | null
  verified_gps: boolean
  verified_admin: boolean
  imported: boolean
  event: EventSummary | null
  set_checkins: {
    id: string
    set_id: string
    rating: number | null
    text: string | null
    imported: boolean
    set: LineupSet | null
    media: { id: string; storage_path: string; moderation_status: Status }[]
  }[]
}

const EVENT_SUMMARY = 'id, name, date_start, date_end, status, venue:venues(id, name, city, lat, lng, status)'
const SET_FIELDS = 'id, floor_id, set_type, start_at, end_at, status, set_artists(role, artist:artists(id, name, status, artist_default_genres(genre_id)))'

export const eventKey = (id: string | undefined) => ['event', id] as const
export const lineupKey = (id: string | undefined) => ['lineup', id] as const

export function useEventsAround(today: string, yesterday: string) {
  return useQuery({
    queryKey: ['eventsAround', today],
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('events')
        .select(EVENT_SUMMARY)
        .lte('date_start', today)
        .or(`date_start.gte.${yesterday},date_end.gte.${yesterday}`)
        .order('date_start', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as unknown as EventSummary[]
    },
  })
}

export function useRecentEvents(limit = 30) {
  return useQuery({
    queryKey: ['recentEvents', limit],
    queryFn: async () => {
      const { data, error } = await getSupabase().from('events').select(EVENT_SUMMARY).order('date_start', { ascending: false }).limit(limit)
      if (error) throw error
      return data as unknown as EventSummary[]
    },
  })
}

export function useEventSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['eventSearch', trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('search_events', { query: trimmed })
      if (error) throw error
      return data
    },
  })
}

export async function fetchEvent(id: string) {
  const { data, error } = await getSupabase()
    .from('events')
    .select(`${EVENT_SUMMARY}, series:event_series(id, name), event_promoters(promoter:promoters(id, name)), event_event_tags(tag:tags(id, name))`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as EventDetail | null
}

export function useEvent(id: string | undefined, placeholder?: EventSummary) {
  return useQuery({
    queryKey: eventKey(id),
    enabled: Boolean(id),
    meta: { persist: true },
    placeholderData: placeholder ? ({ ...placeholder, series: null, event_promoters: [], event_event_tags: [] } satisfies EventDetail) : undefined,
    queryFn: () => fetchEvent(id!),
  })
}

export async function fetchLineup(eventId: string): Promise<Lineup> {
  const supabase = getSupabase()
  const [floors, sets] = await Promise.all([
    supabase.from('floors').select('id, name, sort').eq('event_id', eventId).order('sort'),
    supabase.from('sets').select(SET_FIELDS).eq('event_id', eventId),
  ])
  if (floors.error) throw floors.error
  if (sets.error) throw sets.error
  return { floors: floors.data, sets: sets.data as unknown as LineupSet[] }
}

export function useLineup(eventId: string | undefined) {
  return useQuery({
    queryKey: lineupKey(eventId),
    enabled: Boolean(eventId),
    meta: { persist: true },
    queryFn: () => fetchLineup(eventId!),
  })
}

export function useEventRatings(eventId: string | undefined) {
  return useQuery({
    queryKey: ['eventRatings', eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('event_set_ratings', { target_event: eventId! })
      if (error) throw error
      return new Map(data.map((row) => [row.set_id, row]))
    },
  })
}

/** The user's check-in for an event, also while it's still waiting in the queue. */
export function useOwnCheckin(userId: string, eventId: string | undefined) {
  return useQuery({
    queryKey: ['ownCheckin', userId, eventId],
    enabled: Boolean(eventId),
    meta: { persist: true },
    staleTime: 0,
    queryFn: async () => {
      const queued = await queuedCheckinFor(userId, eventId!)
      const { data, error } = await getSupabase()
        .from('event_checkins')
        .select('id, set_checkins(set_id)')
        .eq('user_id', userId)
        .eq('event_id', eventId!)
        .maybeSingle()
      if (error && !queued) throw error
      if (data) return { id: data.id, setIds: data.set_checkins.map((s) => s.set_id) }
      return queued ? { id: queued, setIds: [] } : null
    },
  })
}

export function useMyCheckins(userId: string) {
  return useQuery({
    queryKey: ['myCheckins', userId],
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('event_checkins')
        .select(`id, rating, verified_gps, verified_admin, imported, event:events(${EVENT_SUMMARY}), set_checkins(id, rating)`)
        .eq('user_id', userId)
        .limit(1000)
      if (error) throw error
      const items = data as unknown as CheckinListItem[]
      return items.sort((a, b) => (b.event?.date_start ?? '').localeCompare(a.event?.date_start ?? ''))
    },
  })
}

export function useCheckinDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['checkin', id],
    enabled: Boolean(id),
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('event_checkins')
        .select(`id, user_id, rating, rating_sound, rating_crowd, rating_location, rating_lineup, text, visibility, verified_gps, verified_admin, imported,
          event:events(${EVENT_SUMMARY}),
          set_checkins(id, set_id, rating, text, imported, set:sets(${SET_FIELDS}), media(id, storage_path, moderation_status))`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as CheckinDetail | null
    },
  })
}

/** Signed URLs for photos in the private bucket, by storage path. */
export function useMediaUrls(paths: string[]) {
  return useQuery({
    queryKey: ['mediaUrls', paths.join(',')],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await getSupabase().storage.from('media').createSignedUrls(paths, 60 * 60)
      if (error) throw error
      return new Map(data.flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])))
    },
  })
}

export function usePrivateData(checkinId: string | undefined) {
  return useQuery({
    queryKey: ['privateData', checkinId],
    enabled: Boolean(checkinId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('private_checkin_data').select('*').eq('event_checkin_id', checkinId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useReferenceData() {
  const genres = useQuery({
    queryKey: ['genres'],
    meta: { persist: true },
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('genres').select('id, name, parent_id').order('name')
      if (error) throw error
      return data
    },
  })
  const tags = useQuery({
    queryKey: ['tags'],
    meta: { persist: true },
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('tags').select('id, name, scope, status').order('name')
      if (error) throw error
      return data
    },
  })
  return { genres: genres.data ?? [], tags: tags.data ?? [] }
}

/** "Fred V b2b Etherwood ft. MC Flow". */
export function setLabel(set: Pick<LineupSet, 'set_type' | 'set_artists'>) {
  const names = (role: LineupArtist['role'][]) =>
    set.set_artists.filter((a) => role.includes(a.role) && a.artist).map((a) => a.artist!.name)
  const separator = set.set_type === 'f2f' ? ' f2f ' : ' b2b '
  const main = names(['dj', 'live']).join(separator)
  const mcs = names(['mc'])
  return mcs.length > 0 ? `${main} ft. ${mcs.join(', ')}` : main
}

export function formatEventDate(event: Pick<EventSummary, 'date_start' | 'date_end'>, locale?: string) {
  const format = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  return event.date_end && event.date_end !== event.date_start
    ? `${format(event.date_start)} – ${format(event.date_end)}`
    : format(event.date_start)
}

/** Sets grouped by floor, by time within a floor, with sets without a floor at the end. */
export function groupByFloor(lineup: Lineup) {
  const byTime = (a: LineupSet, b: LineupSet) => (a.start_at ?? '').localeCompare(b.start_at ?? '') || setLabel(a).localeCompare(setLabel(b))
  const groups = lineup.floors
    .map((floor) => ({ floor: floor as Floor | null, sets: lineup.sets.filter((s) => s.floor_id === floor.id).sort(byTime) }))
    .filter((group) => group.sets.length > 0)
  const known = new Set(lineup.floors.map((f) => f.id))
  const rest = lineup.sets.filter((s) => !s.floor_id || !known.has(s.floor_id)).sort(byTime)
  if (rest.length > 0) groups.push({ floor: null, sets: rest })
  return groups
}

export function isPlayingNow(set: Pick<LineupSet, 'start_at' | 'end_at'>, now = new Date()) {
  if (!set.start_at || !set.end_at) return false
  return now >= new Date(set.start_at) && now <= new Date(set.end_at)
}
