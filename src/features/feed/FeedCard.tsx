import { BadgeCheck, ChevronRight, History, Pencil, SmilePlus, Sparkles } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useFunFacts } from '../badges/api'
import { BadgeIcon } from '../badges/BadgeIcon'
import { sortFunFacts, useFunFactText } from '../badges/FunFacts'
import { useMember } from '../auth/auth'
import { useMediaUrls } from '../checkin/api'
import { UnderReview } from '../checkin/components'
import { UserAvatar } from '../profile/UserAvatar'
import type { FeedCard as Card, FeedSet } from './api'
import { posterLayers } from './poster'
import { REACTIONS, Reactions } from './Reactions'
import { relativeTime } from './time'

export const checkinPath = (id: string) => `/check-ins/${id}`
export const checkinEditPath = (id: string) => `/check-ins/${id}/edit`

function PhotoCarousel({ paths }: { paths: string[] }) {
  const { t } = useTranslation()
  const { data: urls } = useMediaUrls(paths)
  if (paths.length === 0) return null
  return (
    <div className="mt-3 flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none]">
      {paths.map((path) => (
        <img
          key={path}
          src={urls?.get(path)}
          alt={t('feed.photoAlt')}
          loading="lazy"
          className="aspect-square w-full shrink-0 snap-center rounded-lg bg-surface-2 object-cover"
        />
      ))}
    </div>
  )
}

function Rating({ value }: { value: number | null }) {
  if (value === null) return null
  return <span className="font-display shrink-0 text-xl tabular-nums text-red">{value.toFixed(1)}</span>
}

/** The names of a set, each one linking to its artist profile. */
function SetArtists({ set }: { set: FeedSet }) {
  const main = set.set_artists.filter((entry) => entry.artist && entry.role !== 'mc')
  const mcs = set.set_artists.filter((entry) => entry.artist && entry.role === 'mc')
  const separator = set.set_type === 'f2f' ? ' f2f ' : ' b2b '
  const link = (entry: (typeof main)[number]) => (
    <Link to={`/artists/${entry.artist!.id}`} className="font-medium hover:underline">{entry.artist!.name}</Link>
  )
  return (
    <span className="min-w-0 flex-1 truncate">
      {main.map((entry, index) => (
        <Fragment key={entry.artist!.id}>
          {index > 0 && <span className="text-text-secondary">{separator}</span>}
          {link(entry)}
        </Fragment>
      ))}
      {mcs.length > 0 && <span className="text-text-secondary"> ft. </span>}
      {mcs.map((entry, index) => (
        <Fragment key={entry.artist!.id}>
          {index > 0 && ', '}
          {link(entry)}
        </Fragment>
      ))}
    </span>
  )
}

/**
 * The event as a little flyer. Everything on it leads somewhere: the name to the event, the venue
 * to its page, each promoter to theirs, and the date stub to this check-in.
 */
function Poster({ card }: { card: Card }) {
  const { t, i18n } = useTranslation()
  const date = new Date(`${card.event.date_start}T12:00:00Z`)
  const promoters = card.event.promoters ?? []
  return (
    <div className="rounded-lg bg-surface-2 p-4" style={{ backgroundImage: posterLayers(card.event.id) }}>
      <div className="flex items-start justify-between gap-3">
        <Link to={checkinPath(card.id)} aria-label={t('feed.openCheckin')} className="rounded-md bg-bg/70 px-2.5 py-1.5 text-center leading-none">
          <span className="font-display block text-3xl">{date.getUTCDate()}</span>
          <span className="block text-[11px] font-semibold tracking-wide uppercase">
            {date.toLocaleDateString(i18n.resolvedLanguage, { month: 'short', timeZone: 'UTC' })} {date.getUTCFullYear()}
          </span>
        </Link>
        {card.rating !== null && (
          <span className="font-display rounded-md bg-bg/70 px-2.5 py-1 text-3xl leading-none text-red tabular-nums">{card.rating.toFixed(1)}</span>
        )}
      </div>
      <Link to={`/events/${card.event.id}`} className="font-display brand-offset mt-6 block text-3xl leading-none break-words uppercase">
        {card.event.name}
      </Link>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm font-medium text-text-primary/85">
        {card.event.venue_id ? (
          <Link to={`/venues/${card.event.venue_id}`} className="inline-flex min-h-8 items-center hover:underline">{card.event.venue_name} · {card.event.venue_city}</Link>
        ) : (
          <span>{card.event.venue_name} · {card.event.venue_city}</span>
        )}
        <UnderReview status={card.event.status} />
      </p>
      {promoters.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1 text-sm text-text-primary/75">
          <span>{t('feed.by')}</span>
          {promoters.map((promoter, index) => (
            <Fragment key={promoter.id}>
              {index > 0 && <span>·</span>}
              <Link to={`/promoters/${promoter.id}`} className="inline-flex min-h-8 items-center font-medium hover:underline">{promoter.name}</Link>
            </Fragment>
          ))}
        </p>
      )}
    </div>
  )
}

