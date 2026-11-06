import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NotFoundPage } from '../../app/NotFoundPage'
import { Button, ErrorText } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { useDecision } from './shared'

function Roles() {
  const { t } = useTranslation()
  const members = useQuery({
    queryKey: ['admin', 'members'],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('admin_list_members')
      if (error) throw error
      return data
    },
  })
  const setRole = useDecision((input: { id: string; moderator: boolean }) =>
    getSupabase().rpc('admin_set_moderator', { target_user: input.id, is_moderator: input.moderator }),
  )
  return (
    <>
      {setRole.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      <ul className="space-y-2">
        {members.data?.map((member) => (
          <li key={member.id} className="flex items-center gap-3 rounded-lg bg-surface-1 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{member.display_name}</span>
              <span className="block truncate text-sm text-text-secondary">@{member.username} · {t(`admin.roles.${member.role}`)}</span>
            </span>
            {member.role !== 'admin' && (
              <Button onClick={() => setRole.mutate({ id: member.id, moderator: member.role !== 'moderator' })}>
                {member.role === 'moderator' ? t('admin.revokeModerator') : t('admin.makeModerator')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

export function RolesTab() {
  const me = useMember()
  return me.role === 'admin' ? <Roles /> : <NotFoundPage />
}
