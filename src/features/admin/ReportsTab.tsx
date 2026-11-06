import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, ErrorText } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMediaUrls } from '../checkin/api'
import { Card, EmptyQueue, useDecision } from './shared'

interface OpenReport {
  id: string
  target_type: 'media' | 'profile'
  target_id: string
  reason: string
  storage_path: string | null
  username: string | null
}

function ReportItem({ report, photoUrl }: { report: OpenReport; photoUrl: string | undefined }) {
  const { t } = useTranslation()
  const resolve = useDecision((decision: 'dismiss' | 'uphold') => getSupabase().rpc('resolve_report', { report_id: report.id, decision }))
  return (
    <Card>
      <p className="text-xs tracking-wide text-text-secondary uppercase">{t(`admin.reportTargets.${report.target_type}`)}</p>
      <p>{report.reason}</p>
      {report.target_type === 'media' && <img src={photoUrl} alt={t('admin.photoAlt')} className="max-h-96 w-full rounded-lg bg-surface-2 object-contain" />}
      {report.username && <Link to={`/u/${report.username}`} className="inline-flex min-h-touch items-center text-blue">@{report.username}</Link>}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => resolve.mutate('dismiss')}>{t('admin.dismiss')}</Button>
        <Button variant="danger" onClick={() => resolve.mutate('uphold')}>{t(`admin.uphold.${report.target_type}`)}</Button>
      </div>
      {resolve.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </Card>
  )
}

export function ReportsTab() {
  const reports = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase.from('reports').select('id, target_type, target_id, reason').is('resolved_at', null).order('created_at')
      if (error) throw error
      const rows = data as Omit<OpenReport, 'storage_path' | 'username'>[]
      const ids = (type: string) => rows.filter((row) => row.target_type === type).map((row) => row.target_id)
      const [media, profiles] = await Promise.all([
        ids('media').length > 0 ? supabase.from('media').select('id, storage_path').in('id', ids('media')) : { data: [] },
        ids('profile').length > 0 ? supabase.from('profiles').select('id, username').in('id', ids('profile')) : { data: [] },
      ])
      return rows.map((row): OpenReport => ({
        ...row,
        storage_path: media.data?.find((m) => m.id === row.target_id)?.storage_path ?? null,
        username: profiles.data?.find((p) => p.id === row.target_id)?.username ?? null,
      }))
    },
  })
  const { data: urls } = useMediaUrls(reports.data?.flatMap((report) => (report.storage_path ? [report.storage_path] : [])) ?? [])
  return (
    <>
      <EmptyQueue isPending={reports.isPending} count={reports.data?.length ?? 0} />
      <ul className="space-y-3">
        {reports.data?.map((report) => <ReportItem key={report.id} report={report} photoUrl={report.storage_path ? urls?.get(report.storage_path) : undefined} />)}
      </ul>
    </>
  )
}
