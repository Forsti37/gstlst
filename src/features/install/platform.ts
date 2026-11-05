export type InstallPlatform = 'ios-safari' | 'ios-other' | 'other'

export interface PlatformInfo {
  userAgent: string
  platform: string
  maxTouchPoints: number
}

export function detectInstallPlatform({ userAgent, platform, maxTouchPoints }: PlatformInfo): InstallPlatform {
  // iPadOS reports itself as a Mac, but Macs have no multi-touch screen.
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
  if (!isIOS) return 'other'
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|Instagram|FBAN|FBAV/.test(userAgent)
  return isOtherBrowser ? 'ios-other' : 'ios-safari'
}

export function isRunningStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}
