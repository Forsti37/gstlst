import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { NotFoundPage } from '../../app/NotFoundPage'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'

export interface Dashboard {
  members: number
  active_users_7d: number
  checkins_per_week: { week: string; count: number }[]
  queues: { data: number; requests: number; photos: number; reports: number }
}

export function useDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('staff_dashboard')
      if (error) throw error
      return data as unknown as Dashboard
    },
  })
}

function Tab({ to, label, count, end }: { to: string; label: string; count?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `inline-flex min-h-touch shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium ${isActive ? 'bg-text-primary text-bg' : 'bg-surface-2 text-text-secondary'}`
      }
    >
      {label}
      {Boolean(count) && <span className="rounded-full bg-red px-1.5 text-xs text-white">{count}</span>}
    </NavLink>
  )
}

/** Staff only. The server checks this on every call too; this just keeps others out of the UI. */
export function AdminLayout() {
  const { t } = useTranslation()
  const me = useMember()
  const staff = me.role === 'admin' || me.role === 'moderator'
  const dashboard = useQuery({
    queryKey: ['admin', 'dashboard'],
    enabled: staff,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('staff_dashboard')
      if (error) throw error
      return data as unknown as Dashboard
    },
  })
  if (!staff) return <NotFoundPage />
  const queues = dashboard.data?.queues

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('admin.title')}</h1>
      <nav aria-label={t('admin.title')} className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <Tab to="/admin" end label={t('admin.tabs.dashboard')} />
        <Tab to="/admin/data" label={t('admin.tabs.data')} count={queues?.data} />
        <Tab to="/admin/requests" label={t('admin.tabs.requests')} count={queues?.requests} />
        <Tab to="/admin/photos" label={t('admin.tabs.photos')} count={queues?.photos} />
        <Tab to="/admin/reports" label={t('admin.tabs.reports')} count={queues?.reports} />
        <Tab to="/admin/verify" label={t('admin.tabs.verify')} />
        <Tab to="/admin/catalog" label={t('admin.tabs.catalog')} />
        <Tab to="/admin/badges" label={t('admin.tabs.badges')} />
        <Tab to="/admin/audit" label={t('admin.tabs.audit')} />
        {me.role === 'admin' && <Tab to="/admin/roles" label={t('admin.tabs.roles')} />}
        {me.role === 'admin' && <Tab to="/admin/invites" label={t('admin.invites')} />}
      </nav>
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  )
}
