import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getSupabase } from '../../lib/supabase'
import { useMediaUrls } from '../checkin/api'
import { Card, DecisionButtons, EmptyQueue, useDecision } from './shared'

function PhotoItem({ photo, url }: { photo: { id: string; owner: { username: string } | null }; url: string | undefined }) {
  const { t } = useTranslation()
  const decide = useDecision((input: { decision: 'approve' | 'reject'; reason?: string }) =>
    getSupabase().rpc('moderate_media', { media_id: photo.id, decision: input.decision, reason: input.reason }),
  )
  return (
    <Card>
      <img src={url} alt={t('admin.photoAlt')} className="max-h-96 w-full rounded-lg bg-surface-2 object-contain" />
      {photo.owner && <p className="text-sm text-text-secondary">@{photo.owner.username}</p>}
      <DecisionButtons
        disabled={decide.isPending}
        failed={decide.isError}
        onApprove={() => decide.mutate({ decision: 'approve' })}
        onReject={(reason) => decide.mutate({ decision: 'reject', reason })}
      />
    </Card>
  )
}

export function PhotosTab() {
  const photos = useQuery({
    queryKey: ['admin', 'photos'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('media')
        .select('id, storage_path, owner:profiles!media_owner_id_fkey(username)')
        .eq('moderation_status', 'pending')
        .order('created_at')
      if (error) throw error
      return data as unknown as { id: string; storage_path: string; owner: { username: string } | null }[]
    },
  })
  const { data: urls } = useMediaUrls(photos.data?.map((photo) => photo.storage_path) ?? [])
  return (
    <>
      <EmptyQueue isPending={photos.isPending} count={photos.data?.length ?? 0} />
      <ul className="space-y-3">
        {photos.data?.map((photo) => <PhotoItem key={photo.id} photo={photo} url={urls?.get(photo.storage_path)} />)}
      </ul>
    </>
  )
}
