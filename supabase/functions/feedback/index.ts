// In-app feedback: stored in the database, then filed as a GitHub issue.
// The repo is public, so the issue carries only the text, the app version and the device,
// never who sent it. Set the token with: npx supabase secrets set GITHUB_TOKEN=... --project-ref <ref>
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json(401, { error: 'not_authenticated' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const client = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) return json(401, { error: 'not_authenticated' })

  const body = (await request.json().catch(() => null)) as { text?: unknown; appVersion?: unknown; device?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 4000) return json(400, { error: 'invalid_text' })
  const appVersion = typeof body?.appVersion === 'string' ? body.appVersion.slice(0, 40) : null
  const device = typeof body?.device === 'string' ? body.device.slice(0, 300) : null

  // Runs as the user, so that RLS decides: only members with a profile can send feedback.
  const id = crypto.randomUUID()
  const { error: insertError } = await client
    .from('feedback')
    .insert({ id, user_id: userData.user.id, text, app_version: appVersion, device })
  if (insertError) return json(403, { error: 'not_allowed' })

  const token = Deno.env.get('GITHUB_TOKEN')
  if (!token) return json(200, { saved: true, issue: null })

  const issue = await fetch('https://api.github.com/repos/Forsti37/gstlst/issues', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gstlst-feedback',
    },
    body: JSON.stringify({
      title: `Feedback: ${text.slice(0, 60)}`,
      body: `${text}\n\n---\nApp version: ${appVersion ?? 'unknown'}\nDevice: ${device ?? 'unknown'}`,
      labels: ['feedback'],
    }),
  })
  // The feedback is saved either way, so a GitHub problem isn't an error for the sender.
  if (!issue.ok) return json(200, { saved: true, issue: null })
  const created = (await issue.json()) as { html_url: string }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceKey) {
    await createClient(supabaseUrl, serviceKey).from('feedback').update({ github_issue_url: created.html_url }).eq('id', id)
  }
  return json(200, { saved: true, issue: created.html_url })
})
