import { createBrowserRouter } from 'react-router'
import { AdminLayout } from '../features/admin/AdminLayout'
import { AuditTab } from '../features/admin/AuditTab'
import { CatalogTab } from '../features/admin/CatalogTab'
import { DashboardTab } from '../features/admin/DashboardTab'
import { DataQueueTab } from '../features/admin/DataQueueTab'
import { InvitesPage } from '../features/admin/InvitesPage'
import { PhotosTab } from '../features/admin/PhotosTab'
import { ReportsTab } from '../features/admin/ReportsTab'
import { RequestsTab } from '../features/admin/RequestsTab'
import { RolesTab } from '../features/admin/RolesTab'
import { VerifyTab } from '../features/admin/VerifyTab'
import { RequireMember, RequireOnboarding } from '../features/auth/gates'
import { InvitePage } from '../features/auth/invite'
import { LoginPage } from '../features/auth/LoginPage'
import { OnboardingPage } from '../features/auth/OnboardingPage'
import { CheckinDetailPage } from '../features/checkin/CheckinDetailPage'
import { CheckinFlowPage } from '../features/checkin/CheckinFlowPage'
import { CheckinPage } from '../features/checkin/CheckinPage'
import { EventPage } from '../features/checkin/EventPage'
import { HistoryPage } from '../features/checkin/HistoryPage'
import { NewEventPage } from '../features/checkin/NewEventPage'
import { DiscoverPage } from '../features/discover/DiscoverPage'
import { FeedPage } from '../features/feed/FeedPage'
import { FriendsPage } from '../features/friends/FriendsPage'
import { UserPage } from '../features/friends/UserPage'
import { ArtistPage } from '../features/social/ArtistPage'
import { WishlistPage } from '../features/social/WishlistPage'
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
            { path: 'check-in/new', element: <NewEventPage /> },
            { path: 'check-in/:eventId', element: <CheckinFlowPage /> },
            { path: 'check-ins', element: <HistoryPage /> },
            { path: 'check-ins/:checkinId', element: <CheckinDetailPage /> },
            { path: 'events/:eventId', element: <EventPage /> },
            { path: 'inbox', element: <InboxPage /> },
            { path: 'profile', element: <ProfilePage /> },
            { path: 'settings', element: <SettingsPage /> },
            { path: 'friends', element: <FriendsPage /> },
            { path: 'artists/:artistId', element: <ArtistPage /> },
            { path: 'wishlist', element: <WishlistPage /> },
            { path: 'u/:username', element: <UserPage /> },
            {
              path: 'admin',
              element: <AdminLayout />,
              children: [
                { index: true, element: <DashboardTab /> },
                { path: 'data', element: <DataQueueTab /> },
                { path: 'requests', element: <RequestsTab /> },
                { path: 'photos', element: <PhotosTab /> },
                { path: 'reports', element: <ReportsTab /> },
                { path: 'verify', element: <VerifyTab /> },
                { path: 'catalog', element: <CatalogTab /> },
                { path: 'audit', element: <AuditTab /> },
                { path: 'roles', element: <RolesTab /> },
                { path: 'invites', element: <InvitesPage /> },
              ],
            },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
