import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getSupabase } from '../../lib/supabase'
import { fetchLineup, setLabel, useReferenceData } from '../checkin/api'
import { Card, DecisionButtons, EmptyQueue, useDecision } from './shared'

interface Request {
  id: string
  entity_type: string
  entity_id: string
  diff: Record<string, unknown>
  creator: { username: string } | null
  event: string | null
}

function TimetableDiff({ request }: { request: Request }) {
  const { i18n } = useTranslation()
  const lineup = useQuery({ queryKey: ['admin', 'lineup', request.entity_id], queryFn: () => fetchLineup(request.entity_id) })
  const entries = (request.diff.sets ?? []) as { set_id: string; start_at: string; end_at: string | null }[]
  const time = (value: string) => new Date(value).toLocaleString(i18n.resolvedLanguage, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <ul className="text-sm">
      {entries.map((entry) => {
        const set = lineup.data?.sets.find((s) => s.id === entry.set_id)
        return (
          <li key={entry.set_id} className="py-1">
            <span className="font-medium">{set ? setLabel(set) : entry.set_id}</span>: {time(entry.start_at)}
            {entry.end_at && ` – ${time(entry.end_at)}`}
          </li>
        )
      })}
    </ul>
  )
}

function RequestItem({ request }: { request: Request }) {
  const { t } = useTranslation()
  const { tags } = useReferenceData()
  const decide = useDecision((input: { decision: 'approve' | 'reject'; reason?: string }) =>
    getSupabase().rpc('review_change_request', { request_id: request.id, decision: input.decision, reason: input.reason }),
  )
  const tagNames = ((request.diff.add_tag_ids ?? []) as string[]).map((id) => tags.find((tag) => tag.id === id)?.name ?? id)

  return (
    <Card>
      <p className="text-xs tracking-wide text-text-secondary uppercase">
        {t(`admin.requestTypes.${request.entity_type}` as 'admin.requestTypes.event_tags')}
        {request.creator && ` · @${request.creator.username}`}
      </p>
      <p className="font-medium">{request.event}</p>
      {request.entity_type === 'event_timetable' && <TimetableDiff request={request} />}
      {request.entity_type === 'event_tags' && <p className="text-sm">{tagNames.join(', ')}</p>}
      {request.entity_type === 'event_correction' && (
        <ul className="text-sm">
          {Object.entries(request.diff).map(([field, value]) => <li key={field}>{t(`admin.fields.${field}` as 'admin.fields.name')}: {String(value)}</li>)}
        </ul>
      )}
      <DecisionButtons
        disabled={decide.isPending}
        failed={decide.isError}
        onApprove={() => decide.mutate({ decision: 'approve' })}
        onReject={(reason) => decide.mutate({ decision: 'reject', reason })}
      />
    </Card>
  )
}

export function RequestsTab() {
  const requests = useQuery({
    queryKey: ['admin', 'requests'],
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('change_requests')
        .select('id, entity_type, entity_id, diff, creator:profiles!change_requests_created_by_fkey(username)')
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      const rows = data as unknown as Omit<Request, 'event'>[]
      const ids = [...new Set(rows.map((row) => row.entity_id))]
      const events = ids.length > 0 ? await supabase.from('events').select('id, name').in('id', ids) : { data: [] }
      return rows.map((row): Request => ({ ...row, event: events.data?.find((event) => event.id === row.entity_id)?.name ?? null }))
    },
  })
  return (
    <>
      <EmptyQueue isPending={requests.isPending} count={requests.data?.length ?? 0} />
      <ul className="space-y-3">{requests.data?.map((request) => <RequestItem key={request.id} request={request} />)}</ul>
    </>
  )
}
