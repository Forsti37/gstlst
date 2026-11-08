import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import type { FeedCard } from '../feed/api'

export type Entity = 'artist' | 'venue' | 'promoter'

export interface Personal {
  count: number
  avg_rating: number | null
  last: { event_id: string; name: string; date_start: string } | null
  friends: { username: string; display_name: string; avatar_path: string | null; times: number }[]
}

export function usePersonal(entity: Entity, id: string | undefined) {
  return useQuery({
    queryKey: ['entity', 'personal', entity, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_entity_personal', { entity, target: id! })
      if (error) throw error
      return data as unknown as Personal | null
    },
  })
}

export function useUpcoming(entity: Entity, id: string | undefined) {
  return useQuery({
    queryKey: ['entity', 'upcoming', entity, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_entity_upcoming', { entity, target: id! })
      if (error) throw error
      return data
    },
  })
}

const PAGE_SIZE = 10

export function useEntityCheckins(entity: Entity, id: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['entity', 'checkins', entity, id],
    enabled: Boolean(id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getSupabase().rpc('get_entity_checkins', { entity, target: id!, before_time: pageParam ?? undefined, page_size: PAGE_SIZE })
      if (error) throw error
      return data as unknown as FeedCard[]
    },
    getNextPageParam: (last) => {
      const end = last[last.length - 1]
      return last.length === PAGE_SIZE && end ? (end.feed_time ?? end.created_at) : undefined
    },
  })
}

export interface PromoterStats {
  events: number
  checkins: number
  top_artists: { id: string; name: string; events: number }[]
  venues: { id: string; name: string; city: string; events: number }[]
  series: { id: string; name: string; editions: number }[]
}

export function usePromoterStats(id: string | undefined) {
  return useQuery({
    queryKey: ['entity', 'promoterStats', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_promoter_stats', { target_promoter: id! })
      if (error) throw error
      return data as unknown as PromoterStats | null
    },
  })
}

/** "I'm going" for one event, as on the event page. */
export function useGoing(eventId: string) {
  const me = useMember()
  const queryClient = useQueryClient()
  const key = ['going', eventId]
  const going = useQuery({
    queryKey: key,
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase().from('going').select('user_id').eq('event_id', eventId)
      if (error) throw error
      return data
    },
  })
  const mine = going.data?.some((row) => row.user_id === me.id) ?? false
  const toggle = useMutation({
    mutationFn: async () => {
      const table = getSupabase().from('going')
      const { error } = mine ? await table.delete().match({ user_id: me.id, event_id: eventId }) : await table.insert({ user_id: me.id, event_id: eventId })
      if (error) throw error
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  })
  return { mine, friends: Math.max(0, (going.data?.length ?? 0) - (mine ? 1 : 0)), toggle, loading: going.isPending }
}
