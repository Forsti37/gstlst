import '@fontsource-variable/inter/wght.css'
import '@fontsource/anton/400.css'
import './styles/index.css'
import './lib/i18n'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { AuthProvider } from './features/auth/auth'
import { captureInstallPrompt } from './features/install/installPrompt'
import { PERSIST_MAX_AGE, queryClient, queryPersister } from './lib/queryClient'

captureInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: PERSIST_MAX_AGE,
        buster: '1',
        dehydrateOptions: { shouldDehydrateQuery: (query) => query.meta?.persist === true && query.state.status === 'success' },
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
