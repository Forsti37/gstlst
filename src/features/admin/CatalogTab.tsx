import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText, Section, TextField } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { formatEventDate, useEventSearch, useReferenceData } from '../checkin/api'
import { Chip, EntityPicker } from '../checkin/components'
import type { PickedEntity } from '../checkin/draft'
import { useDecision } from './shared'

const LIFECYCLES = ['scheduled', 'cancelled', 'postponed'] as const

function EventLifecycle() {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const search = useEventSearch(query)
  const ids = search.data?.map((event) => event.id) ?? []
  const lifecycles = useQuery({
    queryKey: ['admin', 'lifecycles', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('events').select('id, lifecycle').in('id', ids)
      if (error) throw error
      return new Map(data.map((event) => [event.id, event.lifecycle]))
    },
  })
  const update = useDecision((input: { id: string; lifecycle: (typeof LIFECYCLES)[number] }) =>
    getSupabase().rpc('set_event_lifecycle', { event_id: input.id, lifecycle: input.lifecycle }),
  )
  return (
    <>
      <TextField label={t('checkin.searchEvent')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      <ul className="mt-3 space-y-3">
        {search.data?.map((event) => (
          <li key={event.id} className="rounded-lg bg-surface-1 p-3">
            <p className="font-medium">{event.name}</p>
            <p className="mb-2 text-sm text-text-secondary">{formatEventDate(event, i18n.resolvedLanguage)}</p>
            <div className="flex flex-wrap gap-2">
              {LIFECYCLES.map((lifecycle) => (
                <Chip key={lifecycle} selected={lifecycles.data?.get(event.id) === lifecycle} onClick={() => update.mutate({ id: event.id, lifecycle })}>
                  {t(`admin.lifecycle.${lifecycle}`)}
                </Chip>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {update.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </>
  )
}

function ArtistEditor({ artist }: { artist: PickedEntity }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { genres } = useReferenceData()
  const key = ['admin', 'artist', artist.id]
  const details = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('artists')
        .select('id, country_code, instagram_url, artist_aliases(id, alias), artist_default_genres(genre_id)')
        .eq('id', artist.id)
        .single()
      if (error) throw error
      return data
    },
  })
  const [alias, setAlias] = useState('')
  const [country, setCountry] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key })
  const run = async (write: PromiseLike<{ error: unknown }>) => {
    const { error } = await write
    setFailed(Boolean(error))
    refresh()
  }
  const supabase = getSupabase()
  const selectedGenres = details.data?.artist_default_genres.map((g) => g.genre_id) ?? []
  const roots = new Set(genres.filter((genre) => !genre.parent_id).map((genre) => genre.id))

  return (
    <div className="mt-3 space-y-4 rounded-lg bg-surface-1 p-3">
      <p className="font-medium">{artist.name}</p>
      <div className="grid grid-cols-[6rem_auto] items-end gap-2">
        <TextField label={t('admin.fields.country_code')} maxLength={2} value={country ?? details.data?.country_code ?? ''} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
        <Button disabled={country === null} onClick={() => void run(supabase.from('artists').update({ country_code: country || null }).eq('id', artist.id))}>{t('common.save')}</Button>
      </div>
      <div>
        <p className="mb-1 text-sm text-text-secondary">{t('admin.aliases')}</p>
        <ul className="flex flex-wrap gap-2">
          {details.data?.artist_aliases.map((entry) => (
            <li key={entry.id} className="inline-flex min-h-touch items-center rounded-full bg-surface-2 pl-4 text-sm">
              {entry.alias}
              <button type="button" aria-label={t('checkin.removeItem', { name: entry.alias })} onClick={() => void run(supabase.from('artist_aliases').delete().eq('id', entry.id))} className="grid size-touch place-items-center text-text-secondary">
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
          <TextField label={t('admin.newAlias')} value={alias} onChange={(e) => setAlias(e.target.value)} autoComplete="off" />
          <Button
            disabled={!alias.trim()}
            onClick={() => {
              void run(supabase.from('artist_aliases').insert({ artist_id: artist.id, alias: alias.trim() }))
              setAlias('')
            }}
          >
            {t('admin.add')}
          </Button>
        </div>
      </div>
      <div>
        <p className="mb-1 text-sm text-text-secondary">{t('checkin.genres')}</p>
        <div className="flex flex-wrap gap-2">
          {genres.filter((genre) => !roots.has(genre.id)).map((genre) => {
            const selected = selectedGenres.includes(genre.id)
            return (
              <Chip
                key={genre.id}
                selected={selected}
                onClick={() =>
                  void run(
                    selected
                      ? supabase.from('artist_default_genres').delete().match({ artist_id: artist.id, genre_id: genre.id })
                      : supabase.from('artist_default_genres').insert({ artist_id: artist.id, genre_id: genre.id }),
                  )
                }
              >
                {genre.name}
              </Chip>
            )
          })}
        </div>
      </div>
      {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}

function TagsAndGenres() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { genres, tags } = useReferenceData()
  const [tagName, setTagName] = useState('')
  const [tagScope, setTagScope] = useState<'set' | 'event'>('set')
  const [genreName, setGenreName] = useState('')
  const [parentId, setParentId] = useState('')
  const [failed, setFailed] = useState(false)
  const supabase = getSupabase()
  const refresh = (key: string) => void queryClient.invalidateQueries({ queryKey: [key] })

  const addTag = async () => {
    const { error } = await supabase.from('tags').insert({ name: tagName.trim(), scope: tagScope, status: 'approved' })
    setFailed(Boolean(error))
    if (!error) setTagName('')
    refresh('tags')
  }
  const addGenre = async () => {
    const slug = genreName.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const { error } = await supabase.from('genres').insert({ name: genreName.trim(), slug, parent_id: parentId || null })
    setFailed(Boolean(error))
    if (!error) setGenreName('')
    refresh('genres')
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <TextField label={t('admin.newTag')} value={tagName} onChange={(e) => setTagName(e.target.value)} autoComplete="off" />
          <Button disabled={!tagName.trim()} onClick={() => void addTag()}>{t('admin.add')}</Button>
        </div>
        <div className="mt-2 flex gap-2">
          <Chip selected={tagScope === 'set'} onClick={() => setTagScope('set')}>{t('admin.tagScopes.set')}</Chip>
          <Chip selected={tagScope === 'event'} onClick={() => setTagScope('event')}>{t('admin.tagScopes.event')}</Chip>
        </div>
        <p className="mt-2 text-sm text-text-secondary">{tags.filter((tag) => tag.scope === tagScope).map((tag) => tag.name).join(', ')}</p>
      </div>
      <div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <TextField label={t('admin.newGenre')} value={genreName} onChange={(e) => setGenreName(e.target.value)} autoComplete="off" />
          <Button disabled={!genreName.trim()} onClick={() => void addGenre()}>{t('admin.add')}</Button>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-sm text-text-secondary">{t('admin.parentGenre')}</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="min-h-touch w-full rounded-lg border border-surface-2 bg-surface-1 px-3">
            <option value="" />
            {genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
          </select>
        </label>
      </div>
      {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}

export function CatalogTab() {
  const { t } = useTranslation()
  const [artist, setArtist] = useState<PickedEntity | null>(null)
  return (
    <>
      <Section title={t('admin.eventStatus')}><EventLifecycle /></Section>
      <Section title={t('admin.artists')}>
        <EntityPicker type="artist" label={t('checkin.artist')} onPick={(picked) => !picked.isNew && setArtist(picked)} />
        {artist && <ArtistEditor key={artist.id} artist={artist} />}
      </Section>
      <Section title={t('admin.tagsAndGenres')}><TagsAndGenres /></Section>
    </>
  )
}
