/** "3 hours ago" for recent check-ins, the date for older ones. */
export function relativeTime(iso: string, language: string | undefined, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return format.format(0, 'second')
  if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86400) return format.format(Math.round(seconds / 86400), 'day')
  return new Date(iso).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' })
}
