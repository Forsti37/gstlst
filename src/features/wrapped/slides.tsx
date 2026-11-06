import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaUrls } from '../checkin/api'
import { BadgeIcon } from '../badges/BadgeIcon'
import { UserAvatar } from '../profile/UserAvatar'
import type { CollageItem, Spending, WrappedData } from './api'
import { collageColumns, projectPlaces } from './period'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from './share'

export interface SlideDefinition {
  key: string
  /** Private slides never leave the device: no export, and no link can show them. */
  privateOnly?: boolean
  render: () => ReactNode
}

/** A fixed 360 x 640 stage. The story scales it to fit, and the export renders it at 3x. */
export function SlideFrame({ children, title, footer }: { children: ReactNode; title?: string; footer: string }) {
  return (
    <div className="relative flex flex-col overflow-hidden bg-bg p-7 text-text-primary" style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}>
      {title && <p className="font-display brand-offset mt-8 text-[28px] leading-tight tracking-wide uppercase">{title}</p>}
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
      <p className="font-display brand-offset text-[15px] tracking-widest uppercase">{footer}</p>
    </div>
  )
}

/** Long names get smaller, so that a word never breaks across lines if it can be helped. */
export function bigValueSize(value: string) {
  const longestWord = Math.max(...value.split(/\s+/).map((word) => word.length))
  if (longestWord > 13 || value.length > 28) return 'text-[34px]'
  if (longestWord > 7 || value.length > 16) return 'text-[46px]'
  return 'text-[72px]'
}

function BigValue({ value, label }: { value: string | number; label?: string }) {
  return (
    <div>
      <p className={`font-display brand-offset leading-none break-words uppercase ${bigValueSize(String(value))}`}>{value}</p>
      {label && <p className="mt-3 text-[17px] text-text-secondary">{label}</p>}
    </div>
  )
}

