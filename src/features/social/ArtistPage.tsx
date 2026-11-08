import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Button, ErrorText, Section } from '../../app/ui'
import { instagramHandle } from '../../lib/instagram'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { CheckinsSection, EntityHeader, FriendsSection, PersonalSection, UpcomingSection } from '../entity/parts'
import { UserAvatar } from '../profile/UserAvatar'
import { useArtistStats } from '../stats/api'
import { BarList } from '../stats/charts'
import { StatTile } from '../stats/ProfileStatsSection'

export const wishlistKey = (userId: string) => ['wishlist', userId]

export function useWishlist(userId: string) {
  return useQuery({
    queryKey: wishlistKey(userId),
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('wishlist_artists')
        .select('artist:artists(id, name, status)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as { artist: { id: string; name: string; status: 'pending' | 'approved' | 'rejected' } | null }[]).flatMap((row) => (row.artist ? [row.artist] : []))
    },
  })
}

export function WishlistButton({ artistId }: { artistId: string }) {
  const { t } = useTranslation()
  const me = useMember()
  const queryClient = useQueryClient()
  const wishlist = useWishlist(me.id)
  const onList = wishlist.data?.some((artist) => artist.id === artistId) ?? false
  const toggle = useMutation({
    mutationFn: async () => {
      const table = getSupabase().from('wishlist_artists')
      const { error } = onList
        ? await table.delete().match({ user_id: me.id, artist_id: artistId })
        : await table.insert({ user_id: me.id, artist_id: artistId })
      if (error) throw error
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: wishlistKey(me.id) }),
  })
  return (
    <>
      <Button variant={onList ? 'quiet' : 'social'} disabled={wishlist.isPending || toggle.isPending} onClick={() => toggle.mutate()}>
        {onList ? t('wishlist.remove') : t('wishlist.add')}
      </Button>
      {toggle.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </>
  )
}

function AppNumbers({ artistId }: { artistId: string }) {
  const { t, i18n } = useTranslation()
  const stats = useArtistStats(artistId)
  if (!stats.data) return null
  const { checkins, avg_rating, members, groups, partners, top_fans } = stats.data
  const rating = avg_rating == null ? '–' : avg_rating.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })
  const names = (list: { id: string; name: string }[]) => (
    <ul className="flex flex-wrap gap-2">
      {list.map((entry) => (
        <li key={entry.id}>
          <Link to={`/artists/${entry.id}`} className="flex min-h-touch items-center rounded-lg bg-surface-1 px-3">{entry.name}</Link>
        </li>
      ))}
    </ul>
  )
  return (
    <>
      <Section title={t('entity.app')}>
        <dl className="grid grid-cols-2 gap-2">
          <StatTile label={t('artist.checkins')} value={checkins} />
          <StatTile label={t('stats.avgRating')} value={rating} />
        </dl>
      </Section>
      {members.length > 0 && <Section title={t('artist.members')}>{names(members)}</Section>}
      {groups.length > 0 && <Section title={t('artist.groups')}>{names(groups)}</Section>}
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

export function ArtistPage() {
  const { t } = useTranslation()
  const { artistId } = useParams()
  const artist = useQuery({
    queryKey: ['artist', artistId],
    enabled: Boolean(artistId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('artists').select('id, name, status, kind, country_code, instagram_url').eq('id', artistId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const stats = useArtistStats(artistId)
  if (artist.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!artist.data) return <PlaceholderPage title={t('pages.notFound.title')} body={t('wishlist.artistNotFound')} />
  const a = artist.data
  const subline = [...(stats.data?.genres ?? []), a.country_code].filter(Boolean).join(' · ')
  const aliases = stats.data?.aliases ?? []

  return (
    <div className="px-4 pb-6">
      <EntityHeader
        id={a.id}
        kicker={t(a.kind === 'group' ? 'entity.kicker.group' : 'entity.kicker.artist')}
        name={a.name}
        status={a.status}
        subline={
          <>
            {subline && <p>{subline}</p>}
            {aliases.length > 0 && <p className="text-text-primary/70">{t('artist.aliases', { names: aliases.join(', ') })}</p>}
          </>
        }
      >
        <WishlistButton artistId={a.id} />
        {a.instagram_url && (
          <a href={a.instagram_url} target="_blank" rel="noreferrer" className="inline-flex min-h-touch items-center rounded-lg bg-bg/60 px-4 font-semibold">
            {t('common.instagram', { handle: instagramHandle(a.instagram_url) })}
          </a>
        )}
      </EntityHeader>
      <UpcomingSection entity="artist" id={a.id} />
      <PersonalSection entity="artist" id={a.id} />
      <AppNumbers artistId={a.id} />
      <FriendsSection entity="artist" id={a.id} />
      <CheckinsSection entity="artist" id={a.id} />
    </div>
  )
}
