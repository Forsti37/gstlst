import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ErrorText } from '../../app/ui'
import { useMember } from '../auth/auth'
import { Chip } from '../checkin/components'
import { UserAvatar } from '../profile/UserAvatar'
import { useLeaderboard } from './api'

type Metric = 'events' | 'sets' | 'artists'

export function LeaderboardPage() {
  const { t } = useTranslation()
  const me = useMember()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number | null>(currentYear)
  const [metric, setMetric] = useState<Metric>('events')
  const board = useLeaderboard(year)
  const rows = [...(board.data ?? [])].sort((a, b) => b[metric] - a[metric] || a.display_name.localeCompare(b.display_name))

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('leaderboard.title')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('leaderboard.verifiedOnly')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip selected={year === currentYear} onClick={() => setYear(currentYear)}>{currentYear}</Chip>
        <Chip selected={year === null} onClick={() => setYear(null)}>{t('leaderboard.allTime')}</Chip>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['events', 'sets', 'artists'] as const).map((key) => (
          <Chip key={key} selected={metric === key} onClick={() => setMetric(key)}>{t(`stats.${key}`)}</Chip>
        ))}
      </div>
      {board.isError && <ErrorText>{t('stats.loadFailed')}</ErrorText>}
      {board.isPending && <p className="mt-6 text-text-secondary">{t('common.loading')}</p>}
      <ol className="mt-4 space-y-1">
        {rows.map((row, index) => (
          <li key={row.user_id}>
            <Link
              to={row.user_id === me.id ? '/profile' : `/u/${row.username}`}
              className={`flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 ${row.user_id === me.id ? 'bg-surface-2' : 'bg-surface-1'}`}
            >
              <span className="w-6 text-right text-text-secondary tabular-nums">{index + 1}</span>
              <UserAvatar path={row.avatar_path} name={row.display_name} />
              <span className="min-w-0 flex-1 truncate font-medium">{row.display_name}</span>
              <span className="font-display text-2xl tabular-nums">{row[metric]}</span>
            </Link>
          </li>
        ))}
      </ol>
      {rows.length === 1 && <p className="mt-4 text-sm text-text-secondary">{t('leaderboard.addFriends')}</p>}
      <Link to="/best-sound" className="mt-4 flex min-h-touch items-center justify-center rounded-lg bg-surface-2 px-4 font-semibold">{t('bestSound.title')}</Link>
    </div>
  )
}
