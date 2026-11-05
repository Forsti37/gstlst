import { Bell, Compass, Plus, Rows3, User, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

type NavKey = 'feed' | 'discover' | 'inbox' | 'profile'

function NavItem({ to, labelKey, icon: Icon }: { to: string; labelKey: NavKey; icon: LucideIcon }) {
  const { t } = useTranslation()
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-touch flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
          isActive ? 'text-text-primary' : 'text-text-secondary'
        }`
      }
    >
      <Icon aria-hidden className="size-6" />
      {t(`nav.${labelKey}`)}
    </NavLink>
  )
}

export function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('nav.label')}
      className="flex items-center border-t border-surface-2 bg-surface-1 pb-[env(safe-area-inset-bottom)]"
    >
      <NavItem to="/" labelKey="feed" icon={Rows3} />
      <NavItem to="/discover" labelKey="discover" icon={Compass} />
      <NavLink
        to="/check-in"
        aria-label={t('nav.checkin')}
        className="flex h-(--gst-nav-height) flex-1 items-center justify-center"
      >
        <span className="grid size-14 place-items-center rounded-full bg-red text-white">
          <Plus aria-hidden strokeWidth={2.5} className="size-7" />
        </span>
      </NavLink>
      <NavItem to="/inbox" labelKey="inbox" icon={Bell} />
      <NavItem to="/profile" labelKey="profile" icon={User} />
    </nav>
  )
}