function NumbersGrid({ numbers }: { numbers: WrappedData['numbers'] }) {
  const { t, i18n } = useTranslation()
  const rows: [string, string | number][] = [
    [t('stats.events'), numbers.events],
    [t('stats.sets'), numbers.sets],
    [t('stats.artists'), numbers.artists],
    [t('stats.venues'), numbers.venues],
    [t('stats.cities'), numbers.cities],
    [t('stats.countries'), numbers.countries],
  ]
  if (numbers.avg_rating != null) rows.push([t('stats.avgRating'), numbers.avg_rating.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })])
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col-reverse">
          <dt className="text-[14px] text-text-secondary">{label}</dt>
          <dd className="font-display text-[48px] leading-none tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function GenreBars({ genres }: { genres: WrappedData['genres'] }) {
  const top = Math.max(...genres.map((genre) => genre.sets), 1)
  return (
    <ul className="space-y-5">
      {genres.map((genre) => (
        <li key={genre.label}>
          <div className="flex justify-between gap-3 text-[18px]">
            <span className="truncate font-semibold">{genre.label}</span>
            <span className="text-text-secondary tabular-nums">{genre.sets}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-red" style={{ width: `${Math.max(3, (genre.sets / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Dots instead of map tiles: those couldn't be exported, and they'd reveal the viewer to a third party. */
function PlacesPlot({ places }: { places: NonNullable<WrappedData['places']> }) {
  const { t } = useTranslation()
  const projected = projectPlaces(places.cities)
  const biggest = Math.max(...places.cities.map((city) => city.events), 1)
  const labelled = new Set(places.cities.slice(0, 4).map((city) => city.city))
  return (
    <div>
      <svg viewBox="-12 -12 124 124" className="w-full" role="img" aria-label={t('wrapped.slides.placesPlot', { count: places.cities.length })}>
        {projected.map((city) => (
          <g key={city.city}>
            <circle cx={city.x * 100} cy={city.y * 100} r={1.5 + (city.events / biggest) * 3.5} fill="var(--gst-red)" />
            {labelled.has(city.city) && (
              <text x={city.x * 100} y={city.y * 100 - 7} textAnchor="middle" fontSize="5" fill="var(--gst-text-primary)">{city.city}</text>
            )}
          </g>
        ))}
      </svg>
      <p className="mt-3 text-[17px] text-text-secondary">{t('wrapped.slides.placesCities', { count: places.cities.length })}, {t('wrapped.slides.placesCountries', { count: places.countries.length })}</p>
    </div>
  )
}

function Collage({ items }: { items: CollageItem[] }) {
  const { i18n } = useTranslation()
  const paths = items.flatMap((item) => (item.type === 'photo' ? [item.path] : []))
  const urls = useMediaUrls(paths)
  const columns = collageColumns(items.length)
  const small = columns >= 5
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {items.map((item, index) => {
        if (item.type === 'photo') {
          const url = urls.data?.get(item.path)
          return (
            <div key={index} className="aspect-square overflow-hidden rounded-sm bg-surface-2">
              {url && <img src={url} crossOrigin="anonymous" alt="" className="size-full object-cover" />}
            </div>
          )
        }
        const date = new Date(`${item.date}T00:00:00Z`).toLocaleDateString(i18n.resolvedLanguage, { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })
        return (
          <div key={index} className="flex aspect-square flex-col justify-end overflow-hidden rounded-sm bg-surface-1 p-1 leading-tight">
            <span className={`font-display truncate uppercase ${small ? 'text-[7px]' : 'text-[12px]'}`}>{item.artist ?? item.venue}</span>
            {!small && <span className="truncate text-[9px] text-text-secondary">{item.venue}</span>}
            <span className={`truncate text-text-secondary ${small ? 'text-[6px]' : 'text-[9px]'}`}>{date}</span>
          </div>
        )
      })}
    </div>
  )
}

export function useSlides(data: WrappedData | null | undefined, heading: string, spending: Spending[] | undefined): SlideDefinition[] {
  const { t, i18n } = useTranslation()
  if (!data || data.locked || data.empty) return []
  const footer = `GSTLST · ${heading}`
  const money = (value: number, currency: string) => value.toLocaleString(i18n.resolvedLanguage, { style: 'currency', currency, maximumFractionDigits: 0 })
  const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString(i18n.resolvedLanguage, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(i18n.resolvedLanguage, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const persona = t(`wrapped.personas.${data.persona}.name`)
  const slides: (SlideDefinition | false | null | undefined)[] = [
    {
      key: 'intro',
      render: () => (
        <SlideFrame footer="GSTLST">
          <p className="text-[18px] text-text-secondary">{data.own ? t('wrapped.slides.introOwn') : t('wrapped.slides.introOther', { name: data.owner.display_name })}</p>
          <p className={`font-display brand-offset mt-3 leading-none break-words uppercase ${bigValueSize(heading)}`}>{heading}</p>
          {data.in_progress && <p className="mt-6 text-[15px] text-text-secondary">{t('wrapped.inProgress')}</p>}
        </SlideFrame>
      ),
    },
    {
      key: 'numbers',
      render: () => (
        <SlideFrame title={t('wrapped.slides.numbers')} footer={footer}>
          <NumbersGrid numbers={data.numbers} />
        </SlideFrame>
      ),
    },
    data.top_artist && {
      key: 'top_artist',
      render: () => (
        <SlideFrame title={t('wrapped.slides.topArtist')} footer={footer}>
          <BigValue value={data.top_artist!.name} label={t('wrapped.slides.topArtistCount', { count: data.top_artist!.sets })} />
        </SlideFrame>
      ),
    },
    data.top_venue && {
      key: 'top_venue',
      render: () => (
        <SlideFrame title={t('wrapped.slides.topVenue')} footer={footer}>
          <BigValue value={data.top_venue!.name} label={t('wrapped.slides.topVenueCount', { count: data.top_venue!.events, city: data.top_venue!.city })} />
        </SlideFrame>
      ),
    },
    data.genres.length > 0 && {
      key: 'genres',
      render: () => (
        <SlideFrame title={t('wrapped.slides.genres')} footer={footer}>
          <GenreBars genres={data.genres} />
        </SlideFrame>
      ),
    },
    data.best_set && {
      key: 'best_set',
      render: () => (
        <SlideFrame title={t('wrapped.slides.bestSet')} footer={footer}>
          <BigValue value={data.best_set!.artists ?? data.best_set!.event} label={t('wrapped.slides.bestSetDetail', { rating: data.best_set!.rating.toLocaleString(i18n.resolvedLanguage), event: data.best_set!.event })} />
        </SlideFrame>
      ),
    },
    data.longest_night && {
      key: 'longest_night',
      render: () => (
        <SlideFrame title={t('wrapped.slides.longestNight')} footer={footer}>
          <BigValue value={data.longest_night!.sets} label={t('wrapped.slides.longestNightDetail', { event: data.longest_night!.event, date: dateLabel(data.longest_night!.date) })} />
        </SlideFrame>
      ),
    },
    data.active_month && data.period.kind !== 'month' && data.period.kind !== 'event' && {
      key: 'active_month',
      render: () => (
        <SlideFrame title={t('wrapped.slides.activeMonth')} footer={footer}>
          <BigValue value={monthLabel(data.active_month!.month)} label={t('wrapped.slides.activeMonthCount', { count: data.active_month!.events })} />
        </SlideFrame>
      ),
    },
    data.places && data.places.cities.length > 0 && data.period.kind !== 'event' && {
      key: 'places',
      render: () => (
        <SlideFrame title={t('wrapped.slides.places')} footer={footer}>
          <PlacesPlot places={data.places!} />
        </SlideFrame>
      ),
    },
    data.new_artists.count > 0 && {
      key: 'new_artists',
      render: () => (
        <SlideFrame title={t('wrapped.slides.newArtists')} footer={footer}>
          <BigValue value={data.new_artists.count} />
          <p className="mt-4 text-[16px] text-text-secondary">{data.new_artists.names.join(' · ')}</p>
        </SlideFrame>
      ),
    },
    data.buddy && {
      key: 'buddy',
      render: () => (
        <SlideFrame title={t('wrapped.slides.buddy')} footer={footer}>
          <UserAvatar path={data.buddy!.avatar_path} name={data.buddy!.display_name} size="lg" />
          <p className={`font-display brand-offset mt-4 leading-none break-words uppercase ${bigValueSize(data.buddy!.display_name)}`}>{data.buddy!.display_name}</p>
          <p className="mt-3 text-[17px] text-text-secondary">{t('wrapped.slides.buddyCount', { count: data.buddy!.events })}</p>
        </SlideFrame>
      ),
    },
    data.badges.length > 0 && {
      key: 'badges',
      render: () => (
        <SlideFrame title={t('wrapped.slides.badges')} footer={footer}>
          <ul className="space-y-2">
            {data.badges.slice(0, 8).map((badge) => (
              <li key={badge.id} className="flex items-center gap-3 text-[17px] font-semibold">
                <BadgeIcon category={badge.category} level={badge.level} size={40} />
                <span className="truncate">{badge.name}</span>
              </li>
            ))}
          </ul>
          {data.badges.length > 8 && <p className="mt-3 text-[15px] text-text-secondary">{t('wrapped.slides.badgesMore', { count: data.badges.length - 8 })}</p>}
        </SlideFrame>
      ),
    },
    data.collage.length > 0 && {
      key: 'collage',
      render: () => (
        <SlideFrame title={t('wrapped.slides.collage')} footer={footer}>
          <Collage items={data.collage} />
        </SlideFrame>
      ),
    },
    {
      key: 'persona',
      render: () => (
        <SlideFrame title={t('wrapped.slides.persona')} footer={footer}>
          <BigValue value={persona} />
          <p className="mt-4 text-[18px] text-text-secondary">{t(`wrapped.personas.${data.persona}.line`)}</p>
        </SlideFrame>
      ),
    },
    data.own && spending && spending.length > 0 && {
      key: 'spending',
      privateOnly: true,
      render: () => (
        <SlideFrame title={t('wrapped.slides.spending')} footer={t('wrapped.slides.spendingPrivate')}>
          {spending.map((row) => (
            <div key={row.currency} className="mb-6">
              <BigValue value={money(row.tickets + row.other, row.currency)} label={t('wrapped.slides.spendingDetail', { tickets: money(row.tickets, row.currency), other: money(row.other, row.currency), count: row.events })} />
            </div>
          ))}
        </SlideFrame>
      ),
    },
    {
      key: 'summary',
      render: () => (
        <SlideFrame title={heading} footer={`GSTLST · @${data.owner.username}`}>
          <NumbersGrid numbers={data.numbers} />
          <div className="mt-6 space-y-1 text-[16px]">
            {data.top_artist && <p><span className="text-text-secondary">{t('wrapped.slides.topArtist')}: </span><span className="font-semibold">{data.top_artist.name}</span></p>}
            {data.top_venue && <p><span className="text-text-secondary">{t('wrapped.slides.topVenue')}: </span><span className="font-semibold">{data.top_venue.name}</span></p>}
            <p><span className="text-text-secondary">{t('wrapped.slides.persona')}: </span><span className="font-semibold">{persona}</span></p>
          </div>
        </SlideFrame>
      ),
    },
  ]
  return slides.filter((slide): slide is SlideDefinition => Boolean(slide))
}
