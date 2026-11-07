import { BadgeCheck, History, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useFunFacts } from '../badges/api'
import { BadgeIcon } from '../badges/BadgeIcon'
import { sortFunFacts, useFunFactText } from '../badges/FunFacts'
import { useMember } from '../auth/auth'
import { setLabel, useMediaUrls } from '../checkin/api'
import { UnderReview } from '../checkin/components'
import { UserAvatar } from '../profile/UserAvatar'
import type { FeedCard as Card, FeedSet } from './api'
import { posterLayers } from './poster'
import { REACTIONS, Reactions } from './Reactions'
import { relativeTime } from './time'

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

function Rating({ value, size = 'lg' }: { value: number | null; size?: 'lg' | 'sm' }) {
  if (value === null) return null
  return (
    <span className={`font-display shrink-0 tabular-nums text-red ${size === 'lg' ? 'text-3xl leading-none' : 'text-xl'}`}>
      {value.toFixed(1)}
    </span>
  )
}

/**
 * The event as a little flyer: a red-blue glow that differs per event, a date stub and the name
 * in the display font. There are no event images, so this is what makes a card recognisable.
 */
function Poster({ card }: { card: Card }) {
  const { i18n } = useTranslation()
  const date = new Date(`${card.event.date_start}T12:00:00Z`)
  const language = i18n.resolvedLanguage
  return (
    <Link
      to={`/events/${card.event.id}`}
      className="relative block overflow-hidden rounded-lg bg-surface-2 p-4"
      style={{ backgroundImage: posterLayers(card.event.id) }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md bg-bg/70 px-2.5 py-1.5 text-center leading-none">
          <span className="font-display block text-3xl">{date.getUTCDate()}</span>
          <span className="block text-[11px] font-semibold tracking-wide uppercase">
            {date.toLocaleDateString(language, { month: 'short', timeZone: 'UTC' })} {date.getUTCFullYear()}
          </span>
        </div>
        {card.rating !== null && (
          <span className="font-display rounded-md bg-bg/70 px-2.5 py-1 text-3xl leading-none text-red tabular-nums">{card.rating.toFixed(1)}</span>
        )}
      </div>
      <p className="font-display brand-offset mt-6 text-3xl leading-none break-words uppercase">{card.event.name}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm font-medium text-text-primary/85">
        <span>{card.event.venue_name} · {card.event.venue_city}</span>
        <UnderReview status={card.event.status} />
      </p>
    </Link>
  )
}

/** A rated set in one line. Its reactions show as counts and open with a tap. */
function SetRow({ set, reactable }: { set: FeedSet; reactable: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const counts = REACTIONS.filter(({ kind }) => set.reactions[kind] > 0)
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate font-medium">{setLabel(set)}</span>
      {counts.length > 0 && (
        <span className="shrink-0 text-xs text-text-secondary tabular-nums">
          {counts.map(({ kind, emoji }) => `${emoji}${set.reactions[kind]}`).join(' ')}
        </span>
      )}
      <UnderReview status={set.status} />
      <Rating value={set.rating} size="sm" />
    </>
  )
  return (
    <li className="px-3">
      {reactable ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={t('feed.reactToSet', { name: setLabel(set) })}
          onClick={() => setOpen(!open)}
          className="flex min-h-touch w-full items-center gap-2 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-h-touch items-center gap-2">{body}</div>
      )}
      {set.text && <p className="pb-2 text-sm text-text-secondary">{set.text}</p>}
      {open && (
        <div className="pb-2">
          <Reactions target="set_checkin" targetId={set.id} summary={set.reactions} />
        </div>
      )}
    </li>
  )
}

/** Unrated sets, like most of the imported history, as a lineup of names. */
function LineupChips({ sets }: { sets: FeedSet[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {sets.map((set) => (
        <li key={set.id} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-sm font-medium">
          <span aria-hidden className="font-display grid size-6 place-items-center rounded-full bg-bg text-xs">
            {setLabel(set).slice(0, 1).toUpperCase()}
          </span>
          {setLabel(set)}
        </li>
      ))}
    </ul>
  )
}

/** Fun facts are visible to their owner only, so only your own cards get them. */
function Highlights({ checkinId }: { checkinId: string }) {
  const facts = useFunFacts(checkinId)
  const text = useFunFactText()
  const top = sortFunFacts(facts.data ?? []).slice(0, 2)
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

/** Like a check-in on Untappd: who was where, what they thought, and what they saw. */
export function FeedCard({ card }: { card: Card }) {
  const { t, i18n } = useTranslation()
  const me = useMember()
  const subRatings = [
    ['sound', card.rating_sound],
    ['crowd', card.rating_crowd],
    ['location', card.rating_location],
    ['lineup', card.rating_lineup],
  ] as const
  const rated = card.sets.some((set) => set.rating !== null)

  return (
    <article className="rounded-xl bg-surface-1 p-3">
      <header className="flex items-center gap-3 px-1 pb-3">
        <Link to={`/u/${card.user.username}`} className="shrink-0" aria-label={card.user.display_name}>
          <UserAvatar path={card.user.avatar_path} name={card.user.display_name} />
        </Link>
        <p className="min-w-0 flex-1 leading-snug">
          <Trans
            i18nKey="feed.wasAtShort"
            values={{ name: card.user.display_name }}
            components={{ person: <Link to={`/u/${card.user.username}`} className="font-semibold" /> }}
          />
          <span className="block text-xs text-text-secondary">
            {card.imported ? t('feed.fromHistoryShort') : relativeTime(card.created_at, i18n.resolvedLanguage)}
            {card.sets.length > 0 && ` · ${t('feed.setCount', { count: card.sets.length })}`}
          </span>
        </p>
        {card.verified && <BadgeCheck aria-label={t('history.verified')} className="size-5 shrink-0 text-red" />}
        {card.imported && <History aria-label={t('feed.fromHistoryShort')} className="size-5 shrink-0 text-text-secondary" />}
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
                {card.sets.map((set) => <SetRow key={set.id} set={set} reactable={!card.imported} />)}
              </ul>
            ) : (
              <LineupChips sets={card.sets} />
            )}
          </div>
        )}

        {card.user.id === me.id && <Highlights checkinId={card.id} />}

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
          <Reactions target="event_checkin" targetId={card.id} summary={card.reactions} />
        </div>
      </div>
    </article>
  )
}
