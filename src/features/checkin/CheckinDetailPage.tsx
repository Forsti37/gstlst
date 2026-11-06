import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheck } from 'lucide-react'
import { FunFacts } from '../badges/FunFacts'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Button, Section, TextField } from '../../app/ui'
import { useMember } from '../auth/auth'
import { insert, type QueuedAction } from '../offline/actions'
import { enqueue } from '../offline/queue'
import { formatEventDate, setLabel, useCheckinDetail, useMediaUrls, usePrivateData, type CheckinDetail, type Visibility } from './api'
import { Chip, OptionalRating, RatingSlider, UnderReview } from './components'
import { PhotoPicker } from './SetDetails'

function SetRow({
  entry,
  rating,
  onRate,
  onDelete,
  onAddPhoto,
  onDeletePhoto,
}: {
  entry: CheckinDetail['set_checkins'][number]
  rating: number | null
  onRate: (rating: number) => void
  onDelete: () => void
  onAddPhoto: (photo: Blob) => void
  onDeletePhoto: (photo: CheckinDetail['set_checkins'][number]['media'][number]) => void
}) {
  const { t } = useTranslation()
  const label = entry.set ? setLabel(entry.set) : ''
  const { data: urls = new Map<string, string>() } = useMediaUrls(entry.media.map((photo) => photo.storage_path))
  return (
    <li className="rounded-xl bg-surface-1 p-4">
      <p className="flex flex-wrap items-center gap-2 font-medium">
        {label}
        <UnderReview status={entry.set?.status} />
      </p>
      <RatingSlider value={rating} label={t('checkin.ratingFor', { name: label })} onChange={onRate} />
      {entry.text && <p className="mt-1 text-sm text-text-secondary">{entry.text}</p>}
      {entry.media.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {entry.media.map((photo) => (
            <li key={photo.id}>
              <img src={urls.get(photo.storage_path)} alt={t('checkin.photoAlt')} className="aspect-square w-full rounded-lg bg-surface-2 object-cover" />
              <p className="mt-1 text-xs text-text-secondary">{t(`history.photo.${photo.moderation_status}`)}</p>
              <Button className="mt-1 w-full text-sm" onClick={() => onDeletePhoto(photo)}>{t('checkin.removePhoto')}</Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-start gap-2">
        <PhotoPicker label={t('checkin.addPhoto')} onPick={onAddPhoto} />
        <Button variant="danger" onClick={onDelete}>{t('history.removeSet')}</Button>
      </div>
    </li>
  )
}

function DetailForm({ checkin }: { checkin: CheckinDetail }) {
  const { t, i18n } = useTranslation()
  const me = useMember()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const privateData = usePrivateData(checkin.id)

  const [rating, setRating] = useState(checkin.rating)
  const [ratingSound, setRatingSound] = useState(checkin.rating_sound)
  const [ratingCrowd, setRatingCrowd] = useState(checkin.rating_crowd)
  const [ratingLocation, setRatingLocation] = useState(checkin.rating_location)
  const [ratingLineup, setRatingLineup] = useState(checkin.rating_lineup)
  const [text, setText] = useState(checkin.text ?? '')
  const [visibility, setVisibility] = useState<Visibility | null>(checkin.visibility)
  const [setRatings, setSetRatings] = useState<Record<string, number>>({})
  const [ticketPrice, setTicketPrice] = useState<string | null>(null)
  const [otherSpend, setOtherSpend] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const event = checkin.event
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['checkin', checkin.id] })
    void queryClient.invalidateQueries({ queryKey: ['myCheckins', me.id] })
  }
  const toAmount = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')))

  const save = async () => {
    const actions: QueuedAction[] = [
      {
        kind: 'update',
        table: 'event_checkins',
        match: { id: checkin.id },
        changes: {
          rating,
          rating_sound: ratingSound,
          rating_crowd: ratingCrowd,
          rating_location: ratingLocation,
          rating_lineup: ratingLineup,
          text: text.trim() || null,
          visibility,
        },
      },
      ...Object.entries(setRatings).map(([id, value]): QueuedAction => ({ kind: 'update', table: 'set_checkins', match: { id }, changes: { rating: value } })),
    ]
    if (ticketPrice !== null || otherSpend !== null) {
      actions.push({
        kind: 'replace',
        table: 'private_checkin_data',
        row: {
          event_checkin_id: checkin.id,
          ticket_price: ticketPrice !== null ? toAmount(ticketPrice) : (privateData.data?.ticket_price ?? null),
          other_spend: otherSpend !== null ? toAmount(otherSpend) : (privateData.data?.other_spend ?? null),
        },
        onConflict: 'event_checkin_id',
      })
    }
    await enqueue(me.id, actions)
    setSaved(true)
    refresh()
  }

  const removeSet = async (entry: CheckinDetail['set_checkins'][number]) => {
    if (!window.confirm(t('history.removeSetConfirm'))) return
    await enqueue(me.id, [
      ...entry.media.map((photo): QueuedAction => ({ kind: 'removeFile', path: photo.storage_path })),
      { kind: 'delete', table: 'set_checkins', match: { id: entry.id } },
    ])
    refresh()
  }

  const removeCheckin = async () => {
    if (!window.confirm(t('history.deleteConfirm'))) return
    await enqueue(me.id, [
      ...checkin.set_checkins.flatMap((entry) => entry.media.map((photo): QueuedAction => ({ kind: 'removeFile', path: photo.storage_path }))),
      { kind: 'delete', table: 'event_checkins', match: { id: checkin.id } },
    ])
    void queryClient.invalidateQueries({ queryKey: ['myCheckins', me.id] })
    void navigate('/check-ins', { replace: true })
  }

  const addPhoto = async (entry: CheckinDetail['set_checkins'][number], photo: Blob) => {
    const path = `${me.id}/${crypto.randomUUID()}.webp`
    await enqueue(me.id, [
      { kind: 'upload', path, blob: photo },
      insert('media', { id: crypto.randomUUID(), owner_id: me.id, event_checkin_id: checkin.id, set_checkin_id: entry.id, storage_path: path }),
    ])
    refresh()
  }

  const removePhoto = async (photo: { id: string; storage_path: string }) => {
    if (!window.confirm(t('history.removePhotoConfirm'))) return
    await enqueue(me.id, [
      { kind: 'removeFile', path: photo.storage_path },
      { kind: 'delete', table: 'media', match: { id: photo.id } },
    ])
    refresh()
  }

  const visibilities: (Visibility | null)[] = [null, 'public', 'friends', 'private']

  return (
    <div className="px-4 py-6">
      {event && (
        <>
          <h1 className="font-display text-3xl tracking-wide uppercase">
            <Link to={`/events/${event.id}`}>{event.name}</Link>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            {formatEventDate(event, i18n.resolvedLanguage)}
            {event.venue && ` · ${event.venue.name}, ${event.venue.city}`}
            <UnderReview status={event.status} />
          </p>
        </>
      )}
      {(checkin.verified_gps || checkin.verified_admin) && (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <BadgeCheck aria-hidden className="size-5 text-red" />
          {t('history.verified')}
        </p>
      )}

      <FunFacts checkinId={checkin.id} />

      <Section title={t('history.sets_title')}>
        <ul className="space-y-3">
          {checkin.set_checkins.map((entry) => (
            <SetRow
              key={entry.id}
              entry={entry}
              rating={setRatings[entry.id] ?? entry.rating}
              onRate={(value) => {
                setSaved(false)
                setSetRatings((current) => ({ ...current, [entry.id]: value }))
              }}
              onDelete={() => void removeSet(entry)}
              onAddPhoto={(photo) => void addPhoto(entry, photo)}
              onDeletePhoto={(photo) => void removePhoto(photo)}
            />
          ))}
        </ul>
        {event && (
          <Link to={`/check-in/${event.id}`} className="mt-3 flex min-h-touch items-center justify-center rounded-lg bg-surface-2 px-4 font-semibold">
            {t('checkin.addMoreSets')}
          </Link>
        )}
      </Section>

      <Section title={t('checkin.rateEvent')}>
        <div className="space-y-3">
          <OptionalRating label={t('checkin.ratings.overall')} value={rating} onChange={setRating} />
          <OptionalRating label={t('checkin.ratings.sound')} value={ratingSound} onChange={setRatingSound} />
          <OptionalRating label={t('checkin.ratings.crowd')} value={ratingCrowd} onChange={setRatingCrowd} />
          <OptionalRating label={t('checkin.ratings.location')} value={ratingLocation} onChange={setRatingLocation} />
          <OptionalRating label={t('checkin.ratings.lineup')} value={ratingLineup} onChange={setRatingLineup} />
          <TextField label={t('checkin.comment')} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        </div>
      </Section>

      <Section title={t('checkin.visibility')}>
        <div className="flex flex-wrap gap-2">
          {visibilities.map((option) => (
            <Chip key={option ?? 'settings'} selected={visibility === option} onClick={() => setVisibility(option)}>
              {option ? t(`settings.levels.${option}`) : t('checkin.followSettings')}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title={t('checkin.spending')}>
        <p className="mb-2 text-sm text-text-secondary">{t('checkin.spendingHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('checkin.ticketPrice')}
            inputMode="decimal"
            value={ticketPrice ?? String(privateData.data?.ticket_price ?? '')}
            onChange={(e) => setTicketPrice(e.target.value)}
          />
          <TextField
            label={t('checkin.otherSpend')}
            inputMode="decimal"
            value={otherSpend ?? String(privateData.data?.other_spend ?? '')}
            onChange={(e) => setOtherSpend(e.target.value)}
          />
        </div>
      </Section>

      <Button variant="own" className="mt-8 w-full" onClick={() => void save()}>{t('common.save')}</Button>
      {saved && <p className="mt-2 text-center text-sm text-text-secondary">{t('common.saved')}</p>}
      <Button variant="danger" className="mt-3 w-full" onClick={() => void removeCheckin()}>{t('history.delete')}</Button>
    </div>
  )
}

export function CheckinDetailPage() {
  const { t } = useTranslation()
  const { checkinId } = useParams()
  const checkin = useCheckinDetail(checkinId)
  if (checkin.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!checkin.data) return <PlaceholderPage title={t('pages.notFound.title')} body={t('checkin.eventNotFound')} />
  // The key resets the form when another check-in opens or fresh data arrives after a save.
  return <DetailForm key={checkin.data.id} checkin={checkin.data} />
}
