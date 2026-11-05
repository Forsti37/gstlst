import type { Page, Route } from '@playwright/test'

const USER_ID = '00000000-0000-4000-a000-0000000000e1'
export const OTHER_ID = '00000000-0000-4000-a000-0000000000e2'

export const memberProfile = {
  id: USER_ID,
  username: 'e2e_raver',
  display_name: 'E2E Raver',
  avatar_path: null,
  home_city: null,
  birth_year: 1995,
  role: 'user',
  language: 'en',
  privacy: { profile: 'friends' },
  terms_accepted_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-expose-headers': '*',
}

interface MockState {
  profile: typeof memberProfile | null
  friendships: { id: string; username: string; display_name: string; avatar_path: null; status: string; requested_by: string }[]
  rpcCalls: Record<string, unknown>[]
  friendshipInserts: unknown[]
  signupError: string | null
}

/** Answers Supabase calls in the browser, so that the UI runs without Google or a database. */
export async function mockBackend(page: Page, options: { signedIn: boolean; profile?: typeof memberProfile | null; signupError?: string }) {
  const state: MockState = {
    profile: options.profile ?? null,
    friendships: [],
    rpcCalls: [],
    friendshipInserts: [],
    signupError: options.signupError ?? null,
  }

  if (options.signedIn) {
    await page.addInitScript((userId) => {
      localStorage.setItem(
        'sb-127-auth-token',
        JSON.stringify({
          access_token: 'e2e-token',
          refresh_token: 'e2e-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'e2e@test.invalid', app_metadata: {}, user_metadata: { full_name: 'E2E Raver' }, created_at: '2026-01-01T00:00:00Z' },
        }),
      )
    }, USER_ID)
  }

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })

  // Answers the way PostgREST does for .maybeSingle().
  const rows = (route: Route, list: unknown[]) => {
    const wantsObject = route.request().headers().accept?.includes('vnd.pgrst.object')
    if (!wantsObject) return json(route, 200, list)
    if (list.length === 0) return json(route, 406, { code: 'PGRST116', message: 'no rows', details: 'The result contains 0 rows', hint: null })
    return json(route, 200, list[0])
  }

  await page.route('http://127.0.0.1:54399/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const path = new URL(request.url()).pathname

    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length)
      const args = request.postDataJSON() as Record<string, unknown> | null
      state.rpcCalls.push({ name, ...args })
      switch (name) {
        case 'get_own_profile':
          return rows(route, state.profile ? [state.profile] : [])
        case 'complete_signup':
          if (state.signupError) return json(route, 400, { code: 'P0001', message: state.signupError, details: null, hint: null })
          state.profile = { ...memberProfile, username: String(args?.username), display_name: String(args?.display_name) }
          return json(route, 200, state.profile)
        case 'get_profile_by_username':
          return rows(route, args?.target_username === 'lisa' ? [{ id: OTHER_ID, username: 'lisa', display_name: 'Lisa', avatar_path: null }] : [])
        case 'list_friendships':
          return json(route, 200, state.friendships)
        case 'list_blocked':
        case 'search_profiles':
          return json(route, 200, [])
        case 'delete_own_account':
          state.profile = null
          return json(route, 200, null)
        default:
          return json(route, 200, null)
      }
    }
    if (path === '/rest/v1/friendships' && request.method() === 'POST') {
      state.friendshipInserts.push(request.postDataJSON())
      state.friendships = [{ id: OTHER_ID, username: 'lisa', display_name: 'Lisa', avatar_path: null, status: 'pending', requested_by: USER_ID }]
      return json(route, 201, null)
    }
    if (path === '/rest/v1/profiles' && request.method() === 'PATCH') {
      if (state.profile) state.profile = { ...state.profile, ...(request.postDataJSON() as object) }
      return json(route, 204, null)
    }
    if (path === '/rest/v1/invite_codes') {
      return json(route, 200, [{ code: 'abc123', created_by: USER_ID, max_uses: 1, used_count: 0, expires_at: null, created_at: '2026-01-01T00:00:00Z' }])
    }
    if (path.startsWith('/auth/v1/')) return json(route, 200, {})
    return json(route, 200, [])
  })

  return state
}
