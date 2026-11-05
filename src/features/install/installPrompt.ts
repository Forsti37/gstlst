import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event
  listeners.forEach((listener) => listener())
}

/** Must run before React mounts: Chrome can fire the event very early in page load. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    setDeferredPrompt(event as BeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => setDeferredPrompt(null))
}

export async function showInstallPrompt() {
  const event = deferredPrompt
  if (!event) return
  await event.prompt()
  await event.userChoice
  setDeferredPrompt(null) // a prompt event can only be used once
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCanPromptInstall() {
  return useSyncExternalStore(subscribe, () => deferredPrompt !== null)
}
