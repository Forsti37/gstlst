export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
export type Season = (typeof SEASONS)[number]

export type PeriodLabel =
  | { key: 'year'; year: string }
  | { key: 'month'; year: string; month: number }
  | { key: 'season'; year: string; season: Season }
  | { key: 'range'; from: string; to: string }
  | { key: 'event' }
  | { key: 'unknown' }

/** Reads the same formats as the database: 2025, 2025-03, 2025-summer, 2025-01-01_2025-03-31, event-<id>. */
export function describePeriod(period: string): PeriodLabel {
  if (/^\d{4}$/.test(period)) return { key: 'year', year: period }
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (month) return { key: 'month', year: month[1]!, month: Number(month[2]) }
  const season = /^(\d{4})-(spring|summer|autumn|winter)$/.exec(period)
  if (season) return { key: 'season', year: season[1]!, season: season[2] as Season }
  const range = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(period)
  if (range) return { key: 'range', from: range[1]!, to: range[2]! }
  if (period.startsWith('event-')) return { key: 'event' }
  return { key: 'unknown' }
}

export const isYearOpen = (year: number, today = new Date()) =>
  today.getFullYear() > year || (today.getFullYear() === year && today.getMonth() === 11)

/** Places on a 0 to 1 square, keeping proportions. A straight projection is plenty at this zoom. */
export function projectPlaces<T extends { lat: number; lng: number }>(places: T[]): (T & { x: number; y: number })[] {
  if (places.length === 0) return []
  const lats = places.map((p) => p.lat)
  const lngs = places.map((p) => p.lng)
  const middle = (Math.min(...lats) + Math.max(...lats)) / 2
  const stretch = Math.cos((middle * Math.PI) / 180)
  const width = (Math.max(...lngs) - Math.min(...lngs)) * stretch
  const height = Math.max(...lats) - Math.min(...lats)
  const scale = Math.max(width, height) || 1
  return places.map((p) => ({
    ...p,
    x: 0.5 + ((p.lng - Math.min(...lngs)) * stretch - width / 2) / scale,
    y: 0.5 - (p.lat - Math.min(...lats) - height / 2) / scale,
  }))
}

/** Columns for a roughly even grid of n items in a 9:16 slide. */
export const collageColumns = (n: number) => Math.max(2, Math.min(10, Math.ceil(Math.sqrt(n * 0.6))))
