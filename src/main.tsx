import '@fontsource-variable/inter/wght.css'
import '@fontsource/anton/400.css'
import './styles/index.css'
import './lib/i18n'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { AuthProvider } from './features/auth/auth'
import { captureInstallPrompt } from './features/install/installPrompt'
import { queryClient } from './lib/queryClient'

captureInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
