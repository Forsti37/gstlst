import { collageColumns, describePeriod, isYearOpen, projectPlaces } from './period'

describe('describePeriod', () => {
  it('reads every kind of period', () => {
    expect(describePeriod('2025')).toEqual({ key: 'year', year: '2025' })
    expect(describePeriod('2025-03')).toEqual({ key: 'month', year: '2025', month: 3 })
    expect(describePeriod('2025-winter')).toEqual({ key: 'season', year: '2025', season: 'winter' })
    expect(describePeriod('2025-01-01_2025-03-31')).toEqual({ key: 'range', from: '2025-01-01', to: '2025-03-31' })
    expect(describePeriod('event-abc')).toEqual({ key: 'event' })
    expect(describePeriod('nonsense')).toEqual({ key: 'unknown' })
  })
})

describe('isYearOpen', () => {
  it('opens a year on December 1st', () => {
    expect(isYearOpen(2026, new Date(2026, 10, 30))).toBe(false)
    expect(isYearOpen(2026, new Date(2026, 11, 1))).toBe(true)
    expect(isYearOpen(2025, new Date(2026, 0, 1))).toBe(true)
    expect(isYearOpen(2027, new Date(2026, 11, 31))).toBe(false)
  })
})

describe('projectPlaces', () => {
  it('centers a single place', () => {
    expect(projectPlaces([{ lat: 48, lng: 16 }])[0]).toMatchObject({ x: 0.5, y: 0.5 })
  })

  it('stays on the square and puts north at the top', () => {
    const [north, south] = projectPlaces([{ lat: 52, lng: 13 }, { lat: 47, lng: 16 }])
    expect(north!.y).toBeLessThan(south!.y)
    for (const place of [north!, south!]) {
      expect(place.x).toBeGreaterThanOrEqual(0)
      expect(place.x).toBeLessThanOrEqual(1)
      expect(place.y).toBeGreaterThanOrEqual(0)
      expect(place.y).toBeLessThanOrEqual(1)
    }
  })
})

describe('collageColumns', () => {
  it('grows with the number of items, within limits', () => {
    expect(collageColumns(1)).toBe(2)
    expect(collageColumns(78)).toBe(7)
    expect(collageColumns(5000)).toBe(10)
  })
})
