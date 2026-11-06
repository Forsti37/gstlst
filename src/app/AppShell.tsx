import { Outlet } from 'react-router'
import { InstallBanner } from '../features/install/InstallBanner'
import { QueueBanner } from '../features/offline/QueueBanner'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
        <Outlet />
      </main>
      <QueueBanner />
      <InstallBanner />
      <BottomNav />
    </div>
  )
}
