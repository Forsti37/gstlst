import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'
import type { EventSummary } from '../checkin/api'

const EVENT_FIELDS = 'id, name, date_start, date_end, status, venue:venues(id, name, city, lat, lng, status)'

export const today = () => new Date().toISOString().slice(0, 10)

export function useCounts() {
  return useQuery({
    queryKey: ['discover', 'counts'],
    meta: { persist: true },
    queryFn: async () => {
      const client = getSupabase()
      const count = async (table: 'events' | 'artists' | 'venues' | 'promoters') => {
        const { count: value, error } = await client.from(table).select('id', { count: 'exact', head: true }).eq('status', 'approved')
        if (error) throw error
        return value ?? 0
      }
      const [events, artists, venues, promoters] = await Promise.all([count('events'), count('artists'), count('venues'), count('promoters')])
      return { events, artists, venues, promoters }
    },
  })
}

export function useEvents(direction: 'upcoming' | 'past', limit: number) {
  return useQuery({
    queryKey: ['discover', 'events', direction, limit],
    queryFn: async () => {
      const query = getSupabase().from('events').select(EVENT_FIELDS).eq('lifecycle', 'scheduled')
      const { data, error } =
        direction === 'upcoming'
          ? await query.gte('date_start', today()).order('date_start', { ascending: true }).limit(limit)
          : await query.lt('date_start', today()).order('date_start', { ascending: false }).limit(limit)
      if (error) throw error
      return data as unknown as EventSummary[]
    },
  })
}

export interface BrowseArtist {
  id: string
  name: string
  status: 'pending' | 'approved' | 'rejected'
  genreIds: string[]
}

export function useArtists() {
  return useQuery({
    queryKey: ['discover', 'artists'],
    queryFn: async () => {
      const { data, error } = await getSupabase().from('artists').select('id, name, status, artist_default_genres(genre_id)').order('name')
      if (error) throw error
      return data.map((artist) => ({
        id: artist.id,
        name: artist.name,
        status: artist.status,
        genreIds: artist.artist_default_genres.map((genre) => genre.genre_id),
      })) as BrowseArtist[]
    },
  })
}

export function useVenues() {
  return useQuery({
    queryKey: ['discover', 'venues'],
    queryFn: async () => {
      const { data, error } = await getSupabase().from('venues').select('id, name, city, country_code, venue_type, status, events(count)').order('city').order('name')
      if (error) throw error
      return data as unknown as {
        id: string
        name: string
        city: string
        country_code: string
        venue_type: string
        status: 'pending' | 'approved' | 'rejected'
        events: { count: number }[]
      }[]
    },
  })
}

export function usePromoters() {
  return useQuery({
    queryKey: ['discover', 'promoters'],
    queryFn: async () => {
      const { data, error } = await getSupabase().from('promoters').select('id, name, status, event_promoters(count)').order('name')
      if (error) throw error
      return data as unknown as { id: string; name: string; status: 'pending' | 'approved' | 'rejected'; event_promoters: { count: number }[] }[]
    },
  })
}

export interface SearchHit {
  type: 'event' | 'artist' | 'venue' | 'promoter'
  id: string
  name: string
  detail?: string
}

/** One search over everything you can browse. */
export function useEverythingSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['discover', 'search', trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const client = getSupabase()
      const entities = (type: 'artist' | 'venue' | 'promoter') =>
        client.rpc('search_entities', { entity_type: type, query: trimmed, max_results: 5 }).then(({ data, error }) => {
          if (error) throw error
          return (data ?? []).map((hit) => ({ type, id: hit.id, name: hit.name }) as SearchHit)
        })
      const events = client.rpc('search_events', { query: trimmed, max_results: 5 }).then(({ data, error }) => {
        if (error) throw error
        return (data ?? []).map((hit) => ({ type: 'event', id: hit.id, name: hit.name, detail: `${hit.date_start.slice(0, 4)} · ${hit.venue_name ?? ''}` }) as SearchHit)
      })
      const groups = await Promise.all([events, entities('artist'), entities('venue'), entities('promoter')])
      return groups.flat()
    },
  })
}

/** A genre and everything below it in the tree. */
export function genreFamily(genreId: string, genres: { id: string; parent_id: string | null }[]): Set<string> {
  const family = new Set([genreId])
  let grew = true
  while (grew) {
    grew = false
    for (const genre of genres) {
      if (genre.parent_id && family.has(genre.parent_id) && !family.has(genre.id)) {
        family.add(genre.id)
        grew = true
      }
    }
  }
  return family
}
