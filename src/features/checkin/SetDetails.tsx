import { ImagePlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText, TextField } from '../../app/ui'
import { compressPhoto } from '../../lib/images'
import { useReferenceData } from './api'
import { Chip } from './components'
import type { SetDraft } from './draft'

export const MAX_PHOTO_PX = 1600
export const MAX_PHOTO_MB = 1

/** Lets a chosen photo become a small WebP right away, without metadata. Works offline. */
export function PhotoPicker({ onPick, label }: { onPick: (photo: Blob) => void; label: string }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div>
      <label className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-lg bg-surface-2 px-4 font-semibold">
        <ImagePlus aria-hidden className="size-5" />
        {busy ? t('common.loading') : label}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            setBusy(true)
            setFailed(false)
            compressPhoto(file, MAX_PHOTO_PX, MAX_PHOTO_MB)
              .then(onPick)
              .catch(() => setFailed(true))
              .finally(() => setBusy(false))
          }}
        />
      </label>
      <p className="mt-1 text-xs text-text-secondary">{t('checkin.photoHint')}</p>
      {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}

/** Everything optional about a set, collapsed so that rating stays one movement. */
export function SetDetails({ draft, onChange }: { draft: SetDraft; onChange: (patch: Partial<SetDraft>) => void }) {
  const { t } = useTranslation()
  const { genres, tags } = useReferenceData()
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const setTags = tags.filter((tag) => tag.scope === 'set')
  const roots = new Set(genres.filter((genre) => !genre.parent_id).map((genre) => genre.id))

  return (
    <details className="mt-1">
      <summary className="flex min-h-touch cursor-pointer items-center text-sm text-text-secondary">{t('checkin.moreDetails')}</summary>
      <div className="space-y-4 pt-2 pb-2">
        <div>
          <p className="mb-1 text-sm text-text-secondary">{t('checkin.tags')}</p>
          <div className="flex flex-wrap gap-2">
            {setTags.map((tag) => (
              <Chip key={tag.id} selected={draft.tagIds.includes(tag.id)} onClick={() => onChange({ tagIds: toggle(draft.tagIds, tag.id) })}>{tag.name}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm text-text-secondary">{t('checkin.genres')}</p>
          <div className="flex flex-wrap gap-2">
            {genres
              .filter((genre) => !roots.has(genre.id))
              .map((genre) => (
                <Chip key={genre.id} selected={draft.genreIds.includes(genre.id)} onClick={() => onChange({ genreIds: toggle(draft.genreIds, genre.id) })}>{genre.name}</Chip>
              ))}
          </div>
        </div>
        <TextField label={t('checkin.comment')} value={draft.text} onChange={(e) => onChange({ text: e.target.value })} maxLength={2000} />
        {draft.photo ? (
          <div className="flex items-center gap-3">
            <span className="text-sm">{t('checkin.photoReady')}</span>
            <Button onClick={() => onChange({ photo: null })}>{t('checkin.removePhoto')}</Button>
          </div>
        ) : (
          <PhotoPicker label={t('checkin.addPhoto')} onPick={(photo) => onChange({ photo })} />
        )}
      </div>
    </details>
  )
}
