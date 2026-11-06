import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Section } from '../../app/ui'
import { useComparison } from './api'
import { StatTile } from './ProfileStatsSection'

export function CompareCard({ userId, name }: { userId: string; name: string }) {
  const { t } = useTranslation()
  const comparison = useComparison(userId)
  if (!comparison.data) return null
  const { events_together, sets_together, taste_match, shared_artists } = comparison.data
  return (
    <Section title={t('compare.title', { name })}>
      <dl className="grid grid-cols-3 gap-2">
        <StatTile label={t('compare.taste')} value={taste_match == null ? '–' : `${taste_match}%`} />
        <StatTile label={t('compare.sets')} value={sets_together} />
        <StatTile label={t('compare.events')} value={events_together} />
      </dl>
      {shared_artists.length > 0 && (
        <>
          <h3 className="mt-4 text-sm text-text-secondary">{t('compare.sharedArtists')}</h3>
          <ul className="mt-1">
            {shared_artists.map((artist) => (
              <li key={artist.id}>
                <Link to={`/artists/${artist.id}`} className="flex min-h-touch items-center justify-between gap-3">
                  <span className="truncate">{artist.name}</span>
                  <span className="shrink-0 text-sm text-text-secondary tabular-nums">{t('compare.counts', { mine: artist.mine, theirs: artist.theirs })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}
