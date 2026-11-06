import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'

export interface Badge {
  id: string
  name: string
  description: string
  description_de: string | null
  category: string
  levels: number[]
  level_names: string[] | null
  valid_from: string | null
  valid_to: string | null
  level: number
  /** Only for your own badges: someone else's progress could reveal private check-ins. */
  value: number | null
  awarded_at: string | null
}

export const CATEGORIES = ['starter', 'genre', 'set_format', 'time', 'season', 'places', 'loyalty', 'discovery', 'community', 'verified', 'limited'] as const

export function useBadges(userId: string) {
  return useQuery({
    queryKey: ['badges', userId],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_badges', { target_user: userId })
      if (error) throw error
      return data as unknown as Badge[]
    },
  })
}

export interface FunFact {
  id: string
  kind: string
  payload: Record<string, string | number>
}

export function useFunFacts(checkinId: string | undefined) {
  return useQuery({
    queryKey: ['funFacts', checkinId],
    enabled: Boolean(checkinId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('checkin_fun_facts').select('id, kind, payload').eq('checkin_id', checkinId!)
      if (error) throw error
      return data as unknown as FunFact[]
    },
  })
}

export const levelName = (badge: Pick<Badge, 'name' | 'level_names'>, level: number) => badge.level_names?.[level - 1] ?? badge.name

/** The next threshold, or null at the top level. */
export const nextThreshold = (badge: Pick<Badge, 'levels' | 'level'>) => badge.levels[badge.level] ?? null
