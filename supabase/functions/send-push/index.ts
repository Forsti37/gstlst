// Sends web push for waiting notifications. Called every minute by public.dispatch_push when
// something is waiting. Deploy with --no-verify-jwt: a shared secret guards it instead.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

type Language = 'en' | 'de'
type Payload = Record<string, unknown>

interface Settings {
  types?: Record<string, boolean>
  quiet_start?: string
  quiet_end?: string
  timezone?: string
}

const SETTING_FOR_TYPE: Record<string, string> = {
  friend_checkin: 'friend_checkin',
  reaction: 'reaction',
  friend_request: 'friend_request',
  friend_accepted: 'friend_request',
  tagged: 'tagged',
  friend_going: 'friend_going',
  wishlist: 'wishlist',
  badge: 'badge',
  data_decision: 'decisions',
  request_decision: 'decisions',
  photo_decision: 'decisions',
}

function message(type: string, p: Payload, language: Language): { body: string; url: string } {
  const de = language === 'de'
  const event = p.event_id ? `events/${p.event_id}` : 'inbox'
  switch (type) {
    case 'friend_checkin': {
      const sets = Number(p.sets ?? 0)
      const detail = sets > 0 ? ` – ${sets} ${de ? 'Sets' : sets === 1 ? 'set' : 'sets'}` : ''
      return { body: `${p.actor} ${de ? 'ist bei' : 'is at'} ${p.event}${detail}`, url: event }
    }
    case 'reaction':
      return { body: de ? `${p.actor} hat auf deinen Check-in bei ${p.event} reagiert` : `${p.actor} reacted to your check-in at ${p.event}`, url: event }
    case 'friend_request':
      return { body: de ? `${p.actor} möchte mit dir befreundet sein` : `${p.actor} wants to be friends`, url: 'friends' }
    case 'friend_accepted':
      return { body: de ? `${p.actor} hat deine Anfrage angenommen` : `${p.actor} accepted your request`, url: `u/${p.username}` }
    case 'tagged':
      return { body: de ? `${p.actor} hat dich bei ${p.event} markiert` : `${p.actor} tagged you at ${p.event}`, url: 'inbox' }
    case 'friend_going':
      return { body: de ? `${p.actor} geht auch zu ${p.event}` : `${p.actor} is also going to ${p.event}`, url: event }
    case 'wishlist':
      return p.kind === 'plays'
        ? { body: de ? `${p.artist} spielt bei ${p.event} in ${p.city}` : `${p.artist} plays ${p.event} in ${p.city}`, url: event }
        : { body: de ? `${p.actor} hat ${p.artist} gesehen` : `${p.actor} saw ${p.artist}`, url: `artists/${p.artist_id}` }
    case 'data_decision':
      if (p.decision === 'approve') return { body: de ? `„${p.name}“ wurde freigegeben` : `“${p.name}” was approved`, url: 'inbox' }
      if (p.decision === 'merge') return { body: de ? `„${p.name}“ wurde zusammengeführt` : `“${p.name}” was merged`, url: 'inbox' }
      return { body: de ? `„${p.name}“ wurde abgelehnt` : `“${p.name}” was rejected`, url: 'inbox' }
    case 'request_decision':
      return { body: de ? 'Über deinen Vorschlag wurde entschieden' : 'Your proposal was reviewed', url: 'inbox' }
    case 'photo_decision':
      return {
        body: p.decision === 'approve' ? (de ? 'Dein Foto wurde freigegeben' : 'Your photo was approved') : (de ? 'Dein Foto wurde abgelehnt' : 'Your photo was rejected'),
        url: 'inbox',
      }
    default:
      return { body: de ? 'Neue Benachrichtigung' : 'New notification', url: 'inbox' }
  }
}

function minutesOf(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function inQuietHours(settings: Settings, now = new Date()) {
  if (!settings.quiet_start || !settings.quiet_end) return false
  const local = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: settings.timezone || 'Europe/Vienna',
  }).format(now)
  const current = minutesOf(local)
  const start = minutesOf(settings.quiet_start)
  const end = minutesOf(settings.quiet_end)
  return start <= end ? current >= start && current < end : current >= start || current < end
}

const HOLD_LIMIT_MS = 12 * 60 * 60 * 1000

Deno.serve(async (request) => {
  if (request.headers.get('x-push-secret') !== Deno.env.get('PUSH_SHARED_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  webpush.setVapidDetails(
    'https://github.com/Forsti37/gstlst',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: waiting, error } = await supabase
    .from('notifications')
    .select('id, recipient_id, type, payload, bundle_key, created_at, updated_at')
    .is('pushed_at', null)
    .order('updated_at')
    .limit(200)
  if (error) return new Response(error.message, { status: 500 })
  if (!waiting?.length) return Response.json({ sent: 0 })

  const recipients = [...new Set(waiting.map((n) => n.recipient_id))]
  const [{ data: subscriptions }, { data: profiles }] = await Promise.all([
    supabase.from('push_subscriptions').select('id, user_id, endpoint, keys').in('user_id', recipients),
    supabase.from('profiles').select('id, language, notification_settings').in('id', recipients),
  ])

  let sent = 0
  const done: string[] = []
  const gone = new Set<string>()

  for (const notification of waiting) {
    const profile = profiles?.find((p) => p.id === notification.recipient_id)
    const settings = (profile?.notification_settings ?? {}) as Settings
    const settingKey = SETTING_FOR_TYPE[notification.type] ?? notification.type
    const targets = subscriptions?.filter((s) => s.user_id === notification.recipient_id && !gone.has(s.id)) ?? []

    if (settings.types?.[settingKey] === false || targets.length === 0) {
      done.push(notification.id)
      continue
    }
    if (inQuietHours(settings)) {
      // Held until the quiet hours end, unless it's too old to be news by then.
      if (Date.now() - new Date(notification.updated_at).getTime() > HOLD_LIMIT_MS) done.push(notification.id)
      continue
    }

    const language: Language = profile?.language === 'de' ? 'de' : 'en'
    const { body, url } = message(notification.type, notification.payload as Payload, language)
    // The same tag replaces the earlier push, which is how bundled updates stay one notification.
    const push = JSON.stringify({ title: 'GSTLST', body, url, tag: notification.bundle_key ?? notification.id })

    for (const target of targets) {
      try {
        await webpush.sendNotification({ endpoint: target.endpoint, keys: target.keys as { p256dh: string; auth: string } }, push, { TTL: 60 * 60 * 12 })
        sent += 1
      } catch (failure) {
        const status = (failure as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.add(target.id)
        else console.error('push failed', status, (failure as Error).message)
      }
    }
    done.push(notification.id)
  }

  if (gone.size > 0) await supabase.from('push_subscriptions').delete().in('id', [...gone])
  if (done.length > 0) await supabase.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', done)
  return Response.json({ sent, done: done.length, removed: gone.size })
})
