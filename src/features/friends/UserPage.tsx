import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Button, ErrorText } from '../../app/ui'
import { useAuth, useMember } from '../auth/auth'
import { ReportButton } from '../moderation/ReportButton'
import { UserAvatar } from '../profile/UserAvatar'
import { CompareCard } from '../stats/CompareCard'
import { ProfileStatsSection } from '../stats/ProfileStatsSection'
import { useFriendActions, useFriendships, useProfileByUsername } from './api'

export function UserPage() {
  const { t } = useTranslation()
  const { username } = useParams()
  const me = useMember()
  const { status } = useAuth()
  const navigate = useNavigate()
  const profile = useProfileByUsername(username)
  const friendships = useFriendships()
  const { request, accept, remove, block } = useFriendActions(me.id)

  if (status === 'member' && username === me.username) return <Navigate to="/profile" replace />
  if (profile.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!profile.data) return <PlaceholderPage title={t('user.notFoundTitle')} body={t('user.notFoundBody')} />

  const person = profile.data
  const friendship = friendships.data?.find((f) => f.id === person.id)
  const incoming = friendship?.status === 'pending' && friendship.requested_by !== me.id
  const outgoing = friendship?.status === 'pending' && friendship.requested_by === me.id
  const failed = request.isError || accept.isError || remove.isError || block.isError

  const confirmBlock = () => {
    if (!window.confirm(t('user.blockConfirm', { name: person.display_name }))) return
    block.mutate(person.id, { onSuccess: () => void navigate('/friends', { replace: true }) })
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-4">
        <UserAvatar path={person.avatar_path} name={person.display_name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{person.display_name}</h1>
          <p className="truncate text-text-secondary">@{person.username}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {!friendship && !friendships.isPending && (
          <Button variant="social" onClick={() => request.mutate(person.id)}>{t('user.addFriend')}</Button>
        )}
        {incoming && (
          <>
            <Button variant="social" onClick={() => accept.mutate(person.id)}>{t('friends.accept')}</Button>
            <Button onClick={() => remove.mutate(person.id)}>{t('friends.decline')}</Button>
          </>
        )}
        {outgoing && <Button onClick={() => remove.mutate(person.id)}>{t('friends.cancel')}</Button>}
        {friendship?.status === 'accepted' && <Button onClick={() => remove.mutate(person.id)}>{t('user.removeFriend')}</Button>}
        <Button variant="danger" onClick={confirmBlock}>{t('user.block')}</Button>
        <ReportButton targetType="profile" targetId={person.id} />
      </div>
      {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}

      <CompareCard userId={person.id} name={person.display_name} />
      <ProfileStatsSection userId={person.id} own={false} />
    </div>
  )
}
