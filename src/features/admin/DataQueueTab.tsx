import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText, TextField } from '../../app/ui'
import type { Json } from '../../lib/database.types'
import { getSupabase } from '../../lib/supabase'
import { Card, DecisionButtons, EmptyQueue, useDecision } from './shared'

type Table = 'events' | 'sets' | 'floors' | 'venues' | 'artists' | 'promoters' | 'event_series' | 'tags'
type Row = Record<string, unknown> & { id: string; created_at?: string }

interface QueueType {
  table: Table
  searchAs?: 'event' | 'artist' | 'venue' | 'promoter'
  fields: string[]
  extra?: string
}

const QUEUES: QueueType[] = [
  { table: 'events', searchAs: 'event', fields: ['name', 'date_start', 'date_end'], extra: ', venue:venues(name, city)' },
  { table: 'sets', fields: ['set_type'], extra: ', event:events(name), set_artists(artist:artists(name))' },
  { table: 'floors', fields: ['name'], extra: ', event:events(name)' },
  { table: 'venues', searchAs: 'venue', fields: ['name', 'city', 'country_code', 'lat', 'lng', 'venue_type'] },
  { table: 'artists', searchAs: 'artist', fields: ['name', 'kind', 'country_code', 'instagram_url'] },
  { table: 'promoters', searchAs: 'promoter', fields: ['name', 'instagram_url'] },
  { table: 'event_series', fields: ['name'] },
  { table: 'tags', fields: ['name'] },
]

function describe(row: Row) {
  const event = row.event as { name?: string } | null | undefined
  const venue = row.venue as { name?: string; city?: string } | null | undefined
  const artists = (row.set_artists as { artist: { name: string } | null }[] | undefined)
    ?.flatMap((entry) => (entry.artist ? [entry.artist.name] : []))
    .join(' + ')
  return [artists, event?.name, venue && `${venue.name}, ${venue.city}`].filter(Boolean).join(' · ')
}

/** Trigram matches for the name, including other pending entries. Merging keeps the chosen one. */
function Duplicates({ type, row, onDone }: { type: QueueType; row: Row; onDone: () => void }) {
  const { t } = useTranslation()
  const name = String(row.name ?? '')
  const matches = useQuery({
    queryKey: ['admin', 'duplicates', type.table, row.id, name],
    enabled: Boolean(type.searchAs && name),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('search_entities', { entity_type: type.searchAs!, query: name, max_results: 5 })
      if (error) throw error
      return data.filter((match) => match.id !== row.id && match.score > 0.3)
    },
  })
  const merge = useDecision((to: string) => getSupabase().rpc('moderate_merge', { entity_table: type.table, from_id: row.id, to_id: to }))

  if (!matches.data?.length) return null
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-sm text-text-secondary">{t('admin.possibleDuplicates')}</p>
      <ul>
        {matches.data.map((match) => (
          <li key={match.id} className="flex items-center gap-2 py-1">
            <span className="min-w-0 flex-1 truncate">{match.name} <span className="text-xs text-text-secondary">{Math.round(match.score * 100)}%</span></span>
            <Button
              onClick={() => {
                if (window.confirm(t('admin.mergeConfirm', { from: name, to: match.name }))) merge.mutate(match.id, { onSuccess: onDone })
              }}
            >
              {t('admin.merge')}
            </Button>
          </li>
        ))}
      </ul>
      {merge.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}

function QueueItem({ type, row }: { type: QueueType; row: Row }) {
  const { t } = useTranslation()
  const [edits, setEdits] = useState<Record<string, string>>({})
  const creator = row.creator as { username: string } | null | undefined
  const summary = describe(row)

  const decide = useDecision((input: { decision: 'approve' | 'reject'; reason?: string }) =>
    getSupabase().rpc('moderate_entity', {
      entity_table: type.table,
      entity_id: row.id,
      decision: input.decision,
      reason: input.reason,
      changes: (Object.keys(edits).length > 0 ? edits : undefined) as Json,
    }),
  )

  return (
    <Card>
      <p className="text-xs tracking-wide text-text-secondary uppercase">
        {t(`admin.entities.${type.table}`)}
        {creator && ` · @${creator.username}`}
      </p>
      {summary && <p className="font-medium">{summary}</p>}
      <div className="grid grid-cols-2 gap-2">
        {type.fields.map((field) => (
          <TextField
            key={field}
            label={t(`admin.fields.${field}` as 'admin.fields.name')}
            value={edits[field] ?? String(row[field] ?? '')}
            onChange={(e) => setEdits((current) => ({ ...current, [field]: e.target.value }))}
          />
        ))}
      </div>
      <Duplicates type={type} row={row} onDone={() => undefined} />
      <DecisionButtons
        disabled={decide.isPending}
        failed={decide.isError}
        onApprove={() => decide.mutate({ decision: 'approve' })}
        onReject={(reason) => decide.mutate({ decision: 'reject', reason })}
      />
    </Card>
  )
}

export function DataQueueTab() {
  const pending = useQuery({
    queryKey: ['admin', 'dataQueue'],
    queryFn: async () => {
      const client = getSupabase() as unknown as SupabaseClient
      const lists = await Promise.all(
        QUEUES.map(async (type) => {
          const { data, error } = await client
            .from(type.table)
            .select(`*, creator:profiles!${type.table}_created_by_fkey(username)${type.extra ?? ''}`)
            .eq('status', 'pending')
          if (error) throw error
          return (data as unknown as Row[]).map((row) => ({ type, row }))
        }),
      )
      return lists.flat()
    },
  })

  return (
    <>
      <EmptyQueue isPending={pending.isPending} count={pending.data?.length ?? 0} />
      <ul className="space-y-3">
        {pending.data?.map(({ type, row }) => <QueueItem key={`${type.table}-${row.id}`} type={type} row={row} />)}
      </ul>
    </>
  )
}
