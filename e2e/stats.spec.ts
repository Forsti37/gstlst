import { expect, test } from '@playwright/test'
import { memberProfile, mockBackend, OTHER_ID } from './mock-backend'

const row = (key: string, label: string, sets: number, events: number) => ({ key, label, sets, events, avg_rating: 4.5 })

const profileStats = {
  headline: { events: 78, sets: 253, artists: 120, venues: 30, cities: 12, countries: 4, promoters: 20, avg_rating: 4.25, verified: 3 },
  genres: [row('g1', 'Drum & Bass', 200, 70)],
  top_artists: [row('a1', 'Bea', 12, 9)],
  top_venues: [row('v1', 'Flex', 40, 25)],
  top_promoters: [row('p1', 'Beatpatrol', 30, 10)],
  b2b: [{ label: 'Bea & Cid', sets: 3 }],
  calendar: [{ date: '2024-03-02', events: 1 }],
  streaks: { longest: 5, current: 2 },
  travel_km: 12340,
}

test('the profile shows the numbers and links into them', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_profile_stats = profileStats
  backend.rpcResults.get_profile_map = []
  await page.goto('profile')

  await expect(page.getByText('253')).toBeVisible()
  await expect(page.getByText('Km travelled')).toBeVisible()
  await expect(page.getByRole('link', { name: /Bea 12/ })).toHaveAttribute('href', /artists\/a1$/)
  await expect(page.getByRole('link', { name: /Flex 25/ })).toHaveAttribute('href', /venues\/v1$/)
  await expect(page.getByRole('img', { name: '1 event in 2024' })).toBeVisible()
})

test('the owner learns why the travel distance is missing', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_profile_stats = { ...profileStats, travel_km: null, travel_missing: 'checkins' }
  await page.goto('profile')
  await expect(page.getByText('Your travel distance appears from 10 check-ins.')).toBeVisible()
  await expect(page.getByText('Km travelled')).toHaveCount(0)
})

test('the map loads only on request', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_profile_stats = profileStats
  backend.rpcResults.get_profile_map = [{ venue_id: 'v1', name: 'Flex', city: 'Wien', lat: 48.2, lng: 16.3, events: 25 }]
  const tiles: string[] = []
  await page.route('https://tiles.openfreemap.org/**', (route) => {
    tiles.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [] }) })
  })
  await page.goto('profile')

  const show = page.getByRole('button', { name: 'Show map' })
  await expect(show).toBeVisible()
  expect(tiles).toEqual([])
  await show.click()
  await expect(show).toHaveCount(0)
  // Headless browsers may lack WebGL, and then the page says so instead of breaking.
  await expect(page.getByTestId('venue-map').or(page.getByText("The map can't be shown on this device."))).toBeVisible()
})

test('another profile hides stats the viewer may not see', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_profile_stats = null
  backend.rpcResults.compare_with = null
  await page.goto('u/lisa')
  await expect(page.getByRole('heading', { name: 'Lisa' })).toBeVisible()
  await expect(page.getByText('These stats are not visible to you.')).toBeVisible()
  await expect(page.getByText('Taste match')).toHaveCount(0)
})

test('a friend profile compares your taste', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.get_profile_stats = profileStats
  backend.rpcResults.get_profile_map = []
  backend.rpcResults.compare_with = {
    events_together: 4,
    sets_together: 7,
    taste_match: 83,
    shared_artists: [{ id: 'a1', name: 'Bea', mine: 3, theirs: 2 }],
  }
  await page.goto('u/lisa')
  await expect(page.getByText('83%')).toBeVisible()
  await expect(page.getByText('Sets together')).toBeVisible()
  expect(backend.rpcCalls.some((call) => call.name === 'compare_with' && call.target_user === OTHER_ID)).toBe(true)
})

