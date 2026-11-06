import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Button, Section, TextField } from '../../app/ui'
import { toDateString } from '../../lib/geo'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { useFriendships } from '../friends/api'
import { ReportButton } from '../moderation/ReportButton'
import { GoingSection } from '../social/GoingSection'
import { UserAvatar } from '../profile/UserAvatar'
import { insert } from '../offline/actions'
import { enqueue } from '../offline/queue'
import { AddSetSheet } from './AddSetSheet'
import { formatEventDate, groupByFloor, isPlayingNow, setLabel, useEvent, useEventRatings, useLineup, useMediaUrls, useReferenceData, type LineupSet } from './api'
import { Chip, MapLink, UnderReview } from './components'
import { newSetActions } from './draft'

const clock = (value: string | null) => value && new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** The artists of a set as links, joined the way setLabel joins them. */
function SetArtistLinks({ set }: { set: LineupSet }) {
  const people = set.set_artists.filter((entry) => entry.artist && entry.role !== 'mc')
  const mcs = set.set_artists.filter((entry) => entry.artist && entry.role === 'mc')
  const separator = set.set_type === 'f2f' ? ' f2f ' : ' b2b '
  return (
    <span>
      {people.map((entry, index) => (
        <span key={entry.artist!.id}>
          {index > 0 && separator}
          <Link to={`/artists/${entry.artist!.id}`}>{entry.artist!.name}</Link>
        </span>
      ))}
      {mcs.length > 0 && <> ft. {mcs.map((entry) => entry.artist!.name).join(', ')}</>}
    </span>
  )
}

