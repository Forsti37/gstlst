import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, ErrorText, Section } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { UserAvatar } from '../profile/UserAvatar'

/** RLS only returns the user's own row and those of their friends. */
export function GoingSection({ eventId, upcoming }: { eventId: string; upcoming: boolean }) {
  const { t } = useTranslation()
  const me = useMember()
  const queryClient = useQueryClient()
  const key = ['going', eventId]
  const going = useQuery({
    queryKey: key,
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('going')
        .select('user_id, user:profiles!going_user_id_fkey(username, display_name, avatar_path)')
        .eq('event_id', eventId)
      if (error) throw error
      return data as unknown as { user_id: string; user: { username: string; display_name: string; avatar_path: string | null } | null }[]
    },
  })
  const mine = going.data?.some((row) => row.user_id === me.id) ?? false
  const friends = going.data?.filter((row) => row.user_id !== me.id && row.user) ?? []
  const toggle = useMutation({
    mutationFn: async () => {
      const table = getSupabase().from('going')
      const { error } = mine ? await table.delete().match({ user_id: me.id, event_id: eventId }) : await table.insert({ user_id: me.id, event_id: eventId })
      if (error) throw error
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  })

  if (!upcoming && friends.length === 0) return null

  return (
    <Section title={t('going.title')}>
      {upcoming && (
        <Button variant={mine ? 'quiet' : 'social'} disabled={going.isPending || toggle.isPending} onClick={() => toggle.mutate()}>
          {mine ? t('going.notGoing') : t('going.imGoing')}
        </Button>
      )}
      {toggle.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      {friends.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {friends.map((row) => (
            <li key={row.user_id}>
              <Link to={`/u/${row.user!.username}`} className="flex min-h-touch items-center gap-2">
                <UserAvatar path={row.user!.avatar_path} name={row.user!.display_name} />
                <span>{row.user!.display_name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
