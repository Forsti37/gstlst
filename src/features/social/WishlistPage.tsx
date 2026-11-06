import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ErrorText } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { EntityPicker, UnderReview } from '../checkin/components'
import { useWishlist, wishlistKey, WishlistButton } from './ArtistPage'

export function WishlistPage() {
  const { t } = useTranslation()
  const me = useMember()
  const queryClient = useQueryClient()
  const wishlist = useWishlist(me.id)
  const [failed, setFailed] = useState(false)

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('wishlist.title')}</h1>
      <p className="mt-2 text-sm text-text-secondary">{t('wishlist.intro')}</p>
      <div className="mt-4">
        <EntityPicker
          type="artist"
          label={t('checkin.artist')}
          onPick={(artist) => {
            // Only artists that already exist: nobody should create one just to wish for it.
            if (artist.isNew) return
            void getSupabase().from('wishlist_artists').upsert({ user_id: me.id, artist_id: artist.id }, { ignoreDuplicates: true }).then(({ error }) => {
              setFailed(Boolean(error))
              void queryClient.invalidateQueries({ queryKey: wishlistKey(me.id) })
            })
          }}
        />
        {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      </div>
      {!wishlist.isPending && wishlist.data?.length === 0 && <p className="mt-6 text-text-secondary">{t('wishlist.empty')}</p>}
      <ul className="mt-4 space-y-2">
        {wishlist.data?.map((artist) => (
          <li key={artist.id} className="flex items-center gap-3 rounded-lg bg-surface-1 py-2 pr-2 pl-4">
            <Link to={`/artists/${artist.id}`} className="flex min-h-touch min-w-0 flex-1 items-center gap-2 font-medium">
              <span className="truncate">{artist.name}</span>
              <UnderReview status={artist.status} />
            </Link>
            <WishlistButton artistId={artist.id} />
          </li>
        ))}
      </ul>
    </div>
  )
}