test('the explorer asks for a whitelisted grouping and shows chart and table', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.explore_stats = [row('6', '6', 10, 8), row('5', '5', 4, 3)]
  await page.goto(`explore/${memberProfile.id}`)

  await page.getByLabel('Group by').selectOption('weekday')
  await expect(page.getByRole('cell', { name: 'Saturday' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chart' })).toBeVisible()
  const friday = await page.getByRole('cell', { name: 'Friday' }).boundingBox()
  const saturday = await page.getByRole('cell', { name: 'Saturday' }).boundingBox()
  expect(friday!.y).toBeLessThan(saturday!.y)
  expect(backend.rpcCalls.some((call) => call.name === 'explore_stats' && call.dimension === 'weekday')).toBe(true)

  await page.getByLabel('Filter by').selectOption('year')
  await page.getByLabel('Value').selectOption('6')
  await expect.poll(() => backend.rpcCalls.some((call) => JSON.stringify(call.filters) === '{"year":"6"}')).toBe(true)
  await page.getByRole('button', { name: 'Remove filter 6' }).click()
  await expect(page.getByRole('button', { name: 'Remove filter 6' })).toHaveCount(0)
})

test('the leaderboard sorts by the chosen number', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.rpcResults.friends_leaderboard = [
    { user_id: memberProfile.id, username: 'e2e_raver', display_name: 'E2E Raver', avatar_path: null, events: 5, sets: 2, artists: 1 },
    { user_id: OTHER_ID, username: 'lisa', display_name: 'Lisa', avatar_path: null, events: 3, sets: 9, artists: 4 },
  ]
  await page.goto('leaderboard')
  await expect(page.getByRole('listitem').first()).toContainText('E2E Raver')
  await page.getByRole('button', { name: 'Sets' }).click()
  await expect(page.getByRole('listitem').first()).toContainText('Lisa')
})

test('the artist page shows your numbers, the app, friends, upcoming gigs and check-ins', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.tables.artists = [{ id: 'a1', name: 'Bea', status: 'approved', kind: 'person', country_code: 'AT', instagram_url: null }]
  backend.rpcResults.get_artist_stats = {
    checkins: 12,
    avg_rating: 4.5,
    my_sets: 3,
    my_avg_rating: 4,
    aliases: ['B.E.A.'],
    members: [],
    groups: [{ id: 'g1', name: 'Bea & Cid' }],
    genres: ['Neurofunk'],
    partners: [{ id: 'a2', name: 'Cid', sets: 2 }],
    top_fans: [{ username: 'lisa', display_name: 'Lisa', avatar_path: null, sets: 9 }],
  }
  backend.rpcResults.get_entity_personal = {
    count: 3, avg_rating: 4, last: { event_id: 'e1', name: 'Beatpatrol', date_start: '2025-10-25' },
    friends: [{ username: 'max', display_name: 'Max', avatar_path: null, times: 2 }],
  }
  backend.rpcResults.get_entity_upcoming = [{ id: 'e9', name: 'Soon Rave', date_start: '2026-12-12', date_end: null, status: 'approved', venue_name: 'Flex', venue_city: 'Wien' }]
  backend.rpcResults.get_entity_checkins = []
  await page.goto('artists/a1')
  await expect(page.getByRole('heading', { name: 'Bea' })).toBeVisible()
  await expect(page.getByText('Times seen')).toBeVisible()
  await expect(page.getByRole('link', { name: /Last time: Beatpatrol/ })).toHaveAttribute('href', /events\/e1$/)
  await expect(page.getByRole('link', { name: /Soon Rave/ })).toBeVisible()
  await page.getByRole('button', { name: 'Going' }).click()
  await expect.poll(() => backend.writes.find((write) => write.table === 'going')?.body).toMatchObject({ event_id: 'e9' })
  await expect(page.getByRole('link', { name: /Max.*2× seen/ })).toBeVisible()
  await expect(page.getByText('No check-ins yet.')).toBeVisible()
  // Upcoming gigs sit right under the header, your own numbers follow.
  const upcomingY = (await page.getByRole('heading', { name: 'Coming up' }).boundingBox())!.y
  const youY = (await page.getByRole('heading', { name: 'You', exact: true }).boundingBox())!.y
  expect(upcomingY).toBeLessThan(youY)
  await expect(page.getByText('Also known as B.E.A.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Bea & Cid' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Lisa/ })).toHaveAttribute('href', /u\/lisa$/)
})

test('the venue page shows ratings, resident and rank', async ({ page }) => {
  const backend = await mockBackend(page, { signedIn: true, profile: memberProfile })
  backend.tables.venues = [{ id: 'v1', name: 'Flex', city: 'Wien', country_code: 'AT', lat: 48.2, lng: 16.3, status: 'approved' }]
  backend.rpcResults.get_venue_stats = {
    checkins: 9,
    my_events: 2,
    averages: { overall: 4.5, sound: 4.8, crowd: null, location: null, lineup: null },
    sound_rank: 1,
    top_artists: [{ id: 'a1', name: 'Bea', sets: 5 }],
    resident: { username: 'lisa', display_name: 'Lisa', avatar_path: null, checkins: 7 },
  }
  backend.rpcResults.get_entity_personal = { count: 2, avg_rating: 4.5, last: null, friends: [] }
  backend.rpcResults.get_entity_upcoming = []
  backend.rpcResults.get_entity_checkins = []
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [] }) }))
  await page.goto('venues/v1')
  await expect(page.getByRole('heading', { name: 'Flex' })).toBeVisible()
  await expect(page.getByText('Visits')).toBeVisible()
  // The map shows right away, without a button.
  await expect(page.getByRole('button', { name: 'Show map' })).toHaveCount(0)
  await expect(page.getByTestId('venue-map').or(page.getByText("The map can't be shown on this device."))).toBeVisible()
  await expect(page.getByRole('link', { name: '#1 for best sound' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Lisa/ })).toBeVisible()
  await expect(page.getByText('Crowd')).toHaveCount(0)
})
