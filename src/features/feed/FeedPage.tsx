import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useFriendsFeed, usePublicFeed, type FeedCard as Card } from './api'
import { FeedCard } from './FeedCard'

const PULL_THRESHOLD = 70

function FeedPane({
  query,
  label,
  empty,
}: {
  query: UseInfiniteQueryResult<InfiniteData<Card[], unknown>, Error>
  label: string
  empty: string
}) {
  const { t } = useTranslation()
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch, isRefetching } = query
  const sentinel = useRef<HTMLDivElement>(null)
  const pane = useRef<HTMLDivElement>(null)
  const pullStart = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const cards = data?.pages.flat() ?? []

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage()
    }, { root: pane.current, rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, cards.length])

  const onTouchStart = (event: TouchEvent) => {
    pullStart.current = (pane.current?.scrollTop ?? 1) <= 0 ? (event.touches[0]?.clientY ?? null) : null
  }
  const onTouchMove = (event: TouchEvent) => {
    if (pullStart.current === null) return
    setPull(Math.max(0, (event.touches[0]?.clientY ?? 0) - pullStart.current))
  }
  const onTouchEnd = () => {
    if (pull > PULL_THRESHOLD) void refetch()
    pullStart.current = null
    setPull(0)
  }

  return (
    <section
      ref={pane}
      aria-label={label}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="h-full w-full shrink-0 snap-start overflow-y-auto overscroll-contain px-4 pb-6"
    >
      {(pull > 0 || isRefetching) && (
        <p aria-live="polite" className="py-2 text-center text-sm text-text-secondary" style={{ minHeight: Math.min(pull, 80) }}>
          {isRefetching ? t('common.loading') : pull > PULL_THRESHOLD ? t('feed.releaseToRefresh') : t('feed.pullToRefresh')}
        </p>
      )}
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
    </section>
  )
}

/** Two panes side by side: swiping scrolls between them, and the tabs follow. */
export function FeedPage() {
  const { t } = useTranslation()
  const friends = useFriendsFeed()
  const publicFeed = usePublicFeed()
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<'friends' | 'public'>('friends')

  const show = (tab: 'friends' | 'public') => {
    const node = scroller.current
    node?.scrollTo?.({ left: tab === 'friends' ? 0 : node.clientWidth, behavior: 'smooth' })
    setActive(tab)
  }
  const onScroll = () => {
    const node = scroller.current
    if (node) setActive(node.scrollLeft > node.clientWidth / 2 ? 'public' : 'friends')
  }

  const tab = (name: 'friends' | 'public') => (
    <button
      type="button"
      role="tab"
      aria-selected={active === name}
      onClick={() => show(name)}
      className="min-h-touch flex-1 border-b-2 border-transparent font-semibold text-text-secondary aria-selected:border-blue aria-selected:text-text-primary"
    >
      {t(`feed.tabs.${name}`)}
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pt-4">
        <h1 className="brand-offset font-display text-3xl tracking-wide">GSTLST</h1>
        <div role="tablist" aria-label={t('nav.feed')} className="mt-2 flex">
          {tab('friends')}
          {tab('public')}
        </div>
      </header>
      <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 snap-x snap-mandatory gap-0 overflow-x-auto pt-3">
        <FeedPane query={friends} label={t('feed.tabs.friends')} empty={t('feed.emptyFriends')} />
        <FeedPane query={publicFeed} label={t('feed.tabs.public')} empty={t('feed.emptyPublic')} />
      </div>
    </div>
  )
}
