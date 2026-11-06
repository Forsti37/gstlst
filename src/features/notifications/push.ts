import { getSupabase } from '../../lib/supabase'
import { detectInstallPlatform, isRunningStandalone } from '../install/platform'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** On iOS, web push only exists in the app installed to the home screen. */
export function pushAvailability(): 'available' | 'needs-install' | 'unsupported' {
  const platform = detectInstallPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  })
  if (platform !== 'other' && !isRunningStandalone()) return 'needs-install'
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return supported && VAPID_PUBLIC_KEY ? 'available' : 'unsupported'
}

export const pushPermission = () => ('Notification' in window ? Notification.permission : 'denied')

function keyToBytes(key: string) {
  const padded = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function enablePush(userId: string) {
  if ((await Notification.requestPermission()) !== 'granted') return false
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY!) }))
  const { endpoint, keys } = subscription.toJSON()
  const { error } = await getSupabase()
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint: endpoint!, keys: keys ?? {} }, { onConflict: 'endpoint' })
  if (error) throw error
  return true
}

export async function disablePush() {
  const subscription = await currentSubscription()
  if (!subscription) return
  await getSupabase().from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
