import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Database } from '../../lib/database.types'
import i18n from '../../lib/i18n'
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase'

export type OwnProfile = Database['public']['Tables']['profiles']['Row']
export type AuthStatus = 'loading' | 'signedOut' | 'onboarding' | 'member' | 'error'

interface AuthValue {
  status: AuthStatus
  session: Session | null
  profile: OwnProfile | null
  signOut: () => Promise<void>
  retry: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function ownProfileKey(userId: string | undefined) {
  return ['ownProfile', userId] as const
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  // undefined: the stored session hasn't been read yet.
  const [session, setSession] = useState<Session | null | undefined>(isSupabaseConfigured ? undefined : null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabase()
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ownProfileKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_own_profile').maybeSingle()
      if (error) throw error
      return data as OwnProfile | null
    },
  })
  const profile = profileQuery.data ?? null
  const language = profile?.language

  useEffect(() => {
    if (language) void i18n.changeLanguage(language)
  }, [language])

  const value = useMemo<AuthValue>(() => {
    let status: AuthStatus
    if (session === undefined) status = 'loading'
    else if (session === null) status = 'signedOut'
    else if (profileQuery.isPending) status = 'loading'
    else if (profileQuery.isError) status = 'error'
    else status = profile ? 'member' : 'onboarding'

    return {
      status,
      session: session ?? null,
      profile,
      retry: () => void profileQuery.refetch(),
      signOut: async () => {
        // Local scope: this also has to work after the account was deleted on the server.
        await getSupabase().auth.signOut({ scope: 'local' })
        queryClient.clear()
      },
    }
  }, [session, profile, profileQuery, queryClient])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

/** For pages behind RequireMember, where a profile always exists. */
export function useMember(): OwnProfile {
  const { profile } = useAuth()
  if (!profile) throw new Error('useMember must be used behind RequireMember')
  return profile
}

export function signInWithGoogle() {
  return getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
  })
}