/** A rated set. Its reactions show as counts and open with the button on the right. */
function SetRow({ set, reactable, expanded }: { set: FeedSet; reactable: boolean; expanded: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(expanded)
  const counts = REACTIONS.filter(({ kind }) => set.reactions[kind] > 0)
  return (
    <li className="px-3">
      <div className="flex min-h-touch items-center gap-2">
        <SetArtists set={set} />
        <UnderReview status={set.status} />
        {reactable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={t('feed.reactToSet', { name: set.set_artists.map((entry) => entry.artist?.name).filter(Boolean).join(' & ') })}
            onClick={() => setOpen(!open)}
            className="flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-1 text-xs text-text-secondary tabular-nums"
          >
            {counts.length > 0 ? counts.map(({ kind, emoji }) => `${emoji}${set.reactions[kind]}`).join(' ') : <SmilePlus aria-hidden className="size-5" />}
          </button>
        ) : (
          counts.length > 0 && (
            <span className="shrink-0 text-xs text-text-secondary tabular-nums">{counts.map(({ kind, emoji }) => `${emoji}${set.reactions[kind]}`).join(' ')}</span>
          )
        )}
        <Rating value={set.rating} />
      </div>
      {set.text && <p className="pb-2 text-sm text-text-secondary">{set.text}</p>}
      {open && reactable && (
        <div className="pb-2">
          <Reactions target="set_checkin" targetId={set.id} summary={set.reactions} />
        </div>
      )}
    </li>
  )
}

