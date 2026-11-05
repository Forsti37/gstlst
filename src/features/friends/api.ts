import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'

export interface PublicProfile {
  id: string
  username: string
  display_name: string
  avatar_path: string | null
}

const FRIENDS_KEY = ['friendships']
const BLOCKED_KEY = ['blocked']

/** One row per pair, with the lower id first. The database compares UUIDs the same way. */
export function friendshipPair(a: string, b: string) {
  const [user_a, user_b] = a < b ? [a, b] : [b, a]
  return { user_a, user_b }
}

export function useFriendships() {
  return useQuery({
    queryKey: FRIENDS_KEY,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('list_friendships')
      if (error) throw error
      return data
    },
  })
}

export function useBlocked() {
  return useQuery({
    queryKey: BLOCKED_KEY,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('list_blocked')
      if (error) throw error
      return data
    },
  })
}

export function useProfileByUsername(username: string | undefined) {
  return useQuery({
    queryKey: ['profileByUsername', username],
    enabled: Boolean(username),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_profile_by_username', { target_username: username! }).maybeSingle()
      if (error) throw error
      return data as PublicProfile | null
    },
  })
}

export function useProfileSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['profileSearch', trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('search_profiles', { query: trimmed })
      if (error) throw error
      return data
    },
  })
}

export function useFriendActions(ownId: string) {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: FRIENDS_KEY })
    void queryClient.invalidateQueries({ queryKey: BLOCKED_KEY })
  }

  const request = useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await getSupabase().from('friendships').insert({ ...friendshipPair(ownId, otherId), requested_by: ownId })
      if (error) throw error
    },
    onSettled: refresh,
  })
  const accept = useMutation({
    mutationFn: async (otherId: string) => {
      const pair = friendshipPair(ownId, otherId)
      const { error } = await getSupabase().from('friendships').update({ status: 'accepted' }).match(pair)
      if (error) throw error
    },
    onSettled: refresh,
  })
  // Decline, cancel and remove are all the same delete.
  const remove = useMutation({
    mutationFn: async (otherId: string) => {
      const pair = friendshipPair(ownId, otherId)
      const { error } = await getSupabase().from('friendships').delete().match(pair)
      if (error) throw error
    },
    onSettled: refresh,
  })
  const block = useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await getSupabase().from('blocks').insert({ blocker_id: ownId, blocked_id: otherId })
      if (error) throw error
    },
    onSettled: refresh,
  })
  const unblock = useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await getSupabase().from('blocks').delete().match({ blocker_id: ownId, blocked_id: otherId })
      if (error) throw error
    },
    onSettled: refresh,
  })

  return { request, accept, remove, block, unblock }
}
