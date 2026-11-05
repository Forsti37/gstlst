import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, Section, TextField } from '../../app/ui'
import { useMember } from '../auth/auth'
import { UserAvatar } from '../profile/UserAvatar'
import { useBlocked, useFriendActions, useFriendships, useProfileSearch, type PublicProfile } from './api'

function PersonRow({ person, children }: { person: PublicProfile; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Link to={`/u/${person.username}`} className="flex min-h-touch min-w-0 flex-1 items-center gap-3">
        <UserAvatar path={person.avatar_path} name={person.display_name} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{person.display_name}</span>
          <span className="block truncate text-sm text-text-secondary">@{person.username}</span>
        </span>
      </Link>
      {children}
    </li>
  )
}

export function FriendsPage() {
  const { t } = useTranslation()
  const me = useMember()
  const [query, setQuery] = useState('')
  const friendships = useFriendships()
  const blocked = useBlocked()
  const search = useProfileSearch(query)
  const { accept, remove, unblock } = useFriendActions(me.id)

  const rows = friendships.data ?? []
  const friends = rows.filter((f) => f.status === 'accepted')
  const incoming = rows.filter((f) => f.status === 'pending' && f.requested_by !== me.id)
  const outgoing = rows.filter((f) => f.status === 'pending' && f.requested_by === me.id)

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('friends.title')}</h1>

      <div className="mt-6">
        <TextField
          label={t('friends.search')}
          hint={t('friends.searchHint')}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCapitalize="none"
          autoComplete="off"
        />
        {query.trim().length >= 2 && (
          <ul className="mt-2">
            {search.data?.map((person) => <PersonRow key={person.id} person={person} />)}
            {search.data?.length === 0 && <li className="py-2 text-sm text-text-secondary">{t('friends.noResults')}</li>}
          </ul>
        )}
      </div>

      {incoming.length > 0 && (
        <Section title={t('friends.requests')}>
          <ul>
            {incoming.map((person) => (
              <PersonRow key={person.id} person={person}>
                <Button variant="social" onClick={() => accept.mutate(person.id)}>{t('friends.accept')}</Button>
                <Button onClick={() => remove.mutate(person.id)}>{t('friends.decline')}</Button>
              </PersonRow>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('friends.yourFriends')}>
        {friends.length === 0 && !friendships.isPending && <p className="text-text-secondary">{t('friends.empty')}</p>}
        <ul>{friends.map((person) => <PersonRow key={person.id} person={person} />)}</ul>
      </Section>

      {outgoing.length > 0 && (
        <Section title={t('friends.sent')}>
          <ul>
            {outgoing.map((person) => (
              <PersonRow key={person.id} person={person}>
                <Button onClick={() => remove.mutate(person.id)}>{t('friends.cancel')}</Button>
              </PersonRow>
            ))}
          </ul>
        </Section>
      )}

      {(blocked.data?.length ?? 0) > 0 && (
        <Section title={t('friends.blocked')}>
          <ul>
            {blocked.data?.map((person) => (
              <li key={person.id} className="flex items-center gap-3 py-2">
                <UserAvatar path={person.avatar_path} name={person.display_name} />
                <span className="min-w-0 flex-1 truncate">@{person.username}</span>
                <Button onClick={() => unblock.mutate(person.id)}>{t('friends.unblock')}</Button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
