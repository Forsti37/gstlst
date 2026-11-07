import { BadgeCheck, History } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BadgeIcon } from '../badges/BadgeIcon'
import { formatEventDate, setLabel, useMediaUrls } from '../checkin/api'
import { UnderReview } from '../checkin/components'
import { UserAvatar } from '../profile/UserAvatar'
import { useState } from 'react'
import type { FeedCard as Card, FeedSet } from './api'
import { REACTIONS, Reactions } from './Reactions'
import { relativeTime } from './time'

function PhotoCarousel({ paths }: { paths: string[] }) {
  const { t } = useTranslation()
  const { data: urls } = useMediaUrls(paths)
  if (paths.length === 0) return null
  return (
    <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none]">
      {paths.map((path) => (
        <img
          key={path}
          src={urls?.get(path)}
          alt={t('feed.photoAlt')}
          loading="lazy"
          className="aspect-square w-full shrink-0 snap-center bg-surface-2 object-cover"
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

/** A set in one line. Its reactions show as counts and open with a tap, so the card stays short. */
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

/** Like a check-in on Untappd: who was where, what they thought, and what they saw. */
export function FeedCard({ card }: { card: Card }) {
  const { t, i18n } = useTranslation()
  const subRatings = [
    ['sound', card.rating_sound],
    ['crowd', card.rating_crowd],
    ['location', card.rating_location],
    ['lineup', card.rating_lineup],
  ] as const
  const when = card.imported ? formatEventDate(card.event, i18n.resolvedLanguage) : relativeTime(card.created_at, i18n.resolvedLanguage)

  return (
    <article className="rounded-xl bg-surface-1 p-4">
      <div className="flex gap-3">
        <Link to={`/u/${card.user.username}`} className="shrink-0" aria-label={card.user.display_name}>
          <UserAvatar path={card.user.avatar_path} name={card.user.display_name} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="leading-snug">
            <Trans
              i18nKey="feed.wasAt"
              values={{ name: card.user.display_name, event: card.event.name }}
              components={{
                person: <Link to={`/u/${card.user.username}`} className="font-semibold" />,
                event: <Link to={`/events/${card.event.id}`} className="font-semibold" />,
              }}
            />
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-text-secondary">
            <span>{card.event.venue_name}, {card.event.venue_city}</span>
            <UnderReview status={card.event.status} />
          </p>
        </div>
        <Rating value={card.rating} />
      </div>

      {card.companions.length > 0 && (
        <p className="mt-2 text-sm text-text-secondary">{t('feed.with', { names: card.companions.map((c) => c.display_name).join(', ') })}</p>
      )}
      {card.text && <p className="mt-2 whitespace-pre-line">{card.text}</p>}

      {card.sets.length > 0 && (
        <ul className="mt-3 divide-y divide-surface-2 rounded-lg bg-surface-2/40">
          {card.sets.map((set) => <SetRow key={set.id} set={set} reactable={!card.imported} />)}
        </ul>
      )}

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

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Reactions target="event_checkin" targetId={card.id} summary={card.reactions} />
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          {card.verified && <BadgeCheck aria-label={t('history.verified')} className="size-4 text-red" />}
          {card.imported && <History aria-hidden className="size-4" />}
          {card.imported ? t('feed.fromHistory', { date: when }) : when}
        </span>
      </footer>
    </article>
  )
}
