import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Button, ErrorText, TextField } from '../../app/ui'
import { toDateString } from '../../lib/geo'
import { normalizeSlug } from '../../lib/slug'
import { useMember } from '../auth/auth'
import { insert, type QueuedAction } from '../offline/actions'
import { enqueue } from '../offline/queue'
import { eventKey, formatEventDate, useEventSearch, type EventDetail } from './api'
import { Chip, EntityPicker, PickedChip } from './components'
import type { PickedEntity } from './draft'

const VENUE_TYPES = ['club', 'warehouse', 'open_air', 'festival_site', 'castle', 'pool', 'boat', 'other'] as const

export function NewEventPage() {
  const { t, i18n } = useTranslation()
  const me = useMember()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [dateStart, setDateStart] = useState(() => toDateString(new Date()))
  const [dateEnd, setDateEnd] = useState('')
  const [venue, setVenue] = useState<PickedEntity | null>(null)
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('AT')
  const [venueType, setVenueType] = useState<(typeof VENUE_TYPES)[number]>('club')
  const [promoter, setPromoter] = useState<PickedEntity | null>(null)
  const [series, setSeries] = useState<PickedEntity | null>(null)
  const [floors, setFloors] = useState('')
  const [failed, setFailed] = useState(false)

  const duplicates = useEventSearch(name)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!venue) return
    setFailed(false)
    const eventId = crypto.randomUUID()
    const actions: QueuedAction[] = []
    if (venue.isNew) {
      actions.push(
        insert('venues', { id: venue.id, name: venue.name, city: city.trim(), country_code: country.toUpperCase(), venue_type: venueType, created_by: me.id }),
      )
    }
    if (promoter?.isNew) {
      actions.push(insert('promoters', { id: promoter.id, name: promoter.name, slug: normalizeSlug(promoter.name), created_by: me.id }))
    }
    if (series?.isNew) {
      actions.push(
        insert('event_series', { id: series.id, name: series.name, slug: normalizeSlug(series.name), default_promoter_id: promoter?.id ?? null, created_by: me.id }),
      )
    }
    actions.push(
      insert('events', {
        id: eventId,
        series_id: series?.id ?? null,
        name: name.trim(),
        date_start: dateStart,
        date_end: dateEnd || null,
        venue_id: venue.id,
        created_by: me.id,
      }),
    )
    if (promoter) actions.push(insert('event_promoters', { event_id: eventId, promoter_id: promoter.id }, 'event_id,promoter_id'))
    floors
      .split(',')
      .map((floor) => floor.trim())
      .filter(Boolean)
      .forEach((floor, sort) => actions.push(insert('floors', { id: crypto.randomUUID(), event_id: eventId, name: floor, sort, created_by: me.id })))

    try {
      await enqueue(me.id, actions)
    } catch {
      setFailed(true)
      return
    }

    // The new event has to work right away, also while it's still waiting in the queue.
    const created: EventDetail = {
      id: eventId,
      name: name.trim(),
      date_start: dateStart,
      date_end: dateEnd || null,
      status: 'pending',
      venue: { id: venue.id, name: venue.name, city: city.trim(), lat: null, lng: null, status: 'pending' },
      series: series ? { id: series.id, name: series.name } : null,
      event_promoters: promoter ? [{ promoter: { id: promoter.id, name: promoter.name } }] : [],
      event_event_tags: [],
    }
    queryClient.setQueryData(eventKey(eventId), created)
    void navigate(`/check-in/${eventId}`, { replace: true, state: { event: created } })
  }

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('checkin.createEvent')}</h1>
      <p className="mt-2 text-sm text-text-secondary">{t('checkin.createEventHint')}</p>

      <form className="mt-6 space-y-4" onSubmit={(e) => void submit(e)}>
        <TextField label={t('checkin.eventName')} value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} autoComplete="off" />
        {(duplicates.data?.length ?? 0) > 0 && (
          <div className="rounded-lg bg-surface-1 p-3">
            <p className="text-sm text-text-secondary">{t('checkin.didYouMean')}</p>
            <ul>
              {duplicates.data?.slice(0, 3).map((duplicate) => (
                <li key={duplicate.id}>
                  <Link to={`/check-in/${duplicate.id}`} className="block min-h-touch py-2">
                    <span className="font-medium">{duplicate.name}</span>
                    <span className="block text-sm text-text-secondary">
                      {formatEventDate(duplicate, i18n.resolvedLanguage)}
                      {duplicate.venue_name && ` · ${duplicate.venue_name}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('checkin.dateStart')} type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} required />
          <TextField label={t('checkin.dateEnd')} type="date" value={dateEnd} min={dateStart} onChange={(e) => setDateEnd(e.target.value)} />
        </div>

        {venue ? (
          <div>
            <p className="mb-1 text-sm text-text-secondary">{t('checkin.venue')}</p>
            <PickedChip entity={venue} onRemove={() => setVenue(null)} />
          </div>
        ) : (
          <EntityPicker type="venue" label={t('checkin.venue')} onPick={setVenue} />
        )}
        {venue?.isNew && (
          <div className="space-y-3 rounded-lg bg-surface-1 p-3">
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <TextField label={t('checkin.city')} value={city} onChange={(e) => setCity(e.target.value)} required />
              <TextField label={t('checkin.country')} value={country} onChange={(e) => setCountry(e.target.value)} required minLength={2} maxLength={2} />
            </div>
            <div className="flex flex-wrap gap-2">
              {VENUE_TYPES.map((type) => (
                <Chip key={type} selected={venueType === type} onClick={() => setVenueType(type)}>{t(`checkin.venueTypes.${type}`)}</Chip>
              ))}
            </div>
          </div>
        )}

        {promoter ? (
          <div>
            <p className="mb-1 text-sm text-text-secondary">{t('checkin.promoter')}</p>
            <PickedChip entity={promoter} onRemove={() => setPromoter(null)} />
          </div>
        ) : (
          <EntityPicker type="promoter" label={t('checkin.promoter')} onPick={setPromoter} />
        )}

        {series ? (
          <div>
            <p className="mb-1 text-sm text-text-secondary">{t('checkin.series')}</p>
            <PickedChip entity={series} onRemove={() => setSeries(null)} />
          </div>
        ) : (
          <EntityPicker type="series" label={t('checkin.series')} onPick={setSeries} />
        )}

        <TextField label={t('checkin.floors')} hint={t('checkin.floorsHint')} value={floors} onChange={(e) => setFloors(e.target.value)} autoComplete="off" />

        {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}
        <Button type="submit" variant="own" className="w-full" disabled={!venue || !name.trim()}>
          {t('checkin.createAndContinue')}
        </Button>
      </form>
    </div>
  )
}
