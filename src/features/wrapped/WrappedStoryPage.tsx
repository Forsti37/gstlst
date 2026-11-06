import { ChevronLeft, ChevronRight, Download, Link as LinkIcon, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { copyText } from '../../lib/clipboard'
import { useMarkShared, useMySpending, useWrapped } from './api'
import { describePeriod } from './period'
import { shareFile, slideToFile, SLIDE_HEIGHT, SLIDE_WIDTH, wrappedUrl } from './share'
import { useSlides } from './slides'

const CONTROLS_HEIGHT = 136
const CONTROL = 'inline-flex size-touch items-center justify-center rounded-full bg-surface-2 text-text-primary disabled:opacity-40'

function usePeriodHeading(period: string, eventName: string | null | undefined) {
  const { t, i18n } = useTranslation()
  const label = describePeriod(period)
  const language = i18n.resolvedLanguage
  switch (label.key) {
    case 'year':
      return label.year
    case 'month':
      return new Date(Date.UTC(Number(label.year), label.month - 1, 1)).toLocaleDateString(language, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    case 'season':
      return t(`wrapped.seasons.${label.season}`, { year: label.year })
    case 'range': {
      const format = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(language, { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })
      return `${format(label.from)} – ${format(label.to)}`
    }
    case 'event':
      return eventName ?? t('wrapped.title')
    default:
      return t('wrapped.title')
  }
}

function useFitScale() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / SLIDE_WIDTH, (window.innerHeight - CONTROLS_HEIGHT) / SLIDE_HEIGHT, 1.6))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return scale
}

export function WrappedStoryPage() {
  const { t, i18n } = useTranslation()
  const { username, period } = useParams()
  const navigate = useNavigate()
  const wrapped = useWrapped(username, period)
  const data = wrapped.data
  const spending = useMySpending(period, Boolean(data?.own) && !data?.locked)
  const heading = usePeriodHeading(period ?? '', data?.period?.event_name)
  const slides = useSlides(data, heading, spending.data)
  const markShared = useMarkShared()
  const scale = useFitScale()

  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const pointerStart = useRef<number | null>(null)

  const last = slides.length - 1
  const current = Math.min(index, Math.max(last, 0))
  const slide = slides[current]
  const go = (step: number) => {
    setMessage(null)
    setIndex(Math.max(0, Math.min(last, current + step)))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(last, i + 1))
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  if (wrapped.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (wrapped.isError) return <PlaceholderPage title={t('wrapped.title')} body={t('wrapped.badPeriod')} />
  if (!data) return <PlaceholderPage title={t('wrapped.title')} body={t('wrapped.notVisible')} />
  if (data.locked) {
    const opens = new Date(`${data.opens}T00:00:00Z`).toLocaleDateString(i18n.resolvedLanguage, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    return <PlaceholderPage title={t('wrapped.title')} body={t('wrapped.locked', { date: opens })} />
  }
  if (data.empty || !slide) return <PlaceholderPage title={heading} body={t('wrapped.empty')} />

  const onPointerUp = (event: PointerEvent) => {
    if (pointerStart.current == null) return
    const distance = event.clientX - pointerStart.current
    pointerStart.current = null
    if (Math.abs(distance) > 40) {
      go(distance < 0 ? 1 : -1)
      return
    }
    const box = event.currentTarget.getBoundingClientRect()
    go(event.clientX - box.left < box.width / 3 ? -1 : 1)
  }

  const exportSlide = async () => {
    const node = stage.current?.firstElementChild
    if (!(node instanceof HTMLElement) || slide.privateOnly) return
    setBusy(true)
    setMessage(null)
    try {
      const file = await slideToFile(node, `gstlst-wrapped-${data.owner.username}-${period}-${slide.key}.png`)
      const shared = await shareFile(file)
      if (shared && data.own && period) markShared.mutate(period)
    } catch {
      setMessage(t('wrapped.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    const ok = await copyText(wrappedUrl(data.owner.username, period!))
    setMessage(ok ? t('wrapped.linkCopied') : t('common.actionFailed'))
    if (ok && data.own && period) markShared.mutate(period)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex w-full max-w-xl gap-1 px-3 pt-3" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={current + 1} aria-label={t('wrapped.progress', { current: current + 1, total: slides.length })}>
        {slides.map((entry, position) => (
          <span key={entry.key} className={`h-1 flex-1 rounded-full ${position <= current ? 'bg-text-primary' : 'bg-surface-2'}`} />
        ))}
      </div>

      <div
        className="flex min-h-0 w-full flex-1 touch-none items-center justify-center overflow-hidden select-none"
        data-testid="wrapped-stage"
        onPointerDown={(event) => {
          pointerStart.current = event.clientX
        }}
        onPointerUp={onPointerUp}
      >
        <div style={{ width: SLIDE_WIDTH * scale, height: SLIDE_HEIGHT * scale }}>
          <div ref={stage} style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }} data-slide={slide.key}>
            {slide.render()}
          </div>
        </div>
      </div>

      {message && <p role="status" className="px-4 text-center text-sm text-text-secondary">{message}</p>}
      <div className="flex w-full max-w-xl items-center justify-between gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" className={CONTROL} aria-label={t('wrapped.close')} onClick={() => void navigate(data.own ? '/wrapped' : `/u/${data.owner.username}`)}>
          <X aria-hidden className="size-5" />
        </button>
        <div className="flex gap-2">
          {!slide.privateOnly && (
            <>
              <button type="button" className={CONTROL} aria-label={t('wrapped.copyLink')} onClick={() => void copyLink()}>
                <LinkIcon aria-hidden className="size-5" />
              </button>
              <button type="button" className={CONTROL} aria-label={t('wrapped.sharePng')} disabled={busy} onClick={() => void exportSlide()}>
                <Download aria-hidden className="size-5" />
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" className={CONTROL} aria-label={t('wrapped.previous')} disabled={current === 0} onClick={() => go(-1)}>
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button type="button" className={CONTROL} aria-label={t('wrapped.next')} disabled={current === last} onClick={() => go(1)}>
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
