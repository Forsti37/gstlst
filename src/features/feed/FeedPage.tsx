import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useFriendsFeed, usePublicFeed, type FeedCard as Card } from './api'
import { FeedCard } from './FeedCard'

type Tab = 'friends' | 'public'
type FeedQuery = UseInfiniteQueryResult<InfiniteData<Card[], unknown>, Error>

const PULL_THRESHOLD = 70
const SWIPE_DISTANCE = 70

function FeedList({ query, empty }: { query: FeedQuery; empty: string }) {
  const { t } = useTranslation()
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const sentinel = useRef<HTMLDivElement>(null)
  const cards = data?.pages.flat() ?? []

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage()
    }, { rootMargin: '600px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, cards.length])

  return (
    <>
      {isPending && <p className="py-6 text-text-secondary">{t('common.loading')}</p>}
      {isError && cards.length === 0 && <p className="py-6 text-text-secondary">{t('feed.offline')}</p>}
      {!isPending && !isError && cards.length === 0 && (
        <div className="py-6 text-text-secondary">
          <p>{empty}</p>
          <Link to="/friends" className="mt-3 inline-flex min-h-touch items-center text-blue">{t('feed.findFriends')}</Link>
        </div>
      )}
      <div className="space-y-3">
        {cards.map((card) => <FeedCard key={card.id} card={card} />)}
      </div>
      <div ref={sentinel} aria-hidden className="h-1" />
      {isFetchingNextPage && <p className="py-4 text-center text-sm text-text-secondary">{t('common.loading')}</p>}
    </>
  )
}

/**
 * One list at a time, switched by a segmented control. A sideways swipe switches too, but there
 * is no horizontal scroll container any more: that is what showed a scroll bar and stuttered.
 */
export function FeedPage() {
  const { t } = useTranslation()
  const friends = useFriendsFeed()
  const publicFeed = usePublicFeed()
  const [active, setActive] = useState<Tab>('friends')
  const [pull, setPull] = useState(0)
  const touch = useRef<{ x: number; y: number; atTop: boolean } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const query = active === 'friends' ? friends : publicFeed

  const scroller = () => root.current?.closest('main') ?? null
  const show = (tab: Tab) => {
    if (tab === active) return
    setActive(tab)
    scroller()?.scrollTo({ top: 0 })
  }

  const onTouchStart = (event: TouchEvent) => {
    const point = event.touches[0]
    if (!point) return
    touch.current = { x: point.clientX, y: point.clientY, atTop: (scroller()?.scrollTop ?? 0) <= 0 }
  }
  const onTouchMove = (event: TouchEvent) => {
    const start = touch.current
    const point = event.touches[0]
    if (!start || !point || !start.atTop) return
    const down = point.clientY - start.y
    // Only a mostly vertical pull from the very top refreshes.
    if (down > 0 && Math.abs(point.clientX - start.x) < down) setPull(down)
  }
  const onTouchEnd = (event: TouchEvent) => {
    const start = touch.current
    const point = event.changedTouches[0]
    touch.current = null
    if (pull > PULL_THRESHOLD) void query.refetch()
    setPull(0)
    if (!start || !point) return
    const dx = point.clientX - start.x
    const dy = point.clientY - start.y
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 2) show(dx < 0 ? 'public' : 'friends')
  }

  const tab = (name: Tab) => (
    <button
      type="button"
      role="tab"
      aria-selected={active === name}
      onClick={() => show(name)}
      className="min-h-touch flex-1 rounded-md text-sm font-semibold text-text-secondary aria-selected:bg-blue aria-selected:text-white"
    >
      {t(`feed.tabs.${name}`)}
    </button>
  )

  return (
    <div ref={root} className="min-h-full px-4 pb-6" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <header className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pt-4 pb-3 backdrop-blur">
        <h1 className="brand-offset font-display text-3xl tracking-wide">GSTLST</h1>
        <div role="tablist" aria-label={t('nav.feed')} className="mt-3 flex gap-1 rounded-lg bg-surface-1 p-1">
          {tab('friends')}
          {tab('public')}
        </div>
      </header>
      {(pull > 0 || query.isRefetching) && (
        <p aria-live="polite" className="py-2 text-center text-sm text-text-secondary" style={{ minHeight: Math.min(pull, 80) }}>
          {query.isRefetching ? t('common.loading') : pull > PULL_THRESHOLD ? t('feed.releaseToRefresh') : t('feed.pullToRefresh')}
        </p>
      )}
      <section role="tabpanel" aria-label={t(`feed.tabs.${active}`)}>
        <FeedList key={active} query={query} empty={active === 'friends' ? t('feed.emptyFriends') : t('feed.emptyPublic')} />
      </section>
    </div>
  )
}
