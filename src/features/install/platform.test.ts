import { describe, expect, it } from 'vitest'
import { detectInstallPlatform } from './platform'

const iphone = (browser: string) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${browser} Mobile/15E148`

describe('detectInstallPlatform', () => {
  it('recognizes Safari on iPhone', () => {
    const userAgent = iphone('Version/18.0 Safari/604.1')
    expect(detectInstallPlatform({ userAgent, platform: 'iPhone', maxTouchPoints: 5 })).toBe('ios-safari')
  })

  it('recognizes iPadOS, which reports itself as a Mac', () => {
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
    expect(detectInstallPlatform({ userAgent, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios-safari')
  })

  it('sends other iOS browsers to Safari', () => {
    const userAgent = iphone('CriOS/130.0.0.0')
    expect(detectInstallPlatform({ userAgent, platform: 'iPhone', maxTouchPoints: 5 })).toBe('ios-other')
  })

  it('does not treat a Mac or Android as iOS', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
    const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'
    expect(detectInstallPlatform({ userAgent: mac, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('other')
    expect(detectInstallPlatform({ userAgent: android, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe('other')
  })
})
