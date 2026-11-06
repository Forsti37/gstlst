import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'

export const DIMENSIONS = ['artist', 'genre', 'subgenre', 'venue', 'city', 'country', 'promoter', 'series', 'set_type', 'tag', 'month', 'year', 'weekday'] as const
export type Dimension = (typeof DIMENSIONS)[number]

export interface StatRow {
  key: string
  label: string
  events: number
  sets: number
  avg_rating: number | null
}

export interface ProfileStats {
  headline: {
    events: number
    sets: number
    artists: number
    venues: number
    cities: number
    countries: number
    promoters: number
    avg_rating: number | null
    verified: number
  }
  genres: StatRow[]
  top_artists: StatRow[]
  top_venues: StatRow[]
  top_promoters: StatRow[]
  b2b: { label: string; sets: number }[]
  calendar: { date: string; events: number }[]
  streaks: { longest: number; current: number }
  travel_km: number | null
  travel_missing?: 'checkins' | 'home'
}

export interface PersonStat {
  username: string
  display_name: string
  avatar_path: string | null
}

export interface LinkedName {
  id: string
  name: string
}

export interface ArtistStats {
  checkins: number
  avg_rating: number | null
  my_sets: number
  my_avg_rating: number | null
  aliases: string[]
  members: LinkedName[]
  groups: LinkedName[]
  genres: string[]
  partners: (LinkedName & { sets: number })[]
  top_fans: (PersonStat & { sets: number })[]
}

export interface VenueStats {
  checkins: number
  my_events: number
  averages: Record<'overall' | 'sound' | 'crowd' | 'location' | 'lineup', number | null>
  sound_rank: number | null
  top_artists: (LinkedName & { sets: number })[]
  resident: (PersonStat & { checkins: number }) | null
}

export interface Comparison {
  events_together: number
  sets_together: number
  taste_match: number | null
  shared_artists: (LinkedName & { mine: number; theirs: number })[]
}

export interface ExploreQuery {
  userId: string
  dimension: Dimension
  from: string
  to: string
  filters: Partial<Record<Dimension, string>>
  verifiedOnly: boolean
}

export function useProfileStats(userId: string, own: boolean) {
  return useQuery({
    queryKey: ['stats', 'profile', userId],
    meta: { persist: own },
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_profile_stats', { target_user: userId })
      if (error) throw error
      return data as unknown as ProfileStats | null
    },
  })
}

export function useProfileMap(userId: string) {
  return useQuery({
    queryKey: ['stats', 'map', userId],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_profile_map', { target_user: userId })
      if (error) throw error
      return data
    },
  })
}

export function useExplore({ userId, dimension, from, to, filters, verifiedOnly }: ExploreQuery) {
  return useQuery({
    queryKey: ['stats', 'explore', userId, dimension, from, to, filters, verifiedOnly],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('explore_stats', {
        target_user: userId,
        dimension,
        date_from: from || undefined,
        date_to: to || undefined,
        filters,
        verified_only: verifiedOnly,
      })
      if (error) throw error
      return data as StatRow[]
    },
  })
}

export function useLeaderboard(year: number | null) {
  return useQuery({
    queryKey: ['stats', 'leaderboard', year],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('friends_leaderboard', { for_year: year ?? undefined })
      if (error) throw error
      return data
    },
  })
}

export function useComparison(userId: string) {
  return useQuery({
    queryKey: ['stats', 'compare', userId],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('compare_with', { target_user: userId })
      if (error) throw error
      return data as unknown as Comparison | null
    },
  })
}

export function useArtistStats(artistId: string | undefined) {
  return useQuery({
    queryKey: ['stats', 'artist', artistId],
    enabled: Boolean(artistId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_artist_stats', { target_artist: artistId! })
      if (error) throw error
      return data as unknown as ArtistStats | null
    },
  })
}

export function useVenueStats(venueId: string | undefined) {
  return useQuery({
    queryKey: ['stats', 'venue', venueId],
    enabled: Boolean(venueId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_venue_stats', { target_venue: venueId! })
      if (error) throw error
      return data as unknown as VenueStats | null
    },
  })
}

export function useBestSound() {
  return useQuery({
    queryKey: ['stats', 'best-sound'],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('best_sound_ranking')
      if (error) throw error
      return data
    },
  })
}
