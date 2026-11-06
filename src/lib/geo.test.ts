import { describe, expect, it } from 'vitest'
import { distanceKm, isLive, toDateString } from './geo'

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(48.2, 16.3, 48.2, 16.3)).toBeCloseTo(0)
  })

  it('matches the database for Wien to Linz', () => {
    const km = distanceKm(48.2082, 16.3738, 48.2998, 14.2869)
    expect(km).toBeGreaterThan(150)
    expect(km).toBeLessThan(160)
  })
})

describe('isLive', () => {
  const event = { date_start: '2025-06-07', date_end: null }

  it('is live during the night and the next day until 18:00', () => {
    expect(isLive(event, new Date(2025, 5, 7, 23))).toBe(true)
    expect(isLive(event, new Date(2025, 5, 8, 3))).toBe(true)
    expect(isLive(event, new Date(2025, 5, 8, 17, 59))).toBe(true)
  })

  it('is not live before the day or after the window', () => {
    expect(isLive(event, new Date(2025, 5, 6, 23))).toBe(false)
    expect(isLive(event, new Date(2025, 5, 8, 18, 1))).toBe(false)
  })

  it('counts from the last day of a multi-day event', () => {
    expect(isLive({ date_start: '2025-08-13', date_end: '2025-08-15' }, new Date(2025, 7, 16, 12))).toBe(true)
  })

  it('crosses month ends', () => {
    expect(isLive({ date_start: '2025-05-31', date_end: null }, new Date(2025, 5, 1, 12))).toBe(true)
  })
})

describe('toDateString', () => {
  it('uses local time and pads', () => {
    expect(toDateString(new Date(2025, 0, 5, 23, 30))).toBe('2025-01-05')
  })
})