/** Unrated sets, like most of the imported history, as a lineup of artist chips. */
function LineupChips({ sets }: { sets: FeedSet[] }) {
  const artists = sets.flatMap((set) => set.set_artists.flatMap((entry) => (entry.artist ? [entry.artist] : [])))
  const unique = [...new Map(artists.map((artist) => [artist.id, artist])).values()]
  return (
    <ul className="flex flex-wrap gap-1.5">
      {unique.map((artist) => (
        <li key={artist.id}>
          <Link to={`/artists/${artist.id}`} className="flex min-h-9 items-center gap-1.5 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-sm font-medium">
            <span aria-hidden className="font-display grid size-6 place-items-center rounded-full bg-bg text-xs">{artist.name.slice(0, 1).toUpperCase()}</span>
            {artist.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Fun facts are visible to their owner only, so only your own cards get them. */
function Highlights({ checkinId, limit }: { checkinId: string; limit?: number }) {
  const facts = useFunFacts(checkinId)
  const text = useFunFactText()
  const top = sortFunFacts(facts.data ?? []).slice(0, limit)
  if (top.length === 0) return null
  return (
    <ul className="mt-3 space-y-1">
      {top.map((fact) => (
        <li key={fact.id} className="flex items-start gap-2 text-sm">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
          <span>{text(fact)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Like a check-in on Untappd: who was where, what they thought, and what they saw. In the feed it
 * stays compact; on the check-in page (detail) set reactions are open and all highlights show.
 */
export function FeedCard({ card, detail = false }: { card: Card; detail?: boolean }) {
  const { t, i18n } = useTranslation()
  const me = useMember()
  const own = card.user.id === me.id
  const subRatings = [
    ['sound', card.rating_sound],
    ['crowd', card.rating_crowd],
    ['location', card.rating_location],
    ['lineup', card.rating_lineup],
  ] as const
  const rated = card.sets.some((set) => set.rating !== null)
  const meta = (
    <>
      {card.imported ? t('feed.fromHistoryShort') : relativeTime(card.created_at, i18n.resolvedLanguage)}
      {card.sets.length > 0 && ` · ${t('feed.setCount', { count: card.sets.length })}`}
    </>
  )

  return (
    <article className="rounded-xl bg-surface-1 p-3">
      <header className="flex items-center gap-3 px-1 pb-3">
        <Link to={`/u/${card.user.username}`} className="shrink-0" aria-label={card.user.display_name}>
          <UserAvatar path={card.user.avatar_path} name={card.user.display_name} />
        </Link>
        <div className="min-w-0 flex-1 leading-snug">
          <p>
            <Trans
              i18nKey="feed.wasAtShort"
              values={{ name: card.user.display_name }}
              components={{ person: <Link to={`/u/${card.user.username}`} className="font-semibold" /> }}
            />
          </p>
          {detail ? (
            <p className="text-xs text-text-secondary">{meta}</p>
          ) : (
            <Link to={checkinPath(card.id)} className="flex items-center gap-0.5 text-xs text-text-secondary">
              {meta}
              <ChevronRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
        {card.verified && <BadgeCheck aria-label={t('history.verified')} className="size-5 shrink-0 text-red" />}
        {card.imported && <History aria-label={t('feed.fromHistoryShort')} className="size-5 shrink-0 text-text-secondary" />}
        {own && (
          <Link to={checkinEditPath(card.id)} aria-label={t('feed.edit')} className="grid size-touch shrink-0 place-items-center rounded-full bg-surface-2">
            <Pencil aria-hidden className="size-5" />
          </Link>
        )}
      </header>

      <Poster card={card} />

      <div className="px-1">
        {card.companions.length > 0 && (
          <p className="mt-3 text-sm text-text-secondary">{t('feed.with', { names: card.companions.map((c) => c.display_name).join(', ') })}</p>
        )}
        {card.text && <p className="mt-3 text-[15px] whitespace-pre-line">{card.text}</p>}

        {card.sets.length > 0 && (
          <div className="mt-3">
            {rated ? (
              <ul className="divide-y divide-surface-2 rounded-lg bg-surface-2/40">
                {card.sets.map((set) => <SetRow key={set.id} set={set} reactable={!own && !card.imported} expanded={detail} />)}
              </ul>
            ) : (
              <LineupChips sets={card.sets} />
            )}
          </div>
        )}

        {own && <Highlights checkinId={card.id} limit={detail ? undefined : 2} />}

        {subRatings.some(([, value]) => value !== null) && (
          <ul className="mt-2 flex flex-wrap gap-x-3 text-xs text-text-secondary">
            {subRatings.map(([key, value]) => value !== null && <li key={key}>{t(`checkin.ratings.${key}`)} {value.toFixed(1)}</li>)}
          </ul>
        )}
        {card.badges && card.badges.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {card.badges.map((badge) => (
              <li key={badge.id} className="flex items-center gap-2 rounded-lg bg-surface-2 py-1 pr-3 pl-1 text-sm font-medium">
                <BadgeIcon category={badge.category} level={badge.level} size={32} />
                {badge.name}
              </li>
            ))}
          </ul>
        )}

        <PhotoCarousel paths={card.photos} />

        <div className="mt-3">
          <Reactions target="event_checkin" targetId={card.id} summary={card.reactions} readOnly={own} />
        </div>
      </div>
    </article>
  )
}
