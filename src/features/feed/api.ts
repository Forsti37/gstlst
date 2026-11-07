import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getPosition, hasLocationPermission } from '../../lib/geo'
import { getSupabase } from '../../lib/supabase'
import type { LineupSet, SetType, Status } from '../checkin/api'

export type ReactionKind = 'bassface' | 'dance' | 'fire'
export type ReactionTarget = 'event_checkin' | 'set_checkin'

export interface ReactionSummary {
  bassface: number
  dance: number
  fire: number
  mine: ReactionKind | null
}

export interface FeedSet {
  id: string
  rating: number | null
  text: string | null
  status: Status
  set_type: SetType
  set_artists: LineupSet['set_artists']
  reactions: ReactionSummary
}

export interface FeedCard {
  id: string
  created_at: string
  /** History from the import: shown with its event date and sorted by it. */
  imported?: boolean
  /** The sort key of the friends feed, and its paging cursor. */
  feed_time?: string
  rating: number | null
  rating_sound: number | null
  rating_crowd: number | null
  rating_location: number | null
  rating_lineup: number | null
  text: string | null
  verified: boolean
  user: { id: string; username: string; display_name: string; avatar_path: string | null }
  event: { id: string; name: string; date_start: string; date_end: string | null; status: Status; venue_name: string; venue_city: string }
  reactions: ReactionSummary
  badges?: { id: string; category: string; level: number; name: string }[]
  companions: { username: string; display_name: string }[]
  photos: string[]
  sets: FeedSet[]
}

const PAGE_SIZE = 15

export function useFriendsFeed() {
  return useInfiniteQuery({
    queryKey: ['feed', 'friends'],
    meta: { persist: true },
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getSupabase().rpc('get_friends_feed', { before_time: pageParam ?? undefined, page_size: PAGE_SIZE })
      if (error) throw error
      return data as unknown as FeedCard[]
    },
    getNextPageParam: (last) => (last.length === PAGE_SIZE ? (last[last.length - 1]!.feed_time ?? last[last.length - 1]!.created_at) : undefined),
  })
}

/** Only a position rounded to about 10 km leaves the device, and only if GPS is already allowed. */
function useRoughPosition() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    void hasLocationPermission().then(async (granted) => {
      if (!granted) return
      const exact = await getPosition()
      if (exact) setPosition({ lat: Math.round(exact.lat * 10) / 10, lng: Math.round(exact.lng * 10) / 10 })
    })
  }, [])
  return position
}

export function usePublicFeed() {
  const position = useRoughPosition()
  return useInfiniteQuery({
    queryKey: ['feed', 'public', position?.lat, position?.lng],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getSupabase().rpc('get_public_feed', {
        page_offset: pageParam,
        page_size: PAGE_SIZE,
        near_lat: position?.lat,
        near_lng: position?.lng,
      })
      if (error) throw error
      return data as unknown as FeedCard[]
    },
    getNextPageParam: (last, _pages, offset) => (last.length === PAGE_SIZE ? offset + PAGE_SIZE : undefined),
  })
}
