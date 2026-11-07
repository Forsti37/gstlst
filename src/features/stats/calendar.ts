export interface CalendarCell {
  date: string
  events: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * One row per month, one column per day of the month. A year then fits the width of a phone
 * without scrolling sideways. Days a month doesn't have stay null.
 */
export function monthGrid(year: number, days: CalendarCell[]): (CalendarCell | null)[][] {
  const counts = new Map(days.map((day) => [day.date, day.events]))
  return Array.from({ length: 12 }, (_, month) => {
    const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return Array.from({ length: 31 }, (_, index) => {
      if (index >= length) return null
      const date = `${year}-${pad(month + 1)}-${pad(index + 1)}`
      return { date, events: counts.get(date) ?? 0 }
    })
  })
}

/** Only years with events, plus the current one, newest first. */
export function calendarYears(days: CalendarCell[], currentYear: number): number[] {
  const years = new Set(days.filter((day) => day.events > 0).map((day) => Number(day.date.slice(0, 4))))
  years.add(currentYear)
  return [...years].sort((a, b) => b - a)
}
