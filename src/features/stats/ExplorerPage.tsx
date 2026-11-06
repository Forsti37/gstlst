import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Button, ErrorText, Section, TextField } from '../../app/ui'
import { useMember } from '../auth/auth'
import { DIMENSIONS, useExplore, type Dimension, type StatRow } from './api'
import { BarList } from './charts'

type Metric = 'sets' | 'events' | 'avg_rating'

const CHRONOLOGICAL: Dimension[] = ['month', 'year', 'weekday']
const CHART_ROWS = 20
const SELECT = 'min-h-touch w-full rounded-lg border border-surface-2 bg-surface-1 px-3 text-text-primary'

/** Months, weekdays and set types come as keys, so that they can be shown in the user's language. */
function useRowLabel(dimension: Dimension) {
  const { t, i18n } = useTranslation()
  return (row: Pick<StatRow, 'key' | 'label'>) => {
    const language = i18n.resolvedLanguage
    if (dimension === 'weekday') {
      // 1 January 2024 was a Monday, and the key is the ISO weekday.
      return new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, Number(row.key))))
    }
    if (dimension === 'month') {
      return new Intl.DateTimeFormat(language, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${row.key}-01T00:00:00Z`))
    }
    if (dimension === 'set_type') return t(`stats.setTypes.${row.key}`, { defaultValue: row.label })
    return row.label
  }
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-text-secondary">{label}</span>
      <select className={SELECT} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  )
}

export function ExplorerPage() {
  const { t, i18n } = useTranslation()
  const { userId } = useParams()
  const me = useMember()
  const target = userId ?? me.id
  const [dimension, setDimension] = useState<Dimension>('artist')
  const [metric, setMetric] = useState<Metric>('sets')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [filters, setFilters] = useState<Partial<Record<Dimension, string>>>({})
  const [filterLabels, setFilterLabels] = useState<Partial<Record<Dimension, string>>>({})
  const [filterDimension, setFilterDimension] = useState<Dimension>('city')

  const result = useExplore({ userId: target, dimension, from, to, filters, verifiedOnly })
  const options = useExplore({ userId: target, dimension: filterDimension, from: '', to: '', filters: {}, verifiedOnly: false })
  const rowLabel = useRowLabel(dimension)
  const optionLabel = useRowLabel(filterDimension)

  const rows = useMemo(() => {
    const list = [...(result.data ?? [])]
    if (CHRONOLOGICAL.includes(dimension)) return list.sort((a, b) => a.key.localeCompare(b.key))
    if (metric === 'avg_rating') return list.sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1))
    return list.sort((a, b) => b[metric] - a[metric])
  }, [result.data, dimension, metric])

  const format = (value: number | null) => (value == null ? '–' : value.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 }))
  const chartRows = rows
    .filter((row) => metric !== 'avg_rating' || row.avg_rating != null)
    .slice(0, CHRONOLOGICAL.includes(dimension) ? undefined : CHART_ROWS)
    .map((row) => ({ key: row.key, label: rowLabel(row), value: row[metric] ?? 0, display: format(row[metric]) }))

  const chooseFilter = (key: string) => {
    if (!key) {
      removeFilter(filterDimension)
      return
    }
    const option = options.data?.find((row) => row.key === key)
    setFilters((current) => ({ ...current, [filterDimension]: key }))
    setFilterLabels((current) => ({ ...current, [filterDimension]: option ? optionLabel(option) : key }))
  }
  const removeFilter = (key: Dimension) => {
    setFilters((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('stats.explorer')}</h1>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Select label={t('stats.groupBy')} value={dimension} onChange={(value) => setDimension(value as Dimension)}>
          {DIMENSIONS.map((d) => <option key={d} value={d}>{t(`stats.dimensions.${d}`)}</option>)}
        </Select>
        <Select label={t('stats.metric')} value={metric} onChange={(value) => setMetric(value as Metric)}>
          <option value="sets">{t('stats.sets')}</option>
          <option value="events">{t('stats.events')}</option>
          <option value="avg_rating">{t('stats.avgRating')}</option>
        </Select>
        <TextField type="date" label={t('stats.from')} value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField type="date" label={t('stats.to')} value={to} onChange={(event) => setTo(event.target.value)} />
        <Select label={t('stats.filterBy')} value={filterDimension} onChange={(value) => setFilterDimension(value as Dimension)}>
          {DIMENSIONS.map((d) => <option key={d} value={d}>{t(`stats.dimensions.${d}`)}</option>)}
        </Select>
        <Select label={t('stats.filterValue')} value={filters[filterDimension] ?? ''} onChange={chooseFilter}>
          <option value="">{t('stats.filterAny')}</option>
          {(options.data ?? []).map((row) => <option key={row.key} value={row.key}>{optionLabel(row)}</option>)}
        </Select>
      </div>
      <label className="mt-3 flex min-h-touch items-center gap-3">
        <input type="checkbox" className="size-5" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />
        {t('stats.verifiedOnly')}
      </label>
      {Object.keys(filters).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(filters) as Dimension[]).map((key) => (
            <Button key={key} onClick={() => removeFilter(key)} aria-label={t('stats.removeFilter', { name: filterLabels[key] })}>
              {t(`stats.dimensions.${key}`)}: {filterLabels[key]} ×
            </Button>
          ))}
        </div>
      )}

      {result.isError && <ErrorText>{t('stats.loadFailed')}</ErrorText>}
      {result.isPending && <p className="mt-6 text-text-secondary">{t('common.loading')}</p>}
      {result.data && rows.length === 0 && <p className="mt-6 text-text-secondary">{t('stats.noResults')}</p>}
      {rows.length > 0 && (
        <>
          <Section title={t('stats.chart')}>
            <BarList rows={chartRows} tone={target === me.id ? 'own' : 'social'} max={metric === 'avg_rating' ? 5 : undefined} />
          </Section>
          <Section title={t('stats.table')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-text-secondary">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">{t(`stats.dimensions.${dimension}`)}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t('stats.events')}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t('stats.sets')}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t('stats.avgRating')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-surface-2">
                      <td className="py-2 pr-3">{rowLabel(row)}</td>
                      <td className="py-2 pr-3 text-right">{row.events}</td>
                      <td className="py-2 pr-3 text-right">{row.sets}</td>
                      <td className="py-2 text-right">{format(row.avg_rating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
