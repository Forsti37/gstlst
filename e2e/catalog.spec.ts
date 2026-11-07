import { expect, test } from '@playwright/test'
import { memberProfile, mockBackend } from './mock-backend'

const admin = { ...memberProfile, role: 'admin' }

test('the catalog saves an Instagram handle as a profile link', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: admin })
  backend.rpcResults.search_entities = [{ id: 'p1', name: 'Beatpatrol', status: 'approved', extra: null, similarity: 1 }]
  backend.tables.promoters = [{ id: 'p1', instagram_url: null }]
  await page.goto('admin/catalog')

  await page.getByLabel('Promoter').fill('Beat')
  await page.getByRole('button', { name: /Beatpatrol/ }).first().click()
  const field = page.getByLabel('Instagram')
  await field.fill('nope nope')
  await page.getByRole('button', { name: 'Save' }).last().click()
  await expect(page.getByText("That isn't an Instagram profile.", { exact: false })).toBeVisible()

  await field.fill('@beatpatrol')
  await page.getByRole('button', { name: 'Save' }).last().click()
  await expect.poll(() => backend.writes.find((write) => write.table === 'promoters')?.body).toEqual({ instagram_url: 'https://www.instagram.com/beatpatrol/' })
})

test('an artist page links Instagram by its handle', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.tables.artists = [{ id: 'a1', name: 'Dossa', status: 'approved', kind: 'person', country_code: 'AT', instagram_url: 'https://www.instagram.com/dossa.dnb/' }]
  await page.goto('artists/a1')
  await expect(page.getByRole('link', { name: 'Instagram @dossa.dnb' })).toHaveAttribute('href', 'https://www.instagram.com/dossa.dnb/')
})
