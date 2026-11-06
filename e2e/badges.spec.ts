import { expect, test } from '@playwright/test'
import { memberProfile, mockBackend, OTHER_ID, TONIGHT_ID } from './mock-backend'

const badge = (over: Record<string, unknown>) => ({
  id: 'b1',
  name: 'Closing Crew',
  description: 'Sets tagged Closing',
  description_de: 'Sets mit dem Tag Closing',
  category: 'time',
  levels: [5, 10, 25],
  level_names: null,
  valid_from: null,
  valid_to: null,
  level: 0,
  value: 7,
  awarded_at: null,
  ...over,
})

test('your own badge page shows progress and the whole catalog', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_badges = [
    badge({ level: 1 }),
    badge({ id: 'b2', name: 'Regular', category: 'places', levels: [5, 10, 25], level_names: ['Regular', 'Local', 'Part of the Furniture'], level: 3, value: 30 }),
    badge({ id: 'b3', name: 'Castle Raver', category: 'places', levels: [1, 3, 5], value: 0 }),
  ]
  await page.goto('badges')

  await expect(page.getByText('2 of 3 earned')).toBeVisible()
  await expect(page.getByText('7/10')).toBeVisible()
  await expect(page.getByText('Part of the Furniture')).toBeVisible()
  await expect(page.getByText('Highest level reached')).toBeVisible()
  // Not earned yet, and still visible: there are no secret badges.
  await expect(page.getByText('Castle Raver')).toBeVisible()

  await page.getByRole('button', { name: 'Places' }).click()
  await expect(page.getByText('Closing Crew')).toHaveCount(0)
  await expect(page.getByText('Castle Raver')).toBeVisible()
})

test('someone else shows only what they earned, without progress', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_badges = [badge({ level: 1, value: null }), badge({ id: 'b2', name: 'Castle Raver', value: null })]
  await page.goto(`badges/${OTHER_ID}`)
  await expect(page.getByText('Closing Crew')).toBeVisible()
  await expect(page.getByText('Castle Raver')).toHaveCount(0)
  await expect(page.getByText(/\d+\/\d+/)).toHaveCount(0)
})

test('hidden badges say so', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_badges = []
  await page.goto(`badges/${OTHER_ID}`)
  await expect(page.getByText('These badges are not visible to you.')).toBeVisible()
})

test('a check-in evaluates badges last and shows what it earned', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_badges = []
  backend.tables.checkin_fun_facts = [
    { id: 'f1', kind: 'artist_seen', payload: { artist: 'Bea', artist_id: 'a1', n: 1 } },
    { id: 'f2', kind: 'event_milestone', payload: { n: 50 } },
  ]
  await page.route('**/rest/v1/rpc/evaluate_my_badges', async (route) => {
    backend.rpcResults.get_badges = [badge({ name: 'First Drop', category: 'starter', levels: [1], level: 1, value: 1, awarded_at: new Date().toISOString() })]
    await route.fallback()
  })

  await page.goto(`check-in/${TONIGHT_ID}`)
  await page.getByRole('button', { name: 'I was here' }).click()
  await page.getByRole('button', { name: /Bea/ }).click()
  await page.getByRole('button', { name: 'Rate 1 set' }).click()
  await page.getByRole('slider', { name: 'Rating for Bea' }).fill('4.5')
  await page.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByText('First Drop')).toBeVisible()
  await expect(page.getByText('Your 50th event')).toBeVisible()
  await expect(page.getByText('First time seeing Bea')).toBeVisible()
  expect(backend.rpcCalls.map((call) => call.name)).toContain('evaluate_my_badges')
  expect(backend.writes.map((write) => write.table)).toContain('set_checkins')
})

test('the inbox links a new badge to the badge page', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.tables.notifications = [{ id: 'n1', type: 'badge', payload: { name: 'Neuro Head', badge: 'Neuro Nerd', level: 2 }, read_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }]
  await page.goto('inbox')
  await expect(page.getByRole('link', { name: /New badge: Neuro Head/ })).toHaveAttribute('href', /badges$/)
})

test.describe('the badge editor', () => {
  const admin = { ...memberProfile, role: 'admin' }

  test('previews who would have a rule while typing, and rejects broken JSON', async ({ page }) => {
    const backend = await mockBackend(page, { signedIn: true, profile: admin })
    backend.tables.badge_definitions = [{ id: 'b1', name: 'Raver', description: 'Events in total', description_de: null, category: 'starter', valid_from: null, valid_to: null, rule: { metric: 'count', subject: 'event', levels: [5] } }]
    backend.rpcResults.admin_preview_badge = [{ username: 'lisa', display_name: 'Lisa', value: 7, level: 1 }]
    await page.goto('admin/badges')

    await page.getByRole('button', { name: /Raver/ }).click()
    await expect(page.getByText('1 person would have it right now')).toBeVisible()
    await expect(page.getByText('@lisa')).toBeVisible()
    expect(backend.rpcCalls.some((call) => call.name === 'admin_preview_badge')).toBe(true)

    await page.getByLabel('Rule (JSON)').fill('{ broken')
    await expect(page.getByText('This is not valid JSON yet.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('saves a new badge', async ({ page }) => {
    const backend = await mockBackend(page, { signedIn: true, profile: admin })
    backend.tables.badge_definitions = []
    backend.rpcResults.admin_preview_badge = []
    await page.goto('admin/badges')

    await page.getByRole('button', { name: 'New badge' }).click()
    await page.getByLabel('Name').fill('10 years of Testfest')
    await page.getByLabel('Description (English)').fill('Were there for the anniversary')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect.poll(() => backend.writes.find((write) => write.table === 'badge_definitions')?.method).toBe('POST')
  })

  test('stays hidden from normal members', async ({ page }) => {
    await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('admin/badges')
    await expect(page.getByRole('button', { name: 'New badge' })).toHaveCount(0)
  })
})
