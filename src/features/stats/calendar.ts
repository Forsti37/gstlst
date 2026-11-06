export interface CalendarCell {
  date: string
  events: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The weeks of a year as columns, Monday first. Days outside the year stay null to keep the rows aligned. */
export function yearGrid(year: number, days: CalendarCell[]): (CalendarCell | null)[][] {
  const counts = new Map(days.map((day) => [day.date, day.events]))
  const weeks: (CalendarCell | null)[][] = []
  // UTC, so that no daylight saving change can skip or repeat a day.
  const cursor = new Date(Date.UTC(year, 0, 1))
  let week: (CalendarCell | null)[] = Array<null>((cursor.getUTCDay() + 6) % 7).fill(null)
  while (cursor.getUTCFullYear() === year) {
    const date = `${year}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`
    week.push({ date, events: counts.get(date) ?? 0 })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  if (week.length > 0) weeks.push([...week, ...Array<null>(7 - week.length).fill(null)])
  return weeks
}

/** Newest first, and always at least the current year. */
export function calendarYears(days: CalendarCell[], currentYear: number): number[] {
  const years = new Set(days.map((day) => Number(day.date.slice(0, 4))))
  years.add(currentYear)
  return [...years].sort((a, b) => b - a)
}
