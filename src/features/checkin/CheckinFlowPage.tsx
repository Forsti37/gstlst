import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, CheckCircle2, CloudOff } from 'lucide-react'
import { levelName, useBadges } from '../badges/api'
import { BadgeIcon } from '../badges/BadgeIcon'
import { FunFacts } from '../badges/FunFacts'
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Button, ErrorText, Section, TextField } from '../../app/ui'
import { getPosition, isLive, type Position } from '../../lib/geo'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { useFriendships } from '../friends/api'
import { enqueue, useQueueStatus } from '../offline/queue'
import { PushPrompt } from '../notifications/PushSettings'
import { AddSetSheet } from './AddSetSheet'
import {
  formatEventDate,
  groupByFloor,
  isPlayingNow,
  setLabel,
  useEvent,
  useLineup,
  useOwnCheckin,
  type EventDetail,
  type Lineup,
  type LineupSet,
  type Visibility,
} from './api'
import { Chip, OptionalRating, RatingSlider, UnderReview } from './components'
import {
  emptyEventDraft,
  eventCheckinActions,
  newSetActions,
  newSetDraft,
  setCheckinActions,
  type EventCheckinDraft,
  type NewSet,
  type SetDraft,
} from './draft'
import { SetDetails } from './SetDetails'

type Step = 'event' | 'lineup' | 'rate' | 'done'

function toLineupSet(set: NewSet): LineupSet {
  const person = (artist: NewSet['artists'][number], role: 'dj' | 'mc') => ({
    role,
    artist: { id: artist.id, name: artist.name, status: 'pending' as const, artist_default_genres: [] },
  })
  return {
    id: set.id,
    floor_id: set.newFloor?.id ?? set.floorId,
    set_type: set.type,
    start_at: null,
    end_at: null,
    status: 'pending',
    set_artists: [...set.artists.map((a) => person(a, 'dj')), ...set.mcs.map((m) => person(m, 'mc'))],
  }
}

const defaultGenres = (set: LineupSet) =>
  [...new Set(set.set_artists.flatMap((a) => a.artist?.artist_default_genres.map((g) => g.genre_id) ?? []))]

