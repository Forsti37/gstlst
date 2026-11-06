import { BadgeCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMember } from '../auth/auth'
import { useMyCheckins } from './api'
import { Chip, EventRow } from './components'

export function HistoryPage() {
  const { t } = useTranslation()
  const me = useMember()
  const checkins = useMyCheckins(me.id)
  const [onlyUnrated, setOnlyUnrated] = useState(false)

  const unratedCount = (item: { set_checkins: { rating: number | null }[] }) => item.set_checkins.filter((s) => s.rating === null).length
  const items = (checkins.data ?? []).filter((item) => !onlyUnrated || unratedCount(item) > 0)

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('history.title')}</h1>
      <div className="mt-4">
        <Chip selected={onlyUnrated} onClick={() => setOnlyUnrated(!onlyUnrated)}>{t('history.onlyUnrated')}</Chip>
      </div>
      {checkins.isPending && <p className="mt-6 text-text-secondary">{t('common.loading')}</p>}
      {!checkins.isPending && items.length === 0 && <p className="mt-6 text-text-secondary">{t('history.empty')}</p>}
      <ul className="mt-4 space-y-2">
        {items.map((item) =>
          item.event ? (
            <EventRow
              key={item.id}
              event={item.event}
              to={`/check-ins/${item.id}`}
              trailing={
                <span className="flex shrink-0 items-center gap-2 text-sm text-text-secondary">
                  {unratedCount(item) > 0 ? t('history.unrated', { count: unratedCount(item) }) : t('history.sets', { count: item.set_checkins.length })}
                  {(item.verified_gps || item.verified_admin) && <BadgeCheck aria-label={t('history.verified')} className="size-5 text-red" />}
                </span>
              }
            />
          ) : null,
        )}
      </ul>
    </div>
  )
}
