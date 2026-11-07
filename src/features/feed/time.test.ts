import { relativeTime } from './time'

const now = Date.parse('2026-11-08T12:00:00Z')

describe('relativeTime', () => {
  it('speaks of recent times relatively', () => {
    expect(relativeTime('2026-11-08T11:59:30Z', 'en', now)).toBe('now')
    expect(relativeTime('2026-11-08T11:30:00Z', 'en', now)).toBe('30 minutes ago')
    expect(relativeTime('2026-11-08T09:00:00Z', 'en', now)).toBe('3 hours ago')
    expect(relativeTime('2026-11-06T12:00:00Z', 'de', now)).toBe('vorgestern')
  })

  it('falls back to the date after a week', () => {
    expect(relativeTime('2024-10-26T12:00:00Z', 'en', now)).toBe('Oct 26, 2024')
  })
})
