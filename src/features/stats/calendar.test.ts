import { calendarYears, yearGrid } from './calendar'

describe('yearGrid', () => {
  it('starts 2024 on a Monday and counts every day once', () => {
    const grid = yearGrid(2024, [])
    expect(grid[0]![0]?.date).toBe('2024-01-01')
    expect(grid.flat().filter(Boolean)).toHaveLength(366)
    expect(grid.every((week) => week.length === 7)).toBe(true)
  })

  it('pads the first week when the year starts later in the week', () => {
    const grid = yearGrid(2023, [])
    // 1 January 2023 was a Sunday.
    expect(grid[0]!.slice(0, 6)).toEqual(Array(6).fill(null))
    expect(grid[0]![6]?.date).toBe('2023-01-01')
    expect(grid.flat().filter(Boolean)).toHaveLength(365)
  })

  it('puts counts on their day', () => {
    const cells = yearGrid(2024, [{ date: '2024-03-02', events: 2 }]).flat()
    expect(cells.find((cell) => cell?.date === '2024-03-02')?.events).toBe(2)
    expect(cells.find((cell) => cell?.date === '2024-03-03')?.events).toBe(0)
  })
})

describe('calendarYears', () => {
  it('lists years newest first and includes the current one', () => {
    expect(calendarYears([{ date: '2019-05-01', events: 1 }, { date: '2024-01-01', events: 1 }], 2026)).toEqual([2026, 2024, 2019])
  })
})
