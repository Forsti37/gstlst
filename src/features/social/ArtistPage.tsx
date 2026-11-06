import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { Button, ErrorText } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { UnderReview } from '../checkin/components'

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

/** A first version with the wishlist. Stats, partners and top fans arrive in phase 6. */
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
  if (artist.isPending) return <p className="px-4 py-6 text-text-secondary">{t('common.loading')}</p>
  if (!artist.data) return <PlaceholderPage title={t('pages.notFound.title')} body={t('wishlist.artistNotFound')} />
  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{artist.data.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        {artist.data.country_code}
        <UnderReview status={artist.data.status} />
      </div>
      {artist.data.instagram_url && (
        <a href={artist.data.instagram_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-touch items-center text-blue">Instagram</a>
      )}
      <div className="mt-4">
        <WishlistButton artistId={artist.data.id} />
      </div>
    </div>
  )
}
