import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Section } from '../../app/ui'
import { UserAvatar } from '../profile/UserAvatar'
import { useArtistStats, type LinkedName } from './api'
import { BarList } from './charts'
import { StatTile } from './ProfileStatsSection'

function NameLinks({ title, names }: { title: string; names: LinkedName[] }) {
  if (names.length === 0) return null
  return (
    <Section title={title}>
      <ul className="flex flex-wrap gap-2">
        {names.map((entry) => (
          <li key={entry.id}>
            <Link to={`/artists/${entry.id}`} className="flex min-h-touch items-center rounded-lg bg-surface-1 px-3">{entry.name}</Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function ArtistStatsSections({ artistId }: { artistId: string }) {
  const { t, i18n } = useTranslation()
  const stats = useArtistStats(artistId)
  if (!stats.data) return null
  const { checkins, avg_rating, my_sets, aliases, members, groups, genres, partners, top_fans } = stats.data
  const rating = avg_rating == null ? '–' : avg_rating.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })

  return (
    <>
      {aliases.length > 0 && <p className="mt-1 text-sm text-text-secondary">{t('artist.aliases', { names: aliases.join(', ') })}</p>}
      {genres.length > 0 && <p className="mt-1 text-sm text-text-secondary">{genres.join(' · ')}</p>}
      {my_sets > 0 && <p className="mt-3 font-medium">{t('artist.youSaw', { count: my_sets })}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <StatTile label={t('artist.checkins')} value={checkins} />
        <StatTile label={t('stats.avgRating')} value={rating} />
      </dl>
      <NameLinks title={t('artist.members')} names={members} />
      <NameLinks title={t('artist.groups')} names={groups} />
      {partners.length > 0 && (
        <Section title={t('artist.partners')}>
          <BarList tone="social" rows={partners.map((p) => ({ key: p.id, label: p.name, value: p.sets, to: `/artists/${p.id}` }))} />
        </Section>
      )}
      {top_fans.length > 0 && (
        <Section title={t('artist.topFans')}>
          <ol>
            {top_fans.map((fan) => (
              <li key={fan.username}>
                <Link to={`/u/${fan.username}`} className="flex min-h-touch items-center gap-3">
                  <UserAvatar path={fan.avatar_path} name={fan.display_name} />
                  <span className="min-w-0 flex-1 truncate font-medium">{fan.display_name}</span>
                  <span className="text-sm text-text-secondary tabular-nums">{t('stats.setCount', { count: fan.sets })}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </>
  )
}
