import { useMutation, useQuery } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'

export type Persona =
  | 'neuro_purist' | 'liquid_soul' | 'jump_up_menace' | 'closing_crew' | 'warehouse_rat'
  | 'festival_tourist' | 'genre_hopper' | 'road_warrior' | 'local_hero' | 'raver' | 'fresh'

export type CollageItem =
  | { type: 'photo'; path: string }
  | { type: 'tile'; date: string; venue: string; artist: string | null }

export interface WrappedCity {
  city: string
  lat: number
  lng: number
  events: number
}

export interface WrappedData {
  locked?: boolean
  opens?: string
  empty?: boolean
  owner: { username: string; display_name: string; avatar_path: string | null }
  own: boolean
  in_progress: boolean
  period: { kind: string; from: string | null; to: string | null; event_name: string | null }
  numbers: { events: number; sets: number; artists: number; venues: number; cities: number; countries: number; avg_rating: number | null }
  top_artist: { id: string; name: string; sets: number } | null
  top_venue: { id: string; name: string; city: string; events: number } | null
  genres: { label: string; sets: number }[]
  best_set: { rating: number; event: string; artists: string | null } | null
  longest_night: { event: string; date: string; sets: number } | null
  active_month: { month: string; events: number } | null
  new_artists: { count: number; names: string[] }
  persona: Persona
  buddy: { username: string; display_name: string; avatar_path: string | null; events: number } | null
  badges: { id: string; category: string; level: number; name: string }[]
  places: { countries: string[]; cities: WrappedCity[] } | null
  collage: CollageItem[]
}

export interface Spending {
  currency: string
  tickets: number
  other: number
  events: number
}

export interface CommunityWrapped {
  year: number
  events: number
  sets: number
  ravers: number
  top_artist: { id: string; name: string; sets: number } | null
  top_venue: { id: string; name: string; city: string; checkins: number } | null
  best_sound: { id: string; name: string; city: string; rating: number } | null
}

export function useWrapped(username: string | undefined, period: string | undefined) {
  return useQuery({
    queryKey: ['wrapped', username, period],
    enabled: Boolean(username && period),
    retry: false,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_wrapped', { target_username: username!, period: period! })
      if (error) throw error
      return data as unknown as WrappedData | null
    },
  })
}

export function useMySpending(period: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['wrapped', 'spending', period],
    enabled: enabled && Boolean(period),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_my_spending', { period: period! })
      if (error) throw error
      return data as Spending[]
    },
  })
}

export function useMarkShared() {
  return useMutation({
    mutationFn: async (period: string) => {
      const { error } = await getSupabase().rpc('mark_wrapped_shared', { period })
      if (error) throw error
    },
  })
}

export function useCommunityYears() {
  return useQuery({
    queryKey: ['wrapped', 'community'],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('list_community_wrapped')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCommunityWrapped(year: number) {
  return useQuery({
    queryKey: ['wrapped', 'community', year],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_community_wrapped', { for_year: year })
      if (error) throw error
      return data as unknown as CommunityWrapped | null
    },
  })
}
