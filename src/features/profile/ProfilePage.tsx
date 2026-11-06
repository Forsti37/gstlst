import { Heart, History, Settings, Trophy, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Section } from '../../app/ui'
import { useMember } from '../auth/auth'
import { useFriendships } from '../friends/api'
import { ProfileStatsSection } from '../stats/ProfileStatsSection'
import { ShareCard } from './ShareCard'
import { UserAvatar } from './UserAvatar'

const ROW = 'flex min-h-touch items-center gap-3 rounded-lg bg-surface-1 px-4 font-medium'

export function ProfilePage() {
  const { t } = useTranslation()
  const me = useMember()
  const friendships = useFriendships()
  const friendCount = friendships.data?.filter((f) => f.status === 'accepted').length ?? 0
  const requestCount = friendships.data?.filter((f) => f.status === 'pending' && f.requested_by !== me.id).length ?? 0

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-4">
        <UserAvatar path={me.avatar_path} name={me.display_name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{me.display_name}</h1>
          <p className="truncate text-text-secondary">@{me.username}</p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <Link to="/friends" className={ROW}>
          <Users aria-hidden className="size-5 text-blue" />
          <span className="flex-1">{t('profile.friends', { count: friendCount })}</span>
          {requestCount > 0 && <span className="rounded-full bg-blue px-2 text-sm text-white">{requestCount}</span>}
        </Link>
        <Link to="/check-ins" className={ROW}>
          <History aria-hidden className="size-5 text-red" />
          <span className="flex-1">{t('history.link')}</span>
        </Link>
        <Link to="/wishlist" className={ROW}>
          <Heart aria-hidden className="size-5 text-blue" />
          <span className="flex-1">{t('wishlist.link')}</span>
        </Link>
        <Link to="/leaderboard" className={ROW}>
          <Trophy aria-hidden className="size-5 text-blue" />
          <span className="flex-1">{t('leaderboard.title')}</span>
        </Link>
        <Link to="/settings" className={ROW}>
          <Settings aria-hidden className="size-5 text-text-secondary" />
          <span className="flex-1">{t('settings.title')}</span>
        </Link>
      </div>

      <ProfileStatsSection userId={me.id} own />

      <Section title={t('profile.shareTitle')}>
        <ShareCard username={me.username} />
      </Section>
    </div>
  )
}
