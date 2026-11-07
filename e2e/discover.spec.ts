import { expect, test } from '@playwright/test'
import { memberProfile, mockBackend, TONIGHT_ID } from './mock-backend'

test('discover offers categories to click through', async ({ page }) => {
  await mockBackend(page, { signedIn: true, profile: memberProfile })
  await page.goto('discover')
  for (const name of ['Events', 'Artists', 'Genres', 'Venues', 'Promoters', 'Leaderboard', 'Best sound']) {
    await expect(page.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible()
  }
  await page.getByRole('link', { name: /^Venues/ }).click()
  await expect(page).toHaveURL(/discover\/venues$/)
})

test('one search finds events, artists, venues and promoters', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.search_events = [{ id: TONIGHT_ID, name: 'Beatpatrol', date_start: '2025-10-25', date_end: null, status: 'approved', venue_name: 'VAZ', venue_city: 'St. Pölten' }]
  backend.rpcResults.search_entities = [{ id: 'x1', name: 'Beat Thing', status: 'approved', score: 1 }]
  await page.goto('discover')
  await page.getByLabel('Search events, artists, venues, promoters').fill('beat')
  await expect(page.getByRole('link', { name: /Beatpatrol/ })).toHaveAttribute('href', new RegExp(`events/${TONIGHT_ID}$`))
  await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Promoters' })).toBeVisible()
})

test('venues are grouped by city with their type and events', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.tables.venues = [
    { id: 'v1', name: 'Flex', city: 'Wien', country_code: 'AT', venue_type: 'club', status: 'approved', events: [{ count: 12 }] },
    { id: 'v2', name: 'Arena', city: 'Wien', country_code: 'AT', venue_type: 'club', status: 'approved', events: [{ count: 3 }] },
    { id: 'v3', name: 'Warehouse', city: 'St. Pölten', country_code: 'AT', venue_type: 'warehouse', status: 'approved', events: [{ count: 9 }] },
  ]
  await page.goto('discover/venues')
  await expect(page.getByRole('heading', { name: 'Wien · 2' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Flex Club ·\s?12 events/ })).toHaveAttribute('href', /venues\/v1$/)
  await page.getByLabel('Filter').fill('ware')
  await expect(page.getByRole('heading', { name: 'Wien · 2' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Warehouse/ })).toBeVisible()
})

test('the calendar shows a year without sideways scrolling, and only years with events', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-08T12:00:00Z'))
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_profile_stats = {
    headline: { events: 2, sets: 3, artists: 2, venues: 1, cities: 1, countries: 1, promoters: 1, avg_rating: null, verified: 0 },
    genres: [], top_artists: [], top_venues: [], top_promoters: [], b2b: [],
    calendar: [{ date: '2019-05-04', events: 1 }, { date: '2024-03-02', events: 1 }],
    streaks: { longest: 1, current: 0 },
    travel_km: null,
  }
  backend.rpcResults.get_profile_map = []
  await page.goto('profile')
  const chips = page.getByRole('button', { name: /^20\d\d$/ })
  await expect(chips).toHaveText(['2026', '2024', '2019'])
  await expect(page.getByRole('img', { name: '1 event in 2024' })).toBeVisible()
  const overflow = await page.locator('main').evaluate((main) => main.scrollWidth - main.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('your imported history shows up in the friends feed with its event date', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_public_feed = []
  backend.rpcResults.get_friends_feed = [{
    id: 'h1', created_at: '2026-11-06T00:00:00Z', imported: true, feed_time: '2024-10-26T11:00:00Z',
    rating: null, rating_sound: null, rating_crowd: null, rating_location: null, rating_lineup: null, text: null, verified: false,
    user: { id: memberProfile.id, username: 'e2e_raver', display_name: 'E2E Raver', avatar_path: null },
    event: { id: TONIGHT_ID, name: 'Beatpatrol', date_start: '2024-10-26', date_end: null, status: 'approved', venue_name: 'VAZ', venue_city: 'St. Pölten' },
    reactions: { bassface: 0, dance: 0, fire: 0, mine: null }, companions: [], photos: [], sets: [],
  }]
  await page.goto('./')
  const card = page.getByRole('article')
  await expect(card).toContainText('E2E Raver was at Beatpatrol')
  await expect(card).toContainText('History · Oct 26, 2024')
})
