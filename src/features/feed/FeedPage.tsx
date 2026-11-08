import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useFriendsFeed, usePublicFeed, type FeedCard as Card } from './api'
import { FeedCard } from './FeedCard'

type Tab = 'friends' | 'public'
type FeedQuery = UseInfiniteQueryResult<InfiniteData<Card[], unknown>, Error>

const PULL_THRESHOLD = 70
/** Share of the width a slow swipe has to travel before it switches. */
const SWIPE_SHARE = 0.12
/** A short flick switches too: at least this far, at least this fast (px per ms). */
const FLICK_DISTANCE = 30
const FLICK_SPEED = 0.3

function FeedList({ query, empty, active }: { query: FeedQuery; empty: string; active: boolean }) {
  const { t } = useTranslation()
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const sentinel = useRef<HTMLDivElement>(null)
  const cards = data?.pages.flat() ?? []

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage || !active) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage()
    }, { rootMargin: '600px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, cards.length, active])

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
 * Both lists stay rendered side by side and slide with the finger, so switching is instant and
 * a swipe works anywhere on the page. The track is moved with a transform, never scrolled, so
 * there is no scroll bar. Vertical scrolling stays with the browser (touch-action: pan-y).
 */
export function FeedPage() {
  const { t } = useTranslation()
  const friends = useFriendsFeed()
  const publicFeed = usePublicFeed()
  const [active, setActive] = useState<Tab>('friends')
  const [drag, setDrag] = useState(0)
  // Read at the end of a gesture, which may come before React has rendered the last move.
  const dragRef = useRef(0)
  const [settled, setSettled] = useState(true)
  const [pull, setPull] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; time: number; axis: 'x' | 'y' | null; atTop: boolean } | null>(null)
  const query = active === 'friends' ? friends : publicFeed

  const scroller = () => root.current?.closest('main') ?? null
  const show = (tab: Tab) => {
    if (tab !== active) {
      setSettled(false)
      setActive(tab)
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return
    gesture.current = { x: event.clientX, y: event.clientY, time: event.timeStamp, axis: null, atTop: (scroller()?.scrollTop ?? 0) <= 0 }
  }
  const onPointerMove = (event: PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dx = event.clientX - g.x
    const dy = event.clientY - g.y
    if (!g.axis && Math.hypot(dx, dy) > 8) g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (g.axis !== 'x') return
    // Resist past the edges: there is nothing left of friends or right of public.
    const towardsNothing = (active === 'friends' && dx > 0) || (active === 'public' && dx < 0)
    dragRef.current = towardsNothing ? dx / 4 : dx
    setDrag(dragRef.current)
  }
  const endGesture = (event: PointerEvent) => {
    const width = root.current?.clientWidth ?? 1
    const distance = dragRef.current
    const elapsed = Math.max(1, event.timeStamp - (gesture.current?.time ?? event.timeStamp))
    const far = Math.abs(distance) > width * SWIPE_SHARE
    const flick = Math.abs(distance) > FLICK_DISTANCE && Math.abs(distance) / elapsed > FLICK_SPEED
    if (far || flick) show(distance < 0 ? 'public' : 'friends')
    dragRef.current = 0
    setDrag(0)
    gesture.current = null
  }

  // Pull to refresh stays a touch gesture on the vertical axis, from the very top.
  const touchStart = useRef<number | null>(null)
  const onTouchStart = (event: TouchEvent) => {
    touchStart.current = (scroller()?.scrollTop ?? 1) <= 0 ? (event.touches[0]?.clientY ?? null) : null
  }
  const onTouchMove = (event: TouchEvent) => {
    if (touchStart.current === null || gesture.current?.axis === 'x') return
    setPull(Math.max(0, (event.touches[0]?.clientY ?? 0) - touchStart.current))
  }
  const onTouchEnd = () => {
    if (pull > PULL_THRESHOLD) void query.refetch()
    touchStart.current = null
    setPull(0)
  }

  // After a switch the hidden list must not set the page height, or you'd scroll into nothing.
  useEffect(() => {
    if (settled) return
    scroller()?.scrollTo({ top: 0 })
    const timer = setTimeout(() => setSettled(true), 260)
    return () => clearTimeout(timer)
  }, [settled])

  const offset = active === 'friends' ? 0 : -50
  const dragging = drag !== 0

  const tab = (name: Tab) => (
    <button
      type="button"
      role="tab"
      aria-selected={active === name}
      onClick={() => show(name)}
      className="min-h-touch flex-1 rounded-md text-sm font-semibold text-text-secondary transition-colors aria-selected:bg-blue aria-selected:text-white"
    >
      {t(`feed.tabs.${name}`)}
    </button>
  )

  const panel = (name: Tab, list: FeedQuery, empty: string) => {
    const visible = name === active
    return (
      <section
        role="tabpanel"
        aria-label={t(`feed.tabs.${name}`)}
        aria-hidden={!visible}
        className={`w-1/2 shrink-0 px-4 ${!visible && settled && !dragging ? 'h-0 overflow-hidden' : ''}`}
      >
        <FeedList query={list} empty={empty} active={visible} />
      </section>
    )
  }

  return (
    <div
      ref={root}
      className="min-h-full touch-pan-y overflow-x-clip pb-6"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <header className="sticky top-0 z-10 bg-bg/95 px-4 pt-4 pb-3 backdrop-blur">
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
      <div
        className={`flex w-[200%] items-start ${dragging ? '' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`}
        style={{ transform: `translateX(calc(${offset}% + ${drag}px))` }}
      >
        {panel('friends', friends, t('feed.emptyFriends'))}
        {panel('public', publicFeed, t('feed.emptyPublic'))}
      </div>
    </div>
  )
}
