import { expect, test } from '@playwright/test'
import { memberProfile, mockBackend, OTHER_ID } from './mock-backend'

test.describe('signed out', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page, { signedIn: false })
  })

  test('app pages lead to the login, including deep links', async ({ page }) => {
    await page.goto('profile')
    await expect(page).toHaveURL(/\/gstlst\/login$/)
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
    await page.goto('u/lisa')
    await expect(page).toHaveURL(/\/gstlst\/login$/)
  })

  test('legal pages are reachable without login', async ({ page }) => {
    await page.goto('login')
    await page.getByRole('link', { name: 'Imprint' }).click()
    await expect(page.getByRole('heading', { name: 'Imprint' })).toBeVisible()
    await page.goto('legal/privacy')
    await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible()
    await page.goto('legal/terms')
    await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible()
  })

  test('an invite link keeps the code for later', async ({ page }) => {
    await page.goto('invite/abc123')
    await expect(page).toHaveURL(/\/gstlst\/login$/)
    await expect(page.getByText('Your invite is saved')).toBeVisible()
  })

  test('the web app manifest is linked and valid', async ({ page, request }) => {
    await page.goto('login')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    const response = await request.get(new URL(href!, page.url()).href)
    expect(response.ok()).toBe(true)
    const manifest = (await response.json()) as { name: string; icons: { purpose?: string }[] }
    expect(manifest.name).toBe('GSTLST')
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })
})

test.describe('signed in without a profile', () => {
  async function fillForm(page: import('@playwright/test').Page, birthYear: string) {
    await page.getByLabel('Invite code').fill('abc123')
    await page.getByLabel('Username').fill('New.Raver!')
    await page.getByLabel('Birth year').fill(birthYear)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Get in' }).click()
  }

  test('onboarding creates the profile and opens the app', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true })
    await page.goto('./')
    await expect(page).toHaveURL(/\/gstlst\/onboarding$/)
    await expect(page.getByLabel('Display name')).toHaveValue('E2E Raver')
    await fillForm(page, '1995')
    await expect(page.getByRole('heading', { name: 'GSTLST' })).toBeVisible()
    const signup = state.rpcCalls.find((call) => call.name === 'complete_signup')
    expect(signup).toMatchObject({ invite_code: 'abc123', username: 'new.raver', birth_year: 1995, accepted_terms: true })
  })

  test('deep links survive onboarding', async ({ page }) => {
    await mockBackend(page, { signedIn: true })
    await page.goto('u/lisa')
    await expect(page).toHaveURL(/\/gstlst\/onboarding$/)
    await fillForm(page, '1995')
    await expect(page).toHaveURL(/\/gstlst\/u\/lisa$/)
    await expect(page.getByRole('button', { name: 'Add as friend' })).toBeVisible()
  })

  test('an invalid invite shows a clear error', async ({ page }) => {
    await mockBackend(page, { signedIn: true, signupError: 'invalid_invite' })
    await page.goto('onboarding')
    await fillForm(page, '1995')
    await expect(page.getByRole('alert')).toHaveText(/isn't valid/)
  })

  test('under 16 ends the sign-up and removes the login', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true, signupError: 'too_young' })
    await page.goto('onboarding')
    await fillForm(page, '2015')
    await expect(page.getByRole('heading', { name: 'Come back at 16' })).toBeVisible()
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(page).toHaveURL(/\/gstlst\/login$/)
    expect(state.rpcCalls.some((call) => call.name === 'delete_own_account')).toBe(true)
  })
})

test.describe('member', () => {
  test('bottom navigation reaches every section', async ({ page }) => {
    await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'GSTLST' })).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await nav.getByRole('link', { name: 'Discover' }).click()
    await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible()
    await nav.getByRole('link', { name: 'Check-in' }).click()
    await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible()
    await nav.getByRole('link', { name: 'Inbox' }).click()
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
    await nav.getByRole('link', { name: 'Profile' }).click()
    await expect(page.getByRole('heading', { name: 'E2E Raver' })).toBeVisible()
    await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible()
  })

  test('opening a profile link offers a friend request', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('u/lisa')
    await page.getByRole('button', { name: 'Add as friend' }).click()
    await expect(page.getByRole('button', { name: 'Cancel request' })).toBeVisible()
    const insert = state.friendshipInserts[0] as { user_a: string; user_b: string; requested_by: string }
    expect(insert.user_a < insert.user_b).toBe(true)
    expect([insert.user_a, insert.user_b]).toContain(OTHER_ID)
    expect(insert.requested_by).toBe(memberProfile.id)
  })

  test('an unknown profile link says so', async ({ page }) => {
    await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('u/nobody')
    await expect(page.getByText("We couldn't find this person.")).toBeVisible()
  })

  test('the UI switches to German and saves it', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('settings')
    await page.getByRole('button', { name: 'Deutsch' }).click()
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect.poll(() => state.profile?.language).toBe('de')
  })

  test('privacy settings save, and deletion needs the username', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('settings')
    const stats = page.getByRole('group', { name: 'Stats' })
    await stats.getByRole('button', { name: 'Only me' }).click()
    await expect(stats.getByRole('button', { name: 'Only me' })).toHaveAttribute('aria-pressed', 'true')
    expect((state.profile?.privacy as Record<string, string>).stats).toBe('private')

    const deleteButton = page.getByRole('button', { name: 'Delete my account' })
    await expect(deleteButton).toBeDisabled()
    await page.getByLabel('Type e2e_raver to confirm').fill('e2e_raver')
    await expect(deleteButton).toBeEnabled()
  })

  test('an admin can copy an invite link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockBackend(page, { signedIn: true, profile: { ...memberProfile, role: 'admin' } })
    await page.goto('admin/invites')
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/\/gstlst\/invite\/abc123$/)
  })

  test('copying still answers without the Clipboard API', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined })
    })
    await mockBackend(page, { signedIn: true, profile: { ...memberProfile, role: 'admin' } })
    await page.goto('admin/invites')
    await page.getByRole('button', { name: 'Copy link' }).click()
    // Either the fallback copied it, or the link is shown for copying by hand.
    await expect(page.getByRole('button', { name: 'Copied' }).or(page.getByRole('alert'))).toBeVisible()
  })

  test('admin pages stay hidden from normal users', async ({ page }) => {
    await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('admin/invites')
    await expect(page.getByRole('heading', { name: 'Not on the list' })).toBeVisible()
  })
})
