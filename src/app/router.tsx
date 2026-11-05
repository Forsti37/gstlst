import { createBrowserRouter } from 'react-router'
import { InvitesPage } from '../features/admin/InvitesPage'
import { RequireMember, RequireOnboarding } from '../features/auth/gates'
import { InvitePage } from '../features/auth/invite'
import { LoginPage } from '../features/auth/LoginPage'
import { OnboardingPage } from '../features/auth/OnboardingPage'
import { CheckinPage } from '../features/checkin/CheckinPage'
import { DiscoverPage } from '../features/discover/DiscoverPage'
import { FeedPage } from '../features/feed/FeedPage'
import { FriendsPage } from '../features/friends/FriendsPage'
import { UserPage } from '../features/friends/UserPage'
import { InboxPage } from '../features/inbox/InboxPage'
import { LegalPage } from '../features/legal/LegalPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AppShell } from './AppShell'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter(
  [
    { path: 'login', element: <LoginPage /> },
    { path: 'invite/:code', element: <InvitePage /> },
    { path: 'legal/:page', element: <LegalPage /> },
    {
      element: <RequireOnboarding />,
      children: [{ path: 'onboarding', element: <OnboardingPage /> }],
    },
    {
      element: <RequireMember />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <FeedPage /> },
            { path: 'discover', element: <DiscoverPage /> },
            { path: 'check-in', element: <CheckinPage /> },
            { path: 'inbox', element: <InboxPage /> },
            { path: 'profile', element: <ProfilePage /> },
            { path: 'settings', element: <SettingsPage /> },
            { path: 'friends', element: <FriendsPage /> },
            { path: 'u/:username', element: <UserPage /> },
            { path: 'admin/invites', element: <InvitesPage /> },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
