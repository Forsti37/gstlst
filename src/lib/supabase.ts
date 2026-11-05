import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && publishableKey)

let client: SupabaseClient<Database> | undefined

/**
 * The shared Supabase client, created on first use so that the app shell still runs
 * before the Supabase projects exist. Which project it talks to depends on the Vite
 * mode: .env.development.local for dev, the prod values for builds.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!url || !publishableKey) {
    throw new Error('Supabase is not configured: set the variables from .env.example.')
  }
  client ??= createClient<Database>(url, publishableKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}
