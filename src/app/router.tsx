import { createBrowserRouter } from 'react-router'
import { CheckinPage } from '../features/checkin/CheckinPage'
import { DiscoverPage } from '../features/discover/DiscoverPage'
import { FeedPage } from '../features/feed/FeedPage'
import { InboxPage } from '../features/inbox/InboxPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { AppShell } from './AppShell'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { index: true, element: <FeedPage /> },
        { path: 'discover', element: <DiscoverPage /> },
        { path: 'check-in', element: <CheckinPage /> },
        { path: 'inbox', element: <InboxPage /> },
        { path: 'profile', element: <ProfilePage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
