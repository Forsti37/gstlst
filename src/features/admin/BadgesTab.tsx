import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText, Section, TextField } from '../../app/ui'
import type { Json } from '../../lib/database.types'
import { getSupabase } from '../../lib/supabase'
import { CATEGORIES } from '../badges/api'
import { BadgeIcon } from '../badges/BadgeIcon'

interface Definition {
  id: string
  name: string
  description: string
  description_de: string | null
  category: string
  valid_from: string | null
  valid_to: string | null
  rule: Json
}

const EMPTY = {
  id: null as string | null,
  name: '',
  description: '',
  descriptionDe: '',
  category: 'limited',
  validFrom: '',
  validTo: '',
  rule: JSON.stringify({ metric: 'exists', subject: 'event', filter: { event_id: '' }, levels: [1] }, null, 2),
}
type Draft = typeof EMPTY

const KEY = ['admin', 'badges']

function parseRule(text: string): Json | undefined {
  try {
    return JSON.parse(text) as Json
  } catch {
    return undefined
  }
}

/** "Who would have it right now?" while typing. The server validates the rule too. */
function Preview({ rule, validFrom, validTo }: { rule: string; validFrom: string; validTo: string }) {
  const { t } = useTranslation()
  const [debounced, setDebounced] = useState({ rule, validFrom, validTo })
  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ rule, validFrom, validTo }), 400)
    return () => clearTimeout(timer)
  }, [rule, validFrom, validTo])
  const parsed = parseRule(debounced.rule)
  const preview = useQuery({
    queryKey: ['admin', 'badgePreview', debounced],
    enabled: parsed !== undefined,
    retry: false,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('admin_preview_badge', {
        rule: parsed!,
        valid_from: debounced.validFrom || undefined,
        valid_to: debounced.validTo || undefined,
      })
      if (error) throw error
      return data
    },
  })
  if (parsed === undefined) return <ErrorText>{t('admin.badges.invalidJson')}</ErrorText>
  if (preview.isError) return <ErrorText>{t('admin.badges.invalidRule', { message: preview.error.message })}</ErrorText>
  const earned = (preview.data ?? []).filter((row) => row.level > 0)
  return (
    <div>
      <h3 className="text-sm font-semibold">{t('admin.badges.preview', { count: earned.length })}</h3>
      <ul className="mt-1 text-sm">
        {(preview.data ?? []).map((row) => (
          <li key={row.username} className="flex justify-between gap-3 py-1">
            <span className="truncate">@{row.username}</span>
            <span className="shrink-0 text-text-secondary tabular-nums">{t('admin.badges.previewRow', { value: row.value, level: row.level })}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Editor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(draft)
  const set = (changes: Partial<Draft>) => setForm((current) => ({ ...current, ...changes }))
  const rule = parseRule(form.rule)

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        name: form.name.trim(),
        description: form.description.trim(),
        description_de: form.descriptionDe.trim() || null,
        category: form.category,
        valid_from: form.validFrom || null,
        valid_to: form.validTo || null,
        rule: rule!,
      }
      const table = getSupabase().from('badge_definitions')
      const { error } = form.id ? await table.update(row).eq('id', form.id) : await table.insert(row)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY })
      onClose()
    },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().from('badge_definitions').delete().eq('id', form.id!)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY })
      onClose()
    },
  })

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <TextField label={t('admin.badges.name')} value={form.name} onChange={(e) => set({ name: e.target.value })} required />
      <TextField label={t('admin.badges.description')} value={form.description} onChange={(e) => set({ description: e.target.value })} required />
      <TextField label={t('admin.badges.descriptionDe')} value={form.descriptionDe} onChange={(e) => set({ descriptionDe: e.target.value })} />
      <label className="block">
        <span className="mb-1 block text-sm text-text-secondary">{t('admin.badges.category')}</span>
        <select className="min-h-touch w-full rounded-lg border border-surface-2 bg-surface-1 px-3" value={form.category} onChange={(e) => set({ category: e.target.value })}>
          {CATEGORIES.map((key) => <option key={key} value={key}>{t(`badges.categories.${key}`)}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <TextField type="date" label={t('admin.badges.validFrom')} value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
        <TextField type="date" label={t('admin.badges.validTo')} value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} />
      </div>
      <label className="block">
        <span className="mb-1 block text-sm text-text-secondary">{t('admin.badges.rule')}</span>
        <textarea
          className="min-h-48 w-full rounded-lg border border-surface-2 bg-surface-1 p-3 font-mono text-sm"
          spellCheck={false}
          value={form.rule}
          onChange={(e) => set({ rule: e.target.value })}
        />
      </label>
      <Preview rule={form.rule} validFrom={form.validFrom} validTo={form.validTo} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending || rule === undefined}>{t('common.save')}</Button>
        <Button onClick={onClose}>{t('admin.badges.cancel')}</Button>
        {form.id && (
          <Button variant="danger" onClick={() => window.confirm(t('admin.badges.deleteConfirm', { name: form.name })) && remove.mutate()}>
            {t('admin.badges.delete')}
          </Button>
        )}
      </div>
      {save.isError && <ErrorText>{t('admin.badges.invalidRule', { message: save.error.message })}</ErrorText>}
      {remove.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </form>
  )
}

export function BadgesTab() {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft | null>(null)
  const definitions = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('badge_definitions')
        .select('id, name, description, description_de, category, valid_from, valid_to, rule')
        .order('category')
        .order('name')
      if (error) throw error
      return data as Definition[]
    },
  })

  if (draft) return <Editor key={draft.id ?? 'new'} draft={draft} onClose={() => setDraft(null)} />

  return (
    <>
      <Button variant="primary" onClick={() => setDraft(EMPTY)}>{t('admin.badges.new')}</Button>
      {definitions.isError && <ErrorText>{t('badges.loadFailed')}</ErrorText>}
      <Section title={t('admin.badges.count', { count: definitions.data?.length ?? 0 })}>
        <ul className="space-y-1">
          {definitions.data?.map((definition) => (
            <li key={definition.id}>
              <button
                type="button"
                className="flex min-h-touch w-full items-center gap-3 rounded-lg bg-surface-1 px-3 py-2 text-left"
                onClick={() =>
                  setDraft({
                    id: definition.id,
                    name: definition.name,
                    description: definition.description,
                    descriptionDe: definition.description_de ?? '',
                    category: definition.category,
                    validFrom: definition.valid_from ?? '',
                    validTo: definition.valid_to ?? '',
                    rule: JSON.stringify(definition.rule, null, 2),
                  })
                }
              >
                <BadgeIcon category={definition.category} level={1} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{definition.name}</span>
                  <span className="block truncate text-sm text-text-secondary">{definition.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
