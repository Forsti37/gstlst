import { expect, test } from '@playwright/test'
import { memberProfile, mockBackend, OTHER_ID } from './mock-backend'

const moderator = { ...memberProfile, role: 'moderator' }
const admin = { ...memberProfile, role: 'admin' }

const pendingVenue = {
  id: 'venue-new',
  name: 'Keller',
  city: 'Melk',
  country_code: 'AT',
  lat: null,
  lng: null,
  venue_type: 'club',
  status: 'pending',
  creator: { username: 'lisa' },
}

test('the admin area stays hidden from normal users', async ({ page }) => {
  await mockBackend(page, { signedIn: true, profile: memberProfile })
  await page.goto('admin')
  await expect(page.getByRole('heading', { name: 'Not on the list' })).toBeVisible()
  await page.goto('settings')
  await expect(page.getByRole('link', { name: 'Open admin area' })).toBeHidden()
})

test('a moderator sees the dashboard, but no roles or invites', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: moderator })
  state.rpcResults.staff_dashboard = {
    members: 7,
    active_users_7d: 3,
    checkins_per_week: [{ week: '2026-11-02', count: 12 }],
    queues: { data: 4, requests: 1, photos: 2, reports: 0 },
  }
  await page.goto('settings')
  await page.getByRole('link', { name: 'Open admin area' }).click()
  await expect(page.getByText('Active in the last 7 days')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Roles' })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Invite codes' })).toBeHidden()
  await page.goto('admin/roles')
  await expect(page.getByRole('heading', { name: 'Not on the list' })).toBeVisible()
})

test('new data can be edited and approved, with coordinates', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: moderator })
  state.tables.venues = [pendingVenue]
  await page.goto('admin/data')
  await expect(page.getByText('@lisa')).toBeVisible()
  await page.getByLabel('Latitude').fill('48.2245')
  await page.getByLabel('Longitude').fill('15.3464')
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect.poll(() => state.rpcCalls.find((call) => call.name === 'moderate_entity')).toMatchObject({
    entity_table: 'venues',
    entity_id: 'venue-new',
    decision: 'approve',
    changes: { lat: '48.2245', lng: '15.3464' },
  })
})

test('a rejection asks for a reason and refuses an empty one', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: moderator })
  state.tables.venues = [pendingVenue]
  await page.goto('admin/data')

  page.once('dialog', (dialog) => void dialog.accept('   '))
  await page.getByRole('button', { name: 'Reject' }).click()
  await expect(page.getByText('A rejection needs a reason.')).toBeVisible()
  expect(state.rpcCalls.some((call) => call.name === 'moderate_entity')).toBe(false)

  page.once('dialog', (dialog) => void dialog.accept('Gibt es nicht'))
  await page.getByRole('button', { name: 'Reject' }).click()
  await expect.poll(() => state.rpcCalls.find((call) => call.name === 'moderate_entity')).toMatchObject({ decision: 'reject', reason: 'Gibt es nicht' })
})

test('duplicates are suggested and can be merged', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: moderator })
  state.tables.venues = [{ ...pendingVenue, name: 'Flex Wien' }]
  state.rpcResults.search_entities = [
    { id: 'venue-new', name: 'Flex Wien', score: 1, status: 'pending' },
    { id: 'venue-1', name: 'Flex, Wien', score: 0.8, status: 'approved' },
  ]
  await page.goto('admin/data')
  await expect(page.getByText('Possible duplicates')).toBeVisible()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Merge' }).click()
  await expect.poll(() => state.rpcCalls.find((call) => call.name === 'moderate_merge')).toMatchObject({ entity_table: 'venues', from_id: 'venue-new', to_id: 'venue-1' })
})

test('photos can be approved in the queue', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: moderator })
  state.media = [{ id: 'photo-1', storage_path: 'someone/photo.webp', moderation_status: 'pending', owner: { username: 'lisa' } }]
  await page.goto('admin/photos')
  await expect(page.getByRole('img', { name: 'Photo to review' })).toBeVisible()
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect.poll(() => state.rpcCalls.find((call) => call.name === 'moderate_media')).toMatchObject({ media_id: 'photo-1', decision: 'approve' })
})

test('an admin can assign the moderator role, but not change an admin', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: admin })
  state.rpcResults.admin_list_members = [
    { id: admin.id, username: admin.username, display_name: admin.display_name, role: 'admin', created_at: admin.created_at },
    { id: OTHER_ID, username: 'lisa', display_name: 'Lisa', role: 'user', created_at: admin.created_at },
  ]
  await page.goto('admin/roles')
  await expect(page.getByRole('button', { name: 'Make moderator' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Make moderator' }).click()
  await expect.poll(() => state.rpcCalls.find((call) => call.name === 'admin_set_moderator')).toMatchObject({ target_user: OTHER_ID, is_moderator: true })
})

test('a profile can be reported', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  await page.goto('u/lisa')
  page.once('dialog', (dialog) => void dialog.accept('Spam'))
  await page.getByRole('button', { name: 'Report' }).click()
  await expect(page.getByText('It is hidden until someone has reviewed it.')).toBeVisible()
  expect(state.rpcCalls.find((call) => call.name === 'report_content')).toMatchObject({ target_type: 'profile', target_id: OTHER_ID, reason: 'Spam' })
})

test('the inbox shows a rejection with its reason', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  state.tables.notifications = [
    { id: 'n1', type: 'data_decision', payload: { name: 'Keller', decision: 'reject', reason: 'Gibt es nicht' }, read_at: null, created_at: '2026-11-06T10:00:00Z' },
  ]
  await page.goto('inbox')
  await expect(page.getByText('“Keller” was rejected.')).toBeVisible()
  await expect(page.getByText('Reason: Gibt es nicht')).toBeVisible()
})

test('feedback goes to the function with version and device', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  await page.goto('settings')
  await page.getByLabel('What works, and what doesn’t?').fill('Slider ist super')
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Thanks!')).toBeVisible()
  const sent = state.feedback[0] as { text: string; appVersion: string; device: string }
  expect(sent.text).toBe('Slider ist super')
  expect(sent.appVersion).toMatch(/^\d+\.\d+\.\d+$/)
  expect(sent.device).toContain('Mozilla')
})
