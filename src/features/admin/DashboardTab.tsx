import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Section } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { useDashboard } from './AdminLayout'

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl bg-surface-1 p-4">
      <p className="font-display text-4xl tabular-nums">{value ?? '–'}</p>
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  )
}

function WeeklyCheckins({ weeks }: { weeks: { week: string; count: number }[] }) {
  const { t, i18n } = useTranslation()
  if (weeks.length === 0) return <p className="text-text-secondary">{t('admin.noCheckinsYet')}</p>
  const highest = Math.max(...weeks.map((week) => week.count))
  return (
    <ul className="space-y-1">
      {weeks.map((week) => (
        <li key={week.week} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2 text-sm">
          <span className="text-text-secondary">{new Date(`${week.week}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage, { day: 'numeric', month: 'short' })}</span>
          <span className="h-3 rounded bg-text-primary" style={{ width: `${Math.max((week.count / highest) * 100, 2)}%` }} />
          <span className="text-right tabular-nums">{week.count}</span>
        </li>
      ))}
    </ul>
  )
}

function RecentFeedback() {
  const { t } = useTranslation()
  const feedback = useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: async () => {
      const { data, error } = await getSupabase().from('feedback').select('id, text, app_version, github_issue_url, created_at').order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      return data
    },
  })
  if (!feedback.data?.length) return null
  return (
    <Section title={t('admin.feedback')}>
      <ul className="space-y-2">
        {feedback.data.map((entry) => (
          <li key={entry.id} className="rounded-lg bg-surface-1 p-3 text-sm">
            <p className="whitespace-pre-line">{entry.text}</p>
            {entry.github_issue_url && <a href={entry.github_issue_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-touch items-center text-blue">GitHub</a>}
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function DashboardTab() {
  const { t } = useTranslation()
  const me = useMember()
  const { data } = useDashboard()
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('admin.members')} value={data?.members} />
        <Stat label={t('admin.activeUsers')} value={data?.active_users_7d} />
        <Stat label={t('admin.tabs.data')} value={data?.queues.data} />
        <Stat label={t('admin.tabs.requests')} value={data?.queues.requests} />
        <Stat label={t('admin.tabs.photos')} value={data?.queues.photos} />
        <Stat label={t('admin.tabs.reports')} value={data?.queues.reports} />
      </div>
      <Section title={t('admin.checkinsPerWeek')}>
        <WeeklyCheckins weeks={data?.checkins_per_week ?? []} />
      </Section>
      {me.role === 'admin' && <RecentFeedback />}
    </>
  )
}