function PastEditions({ seriesId, eventId }: { seriesId: string; eventId: string }) {
  const { t, i18n } = useTranslation()
  const editions = useQuery({
    queryKey: ['seriesEditions', seriesId],
    queryFn: async () => {
      const { data, error } = await getSupabase().from('events').select('id, name, date_start, date_end').eq('series_id', seriesId).order('date_start', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const others = editions.data?.filter((e) => e.id !== eventId) ?? []
  if (others.length === 0) return null
  return (
    <Section title={t('events.pastEditions')}>
      <ul>
        {others.map((edition) => (
          <li key={edition.id}>
            <Link to={`/events/${edition.id}`} className="flex min-h-touch items-center">{edition.name} · {formatEventDate(edition, i18n.resolvedLanguage)}</Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function WhoWasThere({ eventId }: { eventId: string }) {
  const { t } = useTranslation()
  const friendships = useFriendships()
  const attendees = useQuery({
    queryKey: ['eventAttendees', eventId],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('event_checkins')
        .select('user:profiles!event_checkins_user_id_fkey(id, username, display_name, avatar_path)')
        .eq('event_id', eventId)
      if (error) throw error
      return (data as unknown as { user: { id: string; username: string; display_name: string; avatar_path: string | null } | null }[]).flatMap((row) => (row.user ? [row.user] : []))
    },
  })
  const friendIds = new Set(friendships.data?.filter((f) => f.status === 'accepted').map((f) => f.id))
  const people = [...(attendees.data ?? [])].sort((a, b) => Number(friendIds.has(b.id)) - Number(friendIds.has(a.id)))
  if (people.length === 0) return null
  return (
    <Section title={t('events.whoWasThere')}>
      <ul className="flex flex-wrap gap-3">
        {people.map((person) => (
          <li key={person.id}>
            <Link to={`/u/${person.username}`} className="flex min-h-touch items-center gap-2">
              <UserAvatar path={person.avatar_path} name={person.display_name} />
              <span className={friendIds.has(person.id) ? 'font-medium text-blue' : ''}>{person.display_name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function EventPhotos({ eventId }: { eventId: string }) {
  const { t } = useTranslation()
  const me = useMember()
  // Approved photos, plus the user's own while they wait. Staff could read more through RLS,
  // but moderating belongs in the queue, not on the public page.
  const photos = useQuery({
    queryKey: ['eventPhotos', eventId],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('media')
        .select('id, owner_id, storage_path, moderation_status, checkin:event_checkins!inner(event_id)')
        .eq('checkin.event_id', eventId)
        .or(`moderation_status.eq.approved,owner_id.eq.${me.id}`)
      if (error) throw error
      return data
    },
  })
  const { data: urls = new Map<string, string>() } = useMediaUrls(photos.data?.map((photo) => photo.storage_path) ?? [])
  if (!photos.data?.length) return null
  return (
    <Section title={t('events.photos')}>
      <div className="grid grid-cols-3 gap-1">
        {photos.data.map((photo) => (
          <figure key={photo.id} className="relative">
            <img src={urls.get(photo.storage_path)} alt={t('checkin.photoAlt')} loading="lazy" className="aspect-square w-full rounded bg-surface-2 object-cover" />
            {photo.moderation_status !== 'approved' && (
              <figcaption className="absolute inset-x-0 bottom-0 rounded-b bg-bg/80 px-1 py-0.5 text-center text-xs">
                {t('events.onlyYou')}
              </figcaption>
            )}
            {photo.owner_id !== me.id && (
              <div className="mt-1">
                <ReportButton targetType="media" targetId={photo.id} onReported={() => void photos.refetch()} />
              </div>
            )}
          </figure>
        ))}
      </div>
    </Section>
  )
}

function ProposeTimetable({ eventId, sets, onDone }: { eventId: string; sets: LineupSet[]; onDone: () => void }) {
  const { t } = useTranslation()
  const me = useMember()
  const [times, setTimes] = useState<Record<string, { start: string; end: string }>>({})
  const update = (id: string, patch: Partial<{ start: string; end: string }>) =>
    setTimes((current) => ({ ...current, [id]: { start: '', end: '', ...current[id], ...patch } }))

  const submit = () => {
    const entries = Object.entries(times).filter(([, time]) => time.start)
    void enqueue(me.id, [
      insert('change_requests', {
        id: crypto.randomUUID(),
        entity_type: 'event_timetable',
        entity_id: eventId,
        created_by: me.id,
        diff: {
          sets: entries.map(([set_id, time]) => ({
            set_id,
            start_at: new Date(time.start).toISOString(),
            end_at: time.end ? new Date(time.end).toISOString() : null,
          })),
        },
      }),
    ]).then(onDone)
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-surface-1 p-4">
      {sets.map((set) => (
        <fieldset key={set.id}>
          <legend className="mb-1 font-medium">{setLabel(set)}</legend>
          <div className="grid grid-cols-2 gap-2">
            <TextField label={t('events.start')} type="datetime-local" onChange={(e) => update(set.id, { start: e.target.value })} />
            <TextField label={t('events.end')} type="datetime-local" onChange={(e) => update(set.id, { end: e.target.value })} />
          </div>
        </fieldset>
      ))}
      <Button variant="primary" onClick={submit} disabled={!Object.values(times).some((time) => time.start)}>{t('events.sendProposal')}</Button>
    </div>
  )
}

function ProposeCorrection({ event, onDone }: { event: { id: string; name: string; date_start: string; date_end: string | null }; onDone: () => void }) {
  const { t } = useTranslation()
  const me = useMember()
  const [name, setName] = useState(event.name)
  const [dateStart, setDateStart] = useState(event.date_start)
  const [dateEnd, setDateEnd] = useState(event.date_end ?? '')
  const diff = {
    ...(name.trim() !== event.name ? { name: name.trim() } : {}),
    ...(dateStart !== event.date_start ? { date_start: dateStart } : {}),
    ...(dateEnd !== (event.date_end ?? '') ? { date_end: dateEnd } : {}),
  }
  const submit = () => {
    void enqueue(me.id, [
      insert('change_requests', { id: crypto.randomUUID(), entity_type: 'event_correction', entity_id: event.id, created_by: me.id, diff }),
    ]).then(onDone)
  }
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-surface-1 p-4">
      <TextField label={t('checkin.eventName')} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <TextField label={t('checkin.dateStart')} type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
        <TextField label={t('checkin.dateEnd')} type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
      </div>
      <Button variant="primary" disabled={Object.keys(diff).length === 0} onClick={submit}>{t('events.sendProposal')}</Button>
    </div>
  )
}

function ProposeTags({ eventId, currentTagIds, onDone }: { eventId: string; currentTagIds: string[]; onDone: () => void }) {
  const { t } = useTranslation()
  const me = useMember()
  const { tags } = useReferenceData()
  const [picked, setPicked] = useState<string[]>([])
  const options = tags.filter((tag) => tag.scope === 'event' && !currentTagIds.includes(tag.id))

  const submit = () => {
    void enqueue(me.id, [
      insert('change_requests', {
        id: crypto.randomUUID(),
        entity_type: 'event_tags',
        entity_id: eventId,
        created_by: me.id,
        diff: { add_tag_ids: picked },
      }),
    ]).then(onDone)
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-surface-1 p-4">
      <div className="flex flex-wrap gap-2">
        {options.map((tag) => (
          <Chip key={tag.id} selected={picked.includes(tag.id)} onClick={() => setPicked((p) => (p.includes(tag.id) ? p.filter((x) => x !== tag.id) : [...p, tag.id]))}>{tag.name}</Chip>
        ))}
      </div>
      <Button variant="primary" onClick={submit} disabled={picked.length === 0}>{t('events.sendProposal')}</Button>
    </div>
  )
}

export function EventPage() {
  const { t, i18n } = useTranslation()
  const { eventId } = useParams()
  const me = useMember()
  const event = useEvent(eventId)
  const lineup = useLineup(eventId)
  const ratings = useEventRatings(eventId)
  const [panel, setPanel] = useState<'timetable' | 'tags' | 'set' | 'correction' | null>(null)
  const [sent, setSent] = useState(false)

  const finish = () => {
    setPanel(null)
    setSent(true)
  }

  if (!eventId) return null
  if (event.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!event.data) return <PlaceholderPage title={t('pages.notFound.title')} body={t('checkin.eventNotFound')} />

  const data = event.data
  const venue = data.venue
  const promoters = data.event_promoters.flatMap((p) => (p.promoter ? [p.promoter.name] : []))
  const tags = data.event_event_tags.flatMap((e) => (e.tag ? [e.tag] : []))
  const sets = lineup.data?.sets ?? []

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{data.name}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-text-secondary">
        {formatEventDate(data, i18n.resolvedLanguage)}
        <UnderReview status={data.status} />
      </p>
      {venue && (venue.lat != null && venue.lng != null ? (
        <MapLink lat={venue.lat} lng={venue.lng}>{venue.name}, {venue.city}</MapLink>
      ) : (
        <p className="mt-1">{venue.name}, {venue.city}</p>
      ))}
      {promoters.length > 0 && <p className="text-sm text-text-secondary">{t('events.by', { names: promoters.join(', ') })}</p>}
      {data.series && <p className="text-sm text-text-secondary">{t('events.series', { name: data.series.name })}</p>}

      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => <li key={tag.id} className="rounded-full bg-surface-2 px-3 py-1 text-sm">{tag.name}</li>)}
        </ul>
      )}

      <Link to={`/check-in/${eventId}`} className="mt-5 flex min-h-touch items-center justify-center rounded-lg bg-red px-4 font-semibold text-white">{t('events.checkIn')}</Link>

      {groupByFloor(lineup.data ?? { floors: [], sets: [] }).map(({ floor, sets: floorSets }) => (
        <Section key={floor?.id ?? 'none'} title={floor?.name ?? t('checkin.lineup')}>
          <ul className="space-y-2">
            {floorSets.map((set) => {
              const rating = ratings.data?.get(set.id)
              return (
                <li key={set.id} className="flex items-center gap-3 rounded-lg bg-surface-1 py-2 pr-2 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <SetArtistLinks set={set} />
                      <UnderReview status={set.status} />
                      {isPlayingNow(set) && <span className="rounded bg-red px-1.5 py-0.5 text-xs text-white">{t('checkin.playingNow')}</span>}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {set.start_at && `${clock(set.start_at)}${set.end_at ? ` – ${clock(set.end_at)}` : ''}`}
                      {set.start_at && rating && ' · '}
                      {rating && t('events.average', { average: rating.average, count: rating.ratings })}
                    </p>
                  </div>
                  <Link to={`/check-in/${eventId}?set=${set.id}`} className="inline-flex min-h-touch shrink-0 items-center rounded-lg bg-surface-2 px-3 text-sm font-semibold">{t('events.checkInSet')}</Link>
                </li>
              )
            })}
          </ul>
        </Section>
      ))}
      {!lineup.isPending && sets.length === 0 && <p className="mt-6 text-text-secondary">{t('checkin.noSets')}</p>}

      <Section title={t('events.contribute')}>
        {sent && <p className="mb-2 text-sm text-text-secondary">{t('events.proposalSent')}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPanel(panel === 'set' ? null : 'set')}>{t('checkin.addSet')}</Button>
          {sets.length > 0 && <Button onClick={() => setPanel(panel === 'timetable' ? null : 'timetable')}>{t('events.proposeTimetable')}</Button>}
          <Button onClick={() => setPanel(panel === 'tags' ? null : 'tags')}>{t('events.proposeTags')}</Button>
          <Button onClick={() => setPanel(panel === 'correction' ? null : 'correction')}>{t('events.proposeCorrection')}</Button>
        </div>
        {panel === 'set' && (
          <div className="mt-3">
            <AddSetSheet
              floors={lineup.data?.floors ?? []}
              onCancel={() => setPanel(null)}
              onAdd={(set) => void enqueue(me.id, newSetActions(me.id, eventId, set)).then(finish)}
            />
          </div>
        )}
        {panel === 'timetable' && <ProposeTimetable eventId={eventId} sets={sets} onDone={finish} />}
        {panel === 'tags' && <ProposeTags eventId={eventId} currentTagIds={tags.map((tag) => tag.id)} onDone={finish} />}
        {panel === 'correction' && <ProposeCorrection event={data} onDone={finish} />}
      </Section>

      <GoingSection eventId={eventId} upcoming={(data.date_end ?? data.date_start) >= toDateString(new Date())} />
      <WhoWasThere eventId={eventId} />
      <EventPhotos eventId={eventId} />
      {data.series && <PastEditions seriesId={data.series.id} eventId={eventId} />}
    </div>
  )
}
