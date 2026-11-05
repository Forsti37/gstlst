import { expect, test } from '@playwright/test'

test('bottom navigation reaches every section', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
})

test('deep links open the right page', async ({ page }) => {
  await page.goto('profile')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
})

test('the UI switches to German', async ({ page }) => {
  await page.goto('profile')
  await page.getByRole('button', { name: 'Deutsch' }).click()
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})

test('the web app manifest is linked and valid', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const response = await request.get(new URL(href!, page.url()).href)
  expect(response.ok()).toBe(true)
  const manifest = (await response.json()) as { name: string; icons: { purpose?: string }[] }
  expect(manifest.name).toBe('GSTLST')
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
})
