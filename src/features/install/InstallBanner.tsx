import { Share, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { showInstallPrompt, useCanPromptInstall } from './installPrompt'
import { detectInstallPlatform, isRunningStandalone } from './platform'

const DISMISSED_KEY = 'gstlst.install-dismissed'

// Storage can throw in private windows; the banner just reappears on the next visit then.
function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Nothing to do: see above.
  }
}

/** Shows Safari's share icon next to the translated word, so the button is easy to spot. */
function ShareLabel({ children }: { children?: ReactNode }) {
  return (
    <span className="whitespace-nowrap text-text-primary">
      <Share aria-hidden className="mr-1 inline size-4 align-text-bottom" />
      {children}
    </span>
  )
}

export function InstallBanner() {
  const { t } = useTranslation()
  const canPrompt = useCanPromptInstall()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [platform] = useState(() =>
    detectInstallPlatform({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    }),
  )

  if (dismissed || isRunningStandalone()) return null
  if (platform === 'other' && !canPrompt) return null

  const dismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <aside className="mx-3 mb-3 flex items-center gap-2 rounded-xl bg-surface-2 py-1 pr-1 pl-4" aria-label={t('install.title')}>
      <div className="min-w-0 flex-1 py-2 text-sm">
        <p className="font-semibold">{t('install.title')}</p>
        <p className="text-text-secondary">
          {platform === 'ios-safari' && (
            <Trans
              i18nKey="install.iosSafari"
              components={{ share: <ShareLabel /> }}
            />
          )}
          {platform === 'ios-other' && t('install.iosOther')}
          {platform === 'other' && t('install.native')}
        </p>
      </div>
      {platform === 'other' && (
        <button
          type="button"
          onClick={() => void showInstallPrompt()}
          className="min-h-touch shrink-0 rounded-lg bg-text-primary px-4 text-sm font-semibold text-bg"
        >
          {t('install.action')}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('install.dismiss')}
        className="grid size-touch shrink-0 place-items-center text-text-secondary"
      >
        <X aria-hidden className="size-5" />
      </button>
    </aside>
  )
}
