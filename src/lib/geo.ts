export interface Position {
  lat: number
  lng: number
  capturedAt: string
}

/** Great-circle distance. Runs on the device, so that suggestions don't reveal the location. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = radians(bLat - aLat)
  const dLng = radians(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Resolves to null when it's denied, unavailable or slow: nothing may wait on GPS. */
export function getPosition(timeoutMs = 6000): Promise<Position | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          capturedAt: new Date(position.timestamp).toISOString(),
        }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}

export async function hasLocationPermission() {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'
  } catch {
    return false
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** yyyy-mm-dd in local time. */
export const toDateString = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Mirrors public.event_live_until without a timetable: until 18:00 the day after the last night. */
export function isLive(event: { date_start: string; date_end: string | null }, now = new Date()) {
  const [year = 0, month = 1, day = 1] = (event.date_end ?? event.date_start).split('-').map(Number)
  const start = new Date(`${event.date_start}T00:00:00`)
  return now >= start && now <= new Date(year, month - 1, day + 1, 18)
}
