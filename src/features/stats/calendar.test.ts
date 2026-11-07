import { calendarYears, monthGrid } from './calendar'

describe('monthGrid', () => {
  it('has twelve months of 31 columns, with the days each month really has', () => {
    const grid = monthGrid(2024, [])
    expect(grid).toHaveLength(12)
    expect(grid.every((month) => month.length === 31)).toBe(true)
    expect(grid[1]!.filter(Boolean)).toHaveLength(29) // 2024 is a leap year
    expect(grid[3]![30]).toBeNull() // April has 30 days
    expect(grid.flat().filter(Boolean)).toHaveLength(366)
  })

  it('puts counts on their day', () => {
    const grid = monthGrid(2024, [{ date: '2024-03-02', events: 2 }])
    expect(grid[2]![1]).toEqual({ date: '2024-03-02', events: 2 })
    expect(grid[2]![2]?.events).toBe(0)
  })
})

describe('calendarYears', () => {
  it('lists only years with events plus the current one, newest first', () => {
    expect(calendarYears([{ date: '2019-05-01', events: 1 }, { date: '2024-01-01', events: 1 }, { date: '2021-01-01', events: 0 }], 2026)).toEqual([2026, 2024, 2019])
  })
})
