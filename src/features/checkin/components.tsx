import { useQuery } from '@tanstack/react-query'
import { MapPin, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { TextField } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { formatEventDate, type EventSummary, type Status } from './api'
import type { PickedEntity } from './draft'

export function UnderReview({ status }: { status: Status | undefined }) {
  const { t } = useTranslation()
  if (status !== 'pending') return null
  return <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-secondary">{t('checkin.underReview')}</span>
}

export function EventRow({ event, to, trailing }: { event: EventSummary; to: string; trailing?: ReactNode }) {
  const { i18n } = useTranslation()
  return (
    <li>
      <Link to={to} className="flex min-h-touch items-center gap-3 rounded-lg bg-surface-1 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{event.name}</span>
            <UnderReview status={event.status} />
          </span>
          <span className="block truncate text-sm text-text-secondary">
            {formatEventDate(event, i18n.resolvedLanguage)}
            {event.venue && ` · ${event.venue.name}, ${event.venue.city}`}
          </span>
        </span>
        {trailing}
      </Link>
    </li>
  )
}

/** Big enough to use with a thumb in the dark. Stays visibly unset until it's touched. */
export function RatingSlider({
  value,
  onChange,
  label,
}: {
  value: number | null
  onChange: (value: number) => void
  label: string
}) {
  const read = (target: HTMLInputElement) => onChange(Number(target.value))
  return (
    <div className="flex items-center gap-4">
      <output className="font-display w-14 shrink-0 text-right text-4xl tabular-nums">
        {value === null ? '–' : value.toFixed(1)}
      </output>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={5}
        step={0.5}
        value={value ?? 2.5}
        onChange={(e) => read(e.currentTarget)}
        // A tap on the current position fires no change event, but still means "this rating".
        onPointerUp={(e) => read(e.currentTarget)}
        className={`h-12 min-w-0 flex-1 ${value === null ? 'opacity-50' : 'accent-red'}`}
      />
    </div>
  )
}

/** A rating that can stay empty: event and sub-ratings. */
export function OptionalRating({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        {value !== null && (
          <button type="button" onClick={() => onChange(null)} className="min-h-touch px-2 text-text-secondary">
            {t('checkin.clear')}
          </button>
        )}
      </div>
      <RatingSlider value={value} onChange={onChange} label={label} />
    </div>
  )
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="min-h-touch rounded-full bg-surface-2 px-4 text-sm font-medium text-text-secondary aria-pressed:bg-text-primary aria-pressed:text-bg"
    >
      {children}
    </button>
  )
}

export function PickedChip({ entity, onRemove }: { entity: PickedEntity; onRemove: () => void }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex min-h-touch items-center gap-1 rounded-full bg-surface-2 pl-4 text-sm font-medium">
      {entity.name}
      {entity.isNew && <span className="text-xs text-text-secondary">({t('checkin.new')})</span>}
      <button type="button" onClick={onRemove} aria-label={t('checkin.removeItem', { name: entity.name })} className="grid size-touch place-items-center text-text-secondary">
        <X aria-hidden className="size-4" />
      </button>
    </span>
  )
}

export type EntityType = 'artist' | 'venue' | 'promoter' | 'series'

/**
 * Search first, create second, so that duplicates get caught ("Did you mean A.M.C.?").
 * Without reception the search stays empty, and creating still works.
 */
export function EntityPicker({
  type,
  label,
  hint,
  onPick,
}: {
  type: EntityType
  label: string
  hint?: string
  onPick: (entity: PickedEntity) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const results = useQuery({
    queryKey: ['entitySearch', type, trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('search_entities', { entity_type: type, query: trimmed, max_results: 6 })
      if (error) throw error
      return data
    },
  })

  const pick = (entity: PickedEntity) => {
    onPick(entity)
    setQuery('')
  }

  return (
    <div>
      <TextField label={label} hint={hint} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      {trimmed.length >= 2 && (
        <ul className="mt-1 overflow-hidden rounded-lg bg-surface-1">
          {results.data?.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => pick({ id: result.id, name: result.name, isNew: false })}
                className="flex min-h-touch w-full items-center gap-2 px-3 text-left"
              >
                <span className="min-w-0 flex-1 truncate">{result.name}</span>
                <UnderReview status={result.status} />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => pick({ id: crypto.randomUUID(), name: trimmed, isNew: true })}
              className="flex min-h-touch w-full items-center px-3 text-left font-medium text-red"
            >
              {t('checkin.createNew', { name: trimmed })}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

export function MapLink({ lat, lng, children }: { lat: number; lng: number; children: ReactNode }) {
  return (
    <a
      href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-touch items-center gap-2"
    >
      <MapPin aria-hidden className="size-4 shrink-0" />
      {children}
    </a>
  )
}
