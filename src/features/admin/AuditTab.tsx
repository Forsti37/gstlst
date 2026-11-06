import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getSupabase } from '../../lib/supabase'

export function AuditTab() {
  const { t, i18n } = useTranslation()
  const log = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('admin_audit_log')
        .select('id, action, entity_type, diff, created_at, actor:profiles!admin_audit_log_actor_id_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as unknown as { id: number; action: string; entity_type: string; diff: unknown; created_at: string; actor: { username: string } | null }[]
    },
  })
  return (
    <>
      {log.data?.length === 0 && <p className="text-text-secondary">{t('admin.auditEmpty')}</p>}
      <ul className="space-y-2">
        {log.data?.map((entry) => (
          <li key={entry.id} className="rounded-lg bg-surface-1 p-3 text-sm">
            <p className="font-medium">{entry.action} · {entry.entity_type}</p>
            <p className="text-text-secondary">
              {entry.actor ? `@${entry.actor.username}` : '–'} · {new Date(entry.created_at).toLocaleString(i18n.resolvedLanguage)}
            </p>
            {entry.diff != null && (
              <details>
                <summary className="flex min-h-touch cursor-pointer items-center text-text-secondary">{t('admin.details')}</summary>
                <pre className="overflow-x-auto text-xs whitespace-pre-wrap">{JSON.stringify(entry.diff, null, 2)}</pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
