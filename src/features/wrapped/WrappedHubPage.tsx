import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Button, ErrorText, Section, TextField } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { useExplore } from '../stats/api'
import { useCommunityYears, useCommunityWrapped } from './api'
import { isYearOpen, SEASONS, type Season } from './period'

const SELECT = 'min-h-touch w-full rounded-lg border border-surface-2 bg-surface-1 px-3 text-text-primary'

function CommunityCard({ year }: { year: number }) {
  const { t, i18n } = useTranslation()
  const community = useCommunityWrapped(year)
  const data = community.data
  if (!data) return null
  return (
    <div className="rounded-lg bg-surface-1 p-4">
      <p className="font-display brand-offset text-3xl uppercase">{t('wrapped.community.title', { year })}</p>
      <p className="mt-1 text-sm text-text-secondary">{t('wrapped.community.totals', { ravers: data.ravers, events: data.events, sets: data.sets })}</p>
      <dl className="mt-3 space-y-1">
        {data.top_artist && (
          <div className="flex justify-between gap-3"><dt className="text-text-secondary">{t('wrapped.community.topArtist')}</dt><dd className="truncate font-semibold">{data.top_artist.name}</dd></div>
        )}
        {data.top_venue && (
          <div className="flex justify-between gap-3"><dt className="text-text-secondary">{t('wrapped.community.topVenue')}</dt><dd className="truncate font-semibold">{data.top_venue.name}</dd></div>
        )}
        {data.best_sound && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">{t('wrapped.community.bestSound')}</dt>
            <dd className="truncate font-semibold">{data.best_sound.name} · {data.best_sound.rating.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

export function WrappedHubPage() {
  const { t } = useTranslation()
  const me = useMember()
  const navigate = useNavigate()
  const thisYear = new Date().getFullYear()
  const years = useExplore({ userId: me.id, dimension: 'year', from: '', to: '', filters: {}, verifiedOnly: false })
  const community = useCommunityYears()
  const events = useQuery({
    queryKey: ['wrapped', 'events', me.id],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('event_checkins')
        .select('event:events(id, name, date_start)')
        .eq('user_id', me.id)
      if (error) throw error
      return (data as unknown as { event: { id: string; name: string; date_start: string } | null }[])
        .flatMap((row) => (row.event ? [row.event] : []))
        .sort((a, b) => b.date_start.localeCompare(a.date_start))
    },
  })

  const [month, setMonth] = useState('')
  const [seasonYear, setSeasonYear] = useState(String(thisYear))
  const [season, setSeason] = useState<Season>('summer')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [eventId, setEventId] = useState('')

  const open = (period: string) => void navigate(`/wrapped/${me.username}/${period}`)
  const allYears = [...new Set([thisYear, ...(years.data ?? []).map((row) => Number(row.key))])].sort((a, b) => b - a)

  return (
    <div className="px-4 py-6">
      <h1 className="font-display brand-offset text-5xl tracking-wide uppercase">{t('wrapped.title')}</h1>
      <p className="mt-2 text-text-secondary">{t('wrapped.intro')}</p>

      <Section title={t('wrapped.years')}>
        {years.isError && <ErrorText>{t('stats.loadFailed')}</ErrorText>}
        <ul className="grid grid-cols-2 gap-2">
          {allYears.map((year) => (
            <li key={year}>
              {isYearOpen(year) ? (
                <Link to={`/wrapped/${me.username}/${year}`} className="font-display flex min-h-touch items-center justify-center rounded-lg bg-surface-2 text-2xl">{year}</Link>
              ) : (
                <span className="flex min-h-touch flex-col items-center justify-center rounded-lg bg-surface-1 text-text-secondary">
                  <span className="font-display text-2xl">{year}</span>
                  <span className="text-xs">{t('wrapped.opensDecember')}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('wrapped.month')}>
        <div className="flex items-end gap-2">
          <div className="flex-1"><TextField type="month" label={t('wrapped.month')} value={month} onChange={(event) => setMonth(event.target.value)} /></div>
          <Button disabled={!month} onClick={() => open(month)}>{t('wrapped.open')}</Button>
        </div>
      </Section>

      <Section title={t('wrapped.season')}>
        <div className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="mb-1 block text-sm text-text-secondary">{t('wrapped.season')}</span>
            <select className={SELECT} value={season} onChange={(event) => setSeason(event.target.value as Season)}>
              {SEASONS.map((key) => <option key={key} value={key}>{t(`wrapped.seasonNames.${key}`)}</option>)}
            </select>
          </label>
          <label className="block w-24">
            <span className="mb-1 block text-sm text-text-secondary">{t('wrapped.year')}</span>
            <select className={SELECT} value={seasonYear} onChange={(event) => setSeasonYear(event.target.value)}>
              {allYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <Button onClick={() => open(`${seasonYear}-${season}`)}>{t('wrapped.open')}</Button>
        </div>
      </Section>

      <Section title={t('wrapped.custom')}>
        <div className="grid grid-cols-2 gap-2">
          <TextField type="date" label={t('stats.from')} value={from} onChange={(event) => setFrom(event.target.value)} />
          <TextField type="date" label={t('stats.to')} value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button className="mt-2" disabled={!from || !to || from > to} onClick={() => open(`${from}_${to}`)}>{t('wrapped.open')}</Button>
      </Section>

      <Section title={t('wrapped.event')}>
        <div className="flex items-end gap-2">
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-sm text-text-secondary">{t('wrapped.event')}</span>
            <select className={SELECT} value={eventId} onChange={(event) => setEventId(event.target.value)}>
              <option value="">{t('wrapped.chooseEvent')}</option>
              {(events.data ?? []).map((event) => <option key={event.id} value={event.id}>{event.date_start.slice(0, 4)} · {event.name}</option>)}
            </select>
          </label>
          <Button disabled={!eventId} onClick={() => open(`event-${eventId}`)}>{t('wrapped.open')}</Button>
        </div>
      </Section>

      {(community.data?.length ?? 0) > 0 && (
        <Section title={t('wrapped.community.section')}>
          <div className="space-y-2">
            {community.data?.map((year) => <CommunityCard key={year} year={year} />)}
          </div>
        </Section>
      )}
    </div>
  )
}
