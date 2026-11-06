import { expect, test } from '@playwright/test'
import { memberProfile, mockBackend } from './mock-backend'

const wrapped = {
  owner: { username: 'e2e_raver', display_name: 'E2E Raver', avatar_path: null },
  own: true,
  in_progress: false,
  period: { kind: 'year', from: '2025-01-01', to: '2025-12-31', event_name: null },
  numbers: { events: 12, sets: 40, artists: 25, venues: 6, cities: 3, countries: 2, avg_rating: 4.2 },
  top_artist: { id: 'a1', name: 'Bea', sets: 7 },
  top_venue: { id: 'v1', name: 'Flex', city: 'Wien', events: 5 },
  genres: [{ label: 'Drum & Bass', sets: 30 }],
  best_set: { rating: 5, event: 'Beatpatrol', artists: 'Bea & Cid' },
  longest_night: { event: 'Beatpatrol', date: '2025-10-25', sets: 9 },
  active_month: { month: '2025-10', events: 4 },
  new_artists: { count: 11, names: ['Bea', 'Cid'] },
  persona: 'warehouse_rat',
  buddy: { username: 'lisa', display_name: 'Lisa', avatar_path: null, events: 6 },
  badges: [{ id: 'b1', category: 'time', level: 2, name: 'Closing Crew' }],
  places: { countries: ['AT', 'DE'], cities: [{ city: 'Wien', lat: 48.2, lng: 16.3, events: 8 }, { city: 'Berlin', lat: 52.5, lng: 13.4, events: 2 }] },
  collage: [
    { type: 'photo', path: 'me/one.webp' },
    { type: 'tile', date: '2025-10-25', venue: 'Flex', artist: 'Bea' },
  ],
}

const next = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Next slide' }).click()

async function goToSlide(page: import('@playwright/test').Page, slide: string) {
  for (let step = 0; step < 20; step += 1) {
    if (await page.locator(`[data-slide="${slide}"]`).count()) return
    await next(page)
  }
  throw new Error(`No slide ${slide}`)
}

test('the story moves through its slides with a progress bar', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_wrapped = wrapped
  backend.rpcResults.get_my_spending = []
  await page.goto('wrapped/e2e_raver/2025')

  await expect(page.getByText("Here's what you got up to")).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  await next(page)
  await expect(page.getByText('The damage')).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  await page.getByRole('button', { name: 'Previous slide' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')

  for (const [slide, text] of [
    ['top_artist', '7 sets'],
    ['top_venue', '5 events in Wien'],
    ['buddy', 'Lisa'],
    ['persona', 'The Warehouse Rat'],
    ['summary', '@e2e_raver'],
  ] as const) {
    await goToSlide(page, slide)
    await expect(page.locator(`[data-slide="${slide}"]`)).toContainText(text)
  }
})

test('swiping changes the slide', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_wrapped = wrapped
  backend.rpcResults.get_my_spending = []
  await page.goto('wrapped/e2e_raver/2025')
  const stage = page.getByTestId('wrapped-stage')
  await expect(stage).toBeVisible()
  const box = (await stage.boundingBox())!
  await page.mouse.move(box.x + box.width - 20, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + 20, box.y + 200)
  await page.mouse.up()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
})

test('a slide exports as a story-sized image and counts as shared', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_wrapped = wrapped
  backend.rpcResults.get_my_spending = []
  await page.goto('wrapped/e2e_raver/2025')
  await goToSlide(page, 'numbers')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Share as image' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('gstlst-wrapped-e2e_raver-2025-numbers.png')

  const path = await file.path()
  const size = await page.evaluate(async (bytes) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)
    return { width: bitmap.width, height: bitmap.height }
  }, [...(await import('node:fs')).readFileSync(path)])
  expect(size).toEqual({ width: 1080, height: 1920 })
  await expect.poll(() => backend.rpcCalls.some((call) => call.name === 'mark_wrapped_shared')).toBe(true)
})

test('the spending slide is yours alone and cannot be exported', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_wrapped = wrapped
  backend.rpcResults.get_my_spending = [{ currency: 'EUR', tickets: 300, other: 150, events: 12 }]
  await page.goto('wrapped/e2e_raver/2025')
  await goToSlide(page, 'spending')
  await expect(page.locator('[data-slide="spending"]')).toContainText('Only you can see this')
  await expect(page.getByRole('button', { name: 'Share as image' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0)

  await goToSlide(page, 'summary')
  await expect(page.locator('[data-slide="summary"]')).not.toContainText('300')
})

test("someone else's Wrapped has no spending slide and doesn't ask for it", async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_wrapped = { ...wrapped, own: false, owner: { username: 'lisa', display_name: 'Lisa', avatar_path: null } }
  await page.goto('wrapped/lisa/2025')
  await expect(page.getByText("Here's what Lisa got up to")).toBeVisible()
  await goToSlide(page, 'summary')
  await expect(page.locator('[data-slide="spending"]')).toHaveCount(0)
  expect(backend.rpcCalls.some((call) => call.name === 'get_my_spending')).toBe(false)
})

test('locked, hidden and empty periods say so', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_wrapped = { locked: true, opens: '2030-12-01' }
  await page.goto('wrapped/e2e_raver/2030')
  await expect(page.getByText(/This year opens on/)).toBeVisible()

  backend.rpcResults.get_wrapped = null
  await page.goto('wrapped/lisa/2025')
  await expect(page.getByText("This Wrapped isn't visible to you.")).toBeVisible()

  backend.rpcResults.get_wrapped = { ...wrapped, empty: true }
  await page.goto('wrapped/e2e_raver/2001')
  await expect(page.getByText(/Nothing checked in here/)).toBeVisible()
})

test('the hub opens a period and keeps the current year closed until December', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'))
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.explore_stats = [{ key: '2025', label: '2025', events: 3, sets: 9, avg_rating: null }]
  backend.rpcResults.get_wrapped = wrapped
  backend.rpcResults.get_my_spending = []
  backend.rpcResults.list_community_wrapped = []
  await page.goto('wrapped')

  await expect(page.getByText('opens December 1st')).toBeVisible()
  await expect(page.getByRole('link', { name: '2026' })).toHaveCount(0)
  await page.getByRole('link', { name: '2025' }).click()
  await expect(page).toHaveURL(/wrapped\/e2e_raver\/2025$/)
})

test('an unlocked Community Wrapped shows up in the hub', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.explore_stats = []
  backend.rpcResults.list_community_wrapped = [2025]
  backend.rpcResults.get_community_wrapped = {
    year: 2025, events: 80, sets: 300, ravers: 9,
    top_artist: { id: 'a1', name: 'Bea', sets: 40 },
    top_venue: { id: 'v1', name: 'Flex', city: 'Wien', checkins: 50 },
    best_sound: { id: 'v2', name: 'Grelle Forelle', city: 'Wien', rating: 4.8 },
  }
  await page.goto('wrapped')
  await expect(page.getByText('Community 2025')).toBeVisible()
  await expect(page.getByText('Grelle Forelle · 4.8')).toBeVisible()
})

test('admins can unlock a Community Wrapped', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: { ...memberProfile, role: 'admin' } })
  backend.rpcResults.list_community_wrapped = []
  await page.goto('admin/wrapped')
  await page.getByLabel('Year').fill('2025')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect.poll(() => backend.rpcCalls.find((call) => call.name === 'admin_set_community_wrapped')).toMatchObject({ for_year: 2025, unlocked: true })
})
