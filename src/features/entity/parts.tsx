import { Check, Plus } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Section } from '../../app/ui'
import { formatEventDate } from '../checkin/api'
import { UnderReview } from '../checkin/components'
import { FeedCard } from '../feed/FeedCard'
import { posterLayers } from '../feed/poster'
import { UserAvatar } from '../profile/UserAvatar'
import { StatTile } from '../stats/ProfileStatsSection'
import { useEntityCheckins, useGoing, usePersonal, useUpcoming, type Entity } from './api'

/** The top of an artist, venue or promoter page, in the look of the event flyers. */
export function EntityHeader({
  id,
  kicker,
  name,
  subline,
  status,
  children,
}: {
  id: string
  kicker: string
  name: string
  subline?: ReactNode
  status?: 'pending' | 'approved' | 'rejected'
  children?: ReactNode
}) {
  return (
    <header className="-mx-4 bg-surface-2 px-4 pt-6 pb-5" style={{ backgroundImage: posterLayers(id) }}>
      <p className="text-xs font-semibold tracking-widest text-text-primary/80 uppercase">{kicker}</p>
      <h1 className="font-display brand-offset mt-2 text-5xl leading-none break-words uppercase">{name}</h1>
      {subline && <div className="mt-2 text-sm font-medium text-text-primary/85">{subline}</div>}
      <div className="mt-1"><UnderReview status={status} /></div>
      {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}

function UpcomingRow({ event }: { event: { id: string; name: string; date_start: string; date_end: string | null; status: 'pending' | 'approved' | 'rejected'; venue_name: string; venue_city: string } }) {
  const { t, i18n } = useTranslation()
  const { mine, friends, toggle, loading } = useGoing(event.id)
  return (
    <li className="flex items-center gap-3 rounded-lg bg-surface-1 py-2 pr-2 pl-4">
      <Link to={`/events/${event.id}`} className="min-w-0 flex-1">
        <span className="block truncate font-medium">{event.name}</span>
        <span className="block truncate text-sm text-text-secondary">
          {formatEventDate(event, i18n.resolvedLanguage)} · {event.venue_name}, {event.venue_city}
          {friends > 0 && ` · ${t('entity.friendsGoing', { count: friends })}`}
        </span>
      </Link>
      <button
        type="button"
        aria-pressed={mine}
        disabled={loading || toggle.isPending}
        onClick={() => toggle.mutate()}
        className="flex min-h-touch shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 text-sm font-semibold aria-pressed:bg-blue aria-pressed:text-white"
      >
        {mine ? <Check aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
        {t('entity.going')}
      </button>
    </li>
  )
}

export function UpcomingSection({ entity, id }: { entity: Entity; id: string }) {
  const { t } = useTranslation()
  const upcoming = useUpcoming(entity, id)
  if (!upcoming.data?.length) return null
  return (
    <Section title={t('entity.upcoming')}>
      <ul className="space-y-2">
        {upcoming.data.map((event) => <UpcomingRow key={event.id} event={event} />)}
      </ul>
    </Section>
  )
}

/** Your own history with this artist, venue or promoter. */
export function PersonalSection({ entity, id }: { entity: Entity; id: string }) {
  const { t, i18n } = useTranslation()
  const personal = usePersonal(entity, id)
  const data = personal.data
  if (!data) return null
  if (data.count === 0) {
    return (
      <Section title={t('entity.you')}>
        <p className="text-text-secondary">{t(`entity.never.${entity}`)}</p>
      </Section>
    )
  }
  const rating = data.avg_rating == null ? '–' : data.avg_rating.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })
  return (
    <Section title={t('entity.you')}>
      {/* No empty rating tile: most of the imported history has no ratings. */}
      <dl className={`grid gap-2 ${data.avg_rating == null ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <StatTile label={t(`entity.count.${entity}`, { count: data.count })} value={data.count} />
        {data.avg_rating != null && <StatTile label={t('stats.avgRating')} value={rating} />}
      </dl>
      {data.last && (
        <Link to={`/events/${data.last.event_id}`} className="mt-2 flex min-h-touch items-center rounded-lg bg-surface-1 px-4 text-sm">
          <span className="text-text-secondary">{t('entity.last')}&nbsp;</span>
          <span className="truncate font-medium">{data.last.name}</span>
          <span className="ml-auto shrink-0 pl-2 text-text-secondary">{formatEventDate({ date_start: data.last.date_start, date_end: null }, i18n.resolvedLanguage)}</span>
        </Link>
      )}
    </Section>
  )
}

export function FriendsSection({ entity, id }: { entity: Entity; id: string }) {
  const { t } = useTranslation()
  const personal = usePersonal(entity, id)
  const friends = personal.data?.friends ?? []
  if (friends.length === 0) return null
  return (
    <Section title={t('entity.friends')}>
      <ul className="space-y-1">
        {friends.map((friend) => (
          <li key={friend.username}>
            <Link to={`/u/${friend.username}`} className="flex min-h-touch items-center gap-3">
              <UserAvatar path={friend.avatar_path} name={friend.display_name} />
              <span className="min-w-0 flex-1 truncate font-medium">{friend.display_name}</span>
              <span className="shrink-0 text-sm text-text-secondary tabular-nums">{t(`entity.times.${entity}`, { count: friend.times })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** Check-ins of everyone the viewer may see, as cards like in the feed. */
export function CheckinsSection({ entity, id }: { entity: Entity; id: string }) {
  const { t } = useTranslation()
  const checkins = useEntityCheckins(entity, id)
  const sentinel = useRef<HTMLDivElement>(null)
  const cards = checkins.data?.pages.flat() ?? []
  const { hasNextPage, fetchNextPage } = checkins

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage()
    }, { rootMargin: '600px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, cards.length])

  if (checkins.isPending) return null
  return (
    <Section title={t('entity.checkins')}>
      {cards.length === 0 && <p className="text-text-secondary">{t('entity.noCheckins')}</p>}
      <div className="space-y-3">
        {cards.map((card) => <FeedCard key={card.id} card={card} />)}
      </div>
      <div ref={sentinel} aria-hidden className="h-1" />
      {checkins.isFetchingNextPage && <p className="py-4 text-center text-sm text-text-secondary">{t('common.loading')}</p>}
    </Section>
  )
}