function EventStep({
  live,
  draft,
  onChange,
  onContinue,
}: {
  live: boolean
  draft: EventCheckinDraft
  onChange: (patch: Partial<EventCheckinDraft>) => void
  onContinue: () => void
}) {
  const { t } = useTranslation()
  const friendships = useFriendships()
  const friends = friendships.data?.filter((f) => f.status === 'accepted') ?? []
  const toNumber = (value: string) => (value === '' ? null : Number(value.replace(',', '.')))
  const visibilities: (Visibility | null)[] = [null, 'public', 'friends', 'private']

  return (
    <>
      <Button variant="own" className="mt-6 min-h-16 w-full text-lg" onClick={onContinue}>{t('checkin.checkInHere')}</Button>
      <p className="mt-2 text-center text-sm text-text-secondary">{live ? t('checkin.liveHint') : t('checkin.retroHint')}</p>

      <details className="mt-6">
        <summary className="flex min-h-touch cursor-pointer items-center font-medium">{t('checkin.rateEvent')}</summary>
        <div className="space-y-3 pt-2">
          <OptionalRating label={t('checkin.ratings.overall')} value={draft.rating} onChange={(rating) => onChange({ rating })} />
          <OptionalRating label={t('checkin.ratings.sound')} value={draft.ratingSound} onChange={(ratingSound) => onChange({ ratingSound })} />
          <OptionalRating label={t('checkin.ratings.crowd')} value={draft.ratingCrowd} onChange={(ratingCrowd) => onChange({ ratingCrowd })} />
          <OptionalRating label={t('checkin.ratings.location')} value={draft.ratingLocation} onChange={(ratingLocation) => onChange({ ratingLocation })} />
          <OptionalRating label={t('checkin.ratings.lineup')} value={draft.ratingLineup} onChange={(ratingLineup) => onChange({ ratingLineup })} />
          <TextField label={t('checkin.comment')} value={draft.text} onChange={(e) => onChange({ text: e.target.value })} maxLength={2000} />
        </div>
      </details>

      {friends.length > 0 && (
        <details className="mt-2">
          <summary className="flex min-h-touch cursor-pointer items-center font-medium">{t('checkin.tagFriends')}</summary>
          <div className="flex flex-wrap gap-2 pt-2">
            {friends.map((friend) => (
              <Chip
                key={friend.id}
                selected={draft.companionIds.includes(friend.id)}
                onClick={() =>
                  onChange({
                    companionIds: draft.companionIds.includes(friend.id)
                      ? draft.companionIds.filter((id) => id !== friend.id)
                      : [...draft.companionIds, friend.id],
                  })
                }
              >
                {friend.display_name}
              </Chip>
            ))}
          </div>
        </details>
      )}

      <details className="mt-2">
        <summary className="flex min-h-touch cursor-pointer items-center font-medium">{t('checkin.visibility')}</summary>
        <div className="flex flex-wrap gap-2 pt-2">
          {visibilities.map((option) => (
            <Chip key={option ?? 'settings'} selected={draft.visibility === option} onClick={() => onChange({ visibility: option })}>
              {option ? t(`settings.levels.${option}`) : t('checkin.followSettings')}
            </Chip>
          ))}
        </div>
      </details>

      <details className="mt-2">
        <summary className="flex min-h-touch cursor-pointer items-center font-medium">{t('checkin.spending')}</summary>
        <p className="py-1 text-sm text-text-secondary">{t('checkin.spendingHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('checkin.ticketPrice')} inputMode="decimal" onChange={(e) => onChange({ ticketPrice: toNumber(e.target.value) })} />
          <TextField label={t('checkin.otherSpend')} inputMode="decimal" onChange={(e) => onChange({ otherSpend: toNumber(e.target.value) })} />
        </div>
      </details>
    </>
  )
}

function LineupStep({
  lineup,
  alreadyCheckedIn,
  selected,
  onToggle,
  onAddSet,
  onContinue,
}: {
  lineup: Lineup
  alreadyCheckedIn: string[]
  selected: string[]
  onToggle: (set: LineupSet) => void
  onAddSet: (set: NewSet) => void
  onContinue: () => void
}) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const available = { ...lineup, sets: lineup.sets.filter((set) => !alreadyCheckedIn.includes(set.id)) }
  const time = (value: string | null) => value && new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {groupByFloor(available).map(({ floor, sets }) => (
        <Section key={floor?.id ?? 'none'} title={floor?.name ?? t('checkin.lineup')}>
          <ul className="space-y-2">
            {sets.map((set) => (
              <li key={set.id}>
                <button
                  type="button"
                  aria-pressed={selected.includes(set.id)}
                  onClick={() => onToggle(set)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg bg-surface-1 px-4 py-2 text-left aria-pressed:bg-text-primary aria-pressed:text-bg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{setLabel(set)}</span>
                    {set.start_at && <span className="text-sm opacity-70">{time(set.start_at)}{set.end_at && ` – ${time(set.end_at)}`}</span>}
                  </span>
                  {isPlayingNow(set) && <span className="rounded bg-red px-1.5 py-0.5 text-xs text-white">{t('checkin.playingNow')}</span>}
                  <UnderReview status={set.status} />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ))}
      {available.sets.length === 0 && <p className="mt-6 text-text-secondary">{t('checkin.noSets')}</p>}

      <div className="mt-6">
        {adding ? (
          <AddSetSheet
            floors={lineup.floors}
            onCancel={() => setAdding(false)}
            onAdd={(set) => {
              onAddSet(set)
              setAdding(false)
            }}
          />
        ) : (
          <Button className="w-full" onClick={() => setAdding(true)}>{t('checkin.addSet')}</Button>
        )}
      </div>

      <Button variant="own" className="mt-3 w-full" onClick={onContinue}>
        {selected.length > 0 ? t('checkin.rateSets', { count: selected.length }) : t('checkin.finishWithoutSets')}
      </Button>
    </>
  )
}

function RateStep({
  sets,
  drafts,
  onChange,
  onBack,
  onSubmit,
  failed,
  saving,
}: {
  sets: LineupSet[]
  drafts: SetDraft[]
  onChange: (setId: string, patch: Partial<SetDraft>) => void
  onBack: () => void
  onSubmit: () => void
  failed: boolean
  saving: boolean
}) {
  const { t } = useTranslation()
  const unrated = drafts.filter((d) => d.rating === null).length

  return (
    <>
      <ul className="mt-6 space-y-4">
        {drafts.map((draft) => {
          const set = sets.find((s) => s.id === draft.setId)
          const label = set ? setLabel(set) : ''
          return (
            <li key={draft.setId} className="rounded-xl bg-surface-1 p-4">
              <p className="font-medium">{label}</p>
              <RatingSlider value={draft.rating} label={t('checkin.ratingFor', { name: label })} onChange={(rating) => onChange(draft.setId, { rating })} />
              <SetDetails draft={draft} onChange={(patch) => onChange(draft.setId, patch)} />
            </li>
          )
        })}
      </ul>
      {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      <Button variant="own" className="mt-4 min-h-16 w-full text-lg" disabled={unrated > 0 || saving} onClick={onSubmit}>
        {unrated > 0 ? t('checkin.stillUnrated', { count: unrated }) : t('checkin.done')}
      </Button>
      <Button className="mt-2 w-full" onClick={onBack}>{t('common.back')}</Button>
    </>
  )
}

/** What this check-in earned. The batch ends by evaluating badges, and the queue then refreshes this. */
function NewBadges({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const badges = useBadges(userId)
  const [since] = useState(() => Date.now() - 30_000)
  const fresh = (badges.data ?? []).filter((badge) => badge.awarded_at && Date.parse(badge.awarded_at) >= since)
  if (fresh.length === 0) return null
  return (
    <section className="mt-6 text-left">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-text-secondary uppercase">{t('badges.new')}</h2>
      <ul className="space-y-2">
        {fresh.map((badge) => (
          <li key={badge.id}>
            <Link to="/badges" className="flex min-h-touch items-center gap-3 rounded-lg bg-surface-1 p-2 font-semibold">
              <BadgeIcon category={badge.category} level={badge.level} size={48} />
              {levelName(badge, badge.level)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DoneStep({ eventId, checkinId, onAddMore }: { eventId: string; checkinId: string | null; onAddMore: () => void }) {
  const { t } = useTranslation()
  const me = useMember()
  const { waiting } = useQueueStatus(me.id)
  const [promptDone, setPromptDone] = useState(false)
  return (
    <div className="mt-10 text-center">
      {waiting > 0 ? <CloudOff aria-hidden className="mx-auto size-16 text-text-secondary" /> : <CheckCircle2 aria-hidden className="mx-auto size-16 text-red" />}
      <p className="font-display mt-4 text-4xl uppercase">{t('checkin.doneTitle')}</p>
      <p className="mt-2 text-text-secondary">{waiting > 0 ? t('checkin.doneOffline') : t('checkin.doneOnline')}</p>
      <NewBadges userId={me.id} />
      {checkinId && <FunFacts checkinId={checkinId} limit={5} />}
      {!promptDone && <PushPrompt onAnswered={() => setPromptDone(true)} />}
      <div className="mt-8 space-y-2">
        <Button variant="primary" className="w-full" onClick={onAddMore}>{t('checkin.addMoreSets')}</Button>
        <Link to={`/events/${eventId}`} className="flex min-h-touch items-center justify-center rounded-lg bg-surface-2 px-4 font-semibold">{t('checkin.toEvent')}</Link>
      </div>
    </div>
  )
}

export function CheckinFlowPage() {
  const { t, i18n } = useTranslation()
  const { eventId } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const me = useMember()
  const queryClient = useQueryClient()

  const eventQuery = useEvent(eventId)
  const lineupQuery = useLineup(eventId)
  const own = useOwnCheckin(me.id, eventId)
  const event = eventQuery.data ?? (location.state as { event?: EventDetail } | null)?.event ?? null

  const [step, setStep] = useState<Step | null>(null)
  const [eventDraft, setEventDraft] = useState(emptyEventDraft)
  const [addedSets, setAddedSets] = useState<NewSet[]>([])
  const [setDrafts, setSetDrafts] = useState<SetDraft[]>([])
  const [submitted, setSubmitted] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const position = useRef<Promise<Position | null> | null>(null)
  const [preselected, setPreselected] = useState(false)
  const [doneCheckinId, setDoneCheckinId] = useState<string | null>(null)

  const lineup: Lineup = {
    floors: [
      ...(lineupQuery.data?.floors ?? []),
      ...addedSets.flatMap((set) => (set.newFloor ? [{ id: set.newFloor.id, name: set.newFloor.name, sort: 99 }] : [])),
    ],
    sets: [...(lineupQuery.data?.sets ?? []), ...addedSets.map(toLineupSet)],
  }

  const toggleSet = (set: LineupSet) =>
    setSetDrafts((current) =>
      current.some((d) => d.setId === set.id)
        ? current.filter((d) => d.setId !== set.id)
        : [...current, newSetDraft(set.id, defaultGenres(set))],
    )

  // A tagged friend adopts the check-in: same event, same sets preselected, own ratings required.
  const adoptFrom = params.get('adopt')
  const adoption = useQuery({
    queryKey: ['taggedCheckin', adoptFrom],
    enabled: Boolean(adoptFrom),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('tagged_checkin', { checkin_id: adoptFrom! })
      if (error) throw error
      return data as unknown as { event_id: string; set_ids: string[] } | null
    },
  })
  if (adoption.data && lineupQuery.data && !preselected && !own.isPending) {
    setPreselected(true)
    const alreadySeen = own.data?.setIds ?? []
    setSetDrafts(
      lineupQuery.data.sets
        .filter((set) => adoption.data!.set_ids.includes(set.id) && !alreadySeen.includes(set.id))
        .map((set) => newSetDraft(set.id, defaultGenres(set))),
    )
  }

  // "Check in" next to a set on the event page arrives with that set already selected.
  const wantedSet = params.get('set')
  if (wantedSet && !preselected && lineupQuery.data) {
    setPreselected(true)
    const set = lineupQuery.data.sets.find((s) => s.id === wantedSet)
    if (set && !own.data?.setIds.includes(set.id)) setSetDrafts([newSetDraft(set.id, defaultGenres(set))])
  }

  if (!eventId) return null
  if (eventQuery.isPending && !event) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!event) return <PlaceholderPage title={t('pages.notFound.title')} body={t('checkin.eventNotFound')} />

  const live = isLive(event)
  const hasCheckin = Boolean(own.data)
  const current: Step = step ?? (hasCheckin ? 'lineup' : 'event')

  const startGps = () => {
    // Fired right after the tap, because the browser only asks after a user action.
    if (live) position.current = getPosition()
  }

  const submit = async () => {
    setSaving(true)
    setFailed(false)
    try {
      const checkinId = own.data?.id ?? crypto.randomUUID()
      const coordinates = !hasCheckin && position.current ? await position.current : null
      await enqueue(me.id, [
        ...(hasCheckin ? [] : eventCheckinActions(me.id, eventId, checkinId, eventDraft, coordinates)),
        ...addedSets.flatMap((set) => newSetActions(me.id, eventId, set)),
        ...setDrafts.flatMap((draft) => setCheckinActions(me.id, checkinId, draft)),
        ...(adoptFrom
          ? [{ kind: 'update' as const, table: 'checkin_companions' as const, match: { event_checkin_id: adoptFrom, user_id: me.id }, changes: { status: 'adopted' } }]
          : []),
      ])
      navigator.vibrate?.(30)
      setSubmitted((done) => [...done, ...setDrafts.map((d) => d.setId)])
      setSetDrafts([])
      setDoneCheckinId(checkinId)
      setStep('done')
      void queryClient.invalidateQueries({ queryKey: ['ownCheckin', me.id, eventId] })
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-3xl tracking-wide uppercase">{event.name}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        {formatEventDate(event, i18n.resolvedLanguage)}
        {event.venue && ` · ${event.venue.name}, ${event.venue.city}`}
        <UnderReview status={event.status} />
      </p>
      {adoptFrom && current !== 'done' && <p className="mt-3 text-sm text-text-secondary">{t('checkin.adopting')}</p>}
      {hasCheckin && current !== 'done' && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <BadgeCheck aria-hidden className="size-5 text-red" />
          {t('checkin.alreadyCheckedIn')}
        </p>
      )}

      {current === 'event' && (
        <EventStep
          live={live}
          draft={eventDraft}
          onChange={(patch) => setEventDraft((d) => ({ ...d, ...patch }))}
          onContinue={() => {
            startGps()
            setStep('lineup')
          }}
        />
      )}
      {current === 'lineup' && (
        <LineupStep
          lineup={lineup}
          alreadyCheckedIn={[...(own.data?.setIds ?? []), ...submitted]}
          selected={setDrafts.map((d) => d.setId)}
          onToggle={toggleSet}
          onAddSet={(set) => {
            setAddedSets((sets) => [...sets, set])
            setSetDrafts((drafts) => [...drafts, newSetDraft(set.id, [])])
          }}
          onContinue={() => (setDrafts.length > 0 ? setStep('rate') : void submit())}
        />
      )}
      {current === 'rate' && (
        <RateStep
          sets={lineup.sets}
          drafts={setDrafts}
          onChange={(setId, patch) => setSetDrafts((drafts) => drafts.map((d) => (d.setId === setId ? { ...d, ...patch } : d)))}
          onBack={() => setStep('lineup')}
          onSubmit={() => void submit()}
          failed={failed}
          saving={saving}
        />
      )}
      {current === 'done' && (
        <DoneStep
          eventId={eventId}
          checkinId={doneCheckinId}
          onAddMore={() => {
            setAddedSets([])
            setStep('lineup')
          }}
        />
      )}
    </div>
  )
}
