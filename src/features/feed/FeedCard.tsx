import { BadgeCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatEventDate, setLabel, useMediaUrls } from '../checkin/api'
import { UnderReview } from '../checkin/components'
import { UserAvatar } from '../profile/UserAvatar'
import type { FeedCard as Card } from './api'
import { Reactions } from './Reactions'

function PhotoCarousel({ paths }: { paths: string[] }) {
  const { t } = useTranslation()
  const { data: urls } = useMediaUrls(paths)
  if (paths.length === 0) return null
  return (
    <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-1 overflow-x-auto">
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

function Rating({ value }: { value: number | null }) {
  if (value === null) return null
  return <span className="font-display shrink-0 text-2xl tabular-nums text-red">{value.toFixed(1)}</span>
}

export function FeedCard({ card }: { card: Card }) {
  const { t, i18n } = useTranslation()
  const subRatings = [
    ['sound', card.rating_sound],
    ['crowd', card.rating_crowd],
    ['location', card.rating_location],
    ['lineup', card.rating_lineup],
  ] as const

  return (
    <article className="rounded-xl bg-surface-1 p-4">
      <header className="flex items-center gap-3">
        <Link to={`/u/${card.user.username}`} className="flex min-h-touch min-w-0 flex-1 items-center gap-3">
          <UserAvatar path={card.user.avatar_path} name={card.user.display_name} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{card.user.display_name}</span>
            <span className="block truncate text-xs text-text-secondary">{new Date(card.created_at).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'short', timeStyle: 'short' })}</span>
          </span>
        </Link>
        {card.verified && <BadgeCheck aria-label={t('history.verified')} className="size-5 shrink-0 text-red" />}
        <Rating value={card.rating} />
      </header>

      <Link to={`/events/${card.event.id}`} className="mt-2 block">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {card.event.name}
          <UnderReview status={card.event.status} />
        </span>
        <span className="block text-sm text-text-secondary">
          {formatEventDate(card.event, i18n.resolvedLanguage)} · {card.event.venue_name}, {card.event.venue_city}
        </span>
      </Link>

      {card.companions.length > 0 && (
        <p className="mt-1 text-sm text-text-secondary">{t('feed.with', { names: card.companions.map((c) => c.display_name).join(', ') })}</p>
      )}
      {card.text && <p className="mt-2 whitespace-pre-line">{card.text}</p>}
      {subRatings.some(([, value]) => value !== null) && (
        <ul className="mt-2 flex flex-wrap gap-x-3 text-xs text-text-secondary">
          {subRatings.map(([key, value]) => value !== null && <li key={key}>{t(`checkin.ratings.${key}`)} {value.toFixed(1)}</li>)}
        </ul>
      )}

      <PhotoCarousel paths={card.photos} />

      <div className="mt-3">
        <Reactions target="event_checkin" targetId={card.id} summary={card.reactions} />
      </div>

      {card.sets.length > 0 && (
        <ul className="mt-3 space-y-3 border-t border-surface-2 pt-3">
          {card.sets.map((set) => (
            <li key={set.id}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-medium">{setLabel(set)}</span>
                <UnderReview status={set.status} />
                <Rating value={set.rating} />
              </div>
              {set.text && <p className="mt-1 text-sm text-text-secondary">{set.text}</p>}
              <div className="mt-1">
                <Reactions target="set_checkin" targetId={set.id} summary={set.reactions} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
