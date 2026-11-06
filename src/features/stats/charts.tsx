import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Chip } from '../checkin/components'
import { calendarYears, yearGrid, type CalendarCell } from './calendar'

/** Red for your own numbers, blue when looking at someone else or at the community. */
export type Tone = 'own' | 'social'

const BAR: Record<Tone, string> = { own: 'bg-red', social: 'bg-blue' }
const MIX: Record<Tone, string> = { own: 'var(--gst-red)', social: 'var(--gst-blue)' }

export interface BarRow {
  key: string
  label: string
  value: number
  display?: string
  to?: string
}

/** One thin bar per row with its value written out, so nothing depends on color or hovering. */
export function BarList({ rows, tone, max }: { rows: BarRow[]; tone: Tone; max?: number }) {
  const top = max ?? Math.max(...rows.map((row) => row.value), 1)
  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 text-sm text-text-secondary tabular-nums">{row.display ?? row.value}</span>
            </span>
            <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-surface-2">
              <span className={`block h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.max(2, (row.value / top) * 100)}%` }} />
            </span>
          </>
        )
        return (
          <li key={row.key}>
            {row.to ? (
              <Link to={row.to} className="flex min-h-touch flex-col justify-center">{body}</Link>
            ) : (
              <div className="flex min-h-touch flex-col justify-center">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function cellColor(events: number, tone: Tone) {
  if (events === 0) return 'var(--gst-surface-2)'
  const share = events === 1 ? 50 : events === 2 ? 75 : 100
  return `color-mix(in srgb, ${MIX[tone]} ${share}%, var(--gst-surface-2))`
}

export function CalendarHeatmap({ days, tone }: { days: CalendarCell[]; tone: Tone }) {
  const { t, i18n } = useTranslation()
  const currentYear = new Date().getFullYear()
  const years = calendarYears(days, currentYear)
  const [year, setYear] = useState(() => years.find((y) => days.some((day) => day.date.startsWith(String(y)))) ?? currentYear)
  const grid = yearGrid(year, days)
  const total = days.filter((day) => day.date.startsWith(String(year))).reduce((sum, day) => sum + day.events, 0)
  const dateFormat = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const summary = t('stats.calendarSummary', { count: total, year })

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {years.map((y) => (
          <Chip key={y} selected={y === year} onClick={() => setYear(y)}>{y}</Chip>
        ))}
      </div>
      <div role="img" aria-label={summary} className="flex gap-0.5 overflow-x-auto py-1">
        {grid.map((week, index) => (
          <div key={index} className="flex shrink-0 flex-col gap-0.5">
            {week.map((cell, row) => (
              <span
                key={row}
                title={cell ? `${dateFormat.format(new Date(`${cell.date}T00:00:00Z`))}: ${t('stats.eventCount', { count: cell.events })}` : undefined}
                className="block size-3 rounded-sm"
                style={{ background: cell ? cellColor(cell.events, tone) : 'transparent' }}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-1 text-sm text-text-secondary">{summary}</p>
    </div>
  )
}
