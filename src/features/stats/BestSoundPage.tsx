import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ErrorText } from '../../app/ui'
import { useBestSound } from './api'

export function BestSoundPage() {
  const { t, i18n } = useTranslation()
  const ranking = useBestSound()
  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('bestSound.title')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('bestSound.hint')}</p>
      {ranking.isError && <ErrorText>{t('stats.loadFailed')}</ErrorText>}
      {ranking.isPending && <p className="mt-6 text-text-secondary">{t('common.loading')}</p>}
      {ranking.data?.length === 0 && <p className="mt-6 text-text-secondary">{t('bestSound.empty')}</p>}
      <ol className="mt-4 space-y-1">
        {ranking.data?.map((venue) => (
          <li key={venue.venue_id}>
            <Link to={`/venues/${venue.venue_id}`} className="flex min-h-touch items-center gap-3 rounded-lg bg-surface-1 px-3 py-2">
              <span className="w-6 text-right text-text-secondary tabular-nums">{venue.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{venue.name}</span>
                <span className="block truncate text-sm text-text-secondary">{venue.city} · {t('bestSound.ratings', { count: venue.ratings })}</span>
              </span>
              <span className="font-display text-2xl tabular-nums">{venue.avg_sound.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
