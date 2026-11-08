import { expect, test, type Page } from '@playwright/test'
import { memberProfile, mockBackend, SET_ID, TONIGHT_ID } from './mock-backend'

async function checkInToTonight(page: Page, rating: string) {
  await page.goto('check-in')
  await page.getByRole('link', { name: /Tonight Rave/ }).click()
  await page.getByRole('button', { name: 'I was here' }).click()
  await page.getByRole('button', { name: /Bea/ }).click()
  await page.getByRole('button', { name: 'Rate 1 set' }).click()
  await page.getByRole('slider', { name: 'Rating for Bea' }).fill(rating)
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('Checked in')).toBeVisible()
}

const tablesOf = (writes: { table: string }[]) => writes.map((write) => write.table)

test('a check-in saves the event, then the rated set', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  await checkInToTonight(page, '4.5')
  await expect.poll(() => tablesOf(state.writes)).toEqual(['event_checkins', 'set_checkins', 'set_checkin_genres'])

  const [checkin, setCheckin, genre] = state.writes.map((write) => write.body as Record<string, unknown>)
  expect(checkin).toMatchObject({ event_id: TONIGHT_ID, user_id: memberProfile.id })
  expect(checkin).not.toHaveProperty('verified_gps')
  expect(checkin!.client_uuid).toBe(checkin!.id)
  expect(setCheckin).toMatchObject({ set_id: SET_ID, rating: 4.5, event_checkin_id: checkin!.id })
  expect(genre).toMatchObject({ genre_id: 'genre-neuro' }) // prefilled from the artist
  expect(state.writes[0]!.url).toContain('on_conflict=id')
})

test('a set cannot be saved without a rating', async ({ page }) => {
  await mockBackend(page, { signedIn: true, profile: memberProfile })
  await page.goto(`check-in/${TONIGHT_ID}`)
  await page.getByRole('button', { name: 'I was here' }).click()
  await page.getByRole('button', { name: /Bea/ }).click()
  await page.getByRole('button', { name: 'Rate 1 set' }).click()
  await expect(page.getByRole('button', { name: '1 set still needs a rating' })).toBeDisabled()
  await page.getByRole('slider', { name: 'Rating for Bea' }).fill('0')
  await expect(page.getByRole('button', { name: 'Done' })).toBeEnabled()
})

test('an event can be checked in without any sets', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  await page.goto(`check-in/${TONIGHT_ID}`)
  await page.getByRole('button', { name: 'I was here' }).click()
  await page.getByRole('button', { name: 'Finish without sets' }).click()
  await expect(page.getByText('Checked in')).toBeVisible()
  await expect.poll(() => tablesOf(state.writes)).toEqual(['event_checkins'])
})

test.describe('without reception', () => {
  test('a check-in waits, survives a restart and is sent exactly once', async ({ page, context }) => {
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    // Open the app once with reception, so that tonight's event and lineup get cached.
    await page.goto('check-in')
    await expect(page.getByRole('link', { name: /Tonight Rave/ })).toBeVisible()
    await page.goto(`check-in/${TONIGHT_ID}`)
    await expect(page.getByRole('button', { name: 'I was here' })).toBeVisible()
    await page.waitForTimeout(1500) // the cache is written shortly after a change

    // The reception is gone, and the app gets restarted.
    state.offline = true
    await context.setOffline(false)
    await page.reload()
    await page.getByRole('button', { name: 'I was here' }).click()
    await page.getByRole('button', { name: /Bea/ }).click()
    await page.getByRole('button', { name: 'Rate 1 set' }).click()
    await page.getByRole('slider', { name: 'Rating for Bea' }).fill('5')
    await page.getByRole('button', { name: 'Done' }).click()

    await expect(page.getByText('Waiting to upload.')).toBeVisible()
    await expect(page.getByText('1 entry waiting to upload')).toBeVisible()
    expect(state.writes).toHaveLength(0)

    // Closed and reopened, still without reception.
    await page.reload()
    await expect(page.getByText('1 entry waiting to upload')).toBeVisible()
    expect(state.writes).toHaveLength(0)

    // Reception is back.
    state.offline = false
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect.poll(() => tablesOf(state.writes)).toEqual(['event_checkins', 'set_checkins', 'set_checkin_genres'])
    await expect(page.getByText('1 entry waiting to upload')).toBeHidden()

    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.reload()
    await page.waitForTimeout(500)
    expect(state.writes).toHaveLength(3)
  })

  test('a rejected check-in shows a decision instead of retrying forever', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    state.rejectedTables = ['set_checkins']
    await checkInToTonight(page, '3')
    await expect(page.getByText('1 entry could not be saved')).toBeVisible()
    // The set's tags depend on the rejected set check-in, so they are held back with it.
    expect(tablesOf(state.writes)).toEqual(['event_checkins'])

    state.rejectedTables = []
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText('1 entry could not be saved')).toBeHidden()
    await expect.poll(() => tablesOf(state.writes)).toEqual(['event_checkins', 'set_checkins', 'set_checkin_genres'])
  })
})

test.describe('GPS', () => {
  test('a live check-in sends coordinates only to the verification', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 48.2178, longitude: 16.3709 })
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    await checkInToTonight(page, '4')
    await expect.poll(() => state.rpcCalls.some((call) => call.name === 'verify_checkin_gps')).toBe(true)
    const gps = state.rpcCalls.find((call) => call.name === 'verify_checkin_gps')
    expect(gps).toMatchObject({ lat: 48.2178, lng: 16.3709 })
    expect(JSON.stringify(state.writes)).not.toContain('48.2178')
  })

  test('without permission the check-in still works', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    await checkInToTonight(page, '4')
    await expect.poll(() => tablesOf(state.writes)).toContain('set_checkins')
    expect(state.rpcCalls.some((call) => call.name === 'verify_checkin_gps')).toBe(false)
  })
})

test('a new event is usable right away and marked as under review', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  // The event isn't on the server yet when the flow asks for it.
  await page.route('http://127.0.0.1:54399/rest/v1/events*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({
      status: 406,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'PGRST116', message: 'no rows', details: 'The result contains 0 rows', hint: null }),
    })
  })
  await page.goto('check-in/new')
  await page.getByLabel('Event name').fill('Basement Session')
  await page.getByLabel('Venue').fill('Keller')
  await page.getByRole('button', { name: 'Add “Keller” as new' }).click()
  await page.getByLabel('City').fill('Melk')
  await page.getByRole('button', { name: 'Add and continue' }).click()

  await expect(page.getByRole('heading', { name: 'Basement Session' })).toBeVisible()
  await expect(page.getByText('Under review')).toBeVisible()
  await expect.poll(() => tablesOf(state.writes)).toEqual(['venues', 'events'])
  const [venue, event] = state.writes.map((write) => write.body as Record<string, unknown>)
  expect(venue).toMatchObject({ name: 'Keller', city: 'Melk', created_by: memberProfile.id })
  expect(venue).not.toHaveProperty('status') // pending is the default, and clients can't choose
  expect(event).toMatchObject({ name: 'Basement Session', venue_id: venue!.id })
})

test('a missing artist can be added during the check-in', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  await page.goto(`check-in/${TONIGHT_ID}`)
  await page.getByRole('button', { name: 'I was here' }).click()
  await page.getByRole('button', { name: 'Add a set' }).click()
  await page.getByRole('textbox', { name: /^Artist/ }).fill('Neue Artistin')
  await page.getByRole('button', { name: 'Add “Neue Artistin” as new' }).click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Rate 1 set' }).click()
  await page.getByRole('slider', { name: 'Rating for Neue Artistin' }).fill('3.5')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect.poll(() => tablesOf(state.writes)).toEqual(['event_checkins', 'artists', 'sets', 'set_artists', 'set_checkins'])
})

test.describe('own photos', () => {
  const pendingPhoto = { id: 'photo-1', storage_path: `${memberProfile.id}/photo.webp`, moderation_status: 'pending' }

  test('are visible to the uploader in the check-in while waiting for approval', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    state.checkins = [
      {
        id: 'checkin-1',
        user_id: memberProfile.id,
        rating: null,
        rating_sound: null,
        rating_crowd: null,
        rating_location: null,
        rating_lineup: null,
        text: null,
        visibility: null,
        verified_gps: false,
        verified_admin: false,
        imported: false,
        event: { id: TONIGHT_ID, name: 'Kellersession', date_start: '2026-11-06', date_end: null, status: 'pending', venue: null },
        set_checkins: [
          {
            id: 'set-checkin-1',
            set_id: SET_ID,
            rating: 4,
            text: null,
            imported: false,
            media: [pendingPhoto],
            set: { id: SET_ID, floor_id: null, set_type: 'solo', start_at: null, end_at: null, status: 'pending', set_artists: [{ role: 'dj', artist: { id: 'a', name: 'Bea', status: 'pending', artist_default_genres: [] } }] },
          },
        ],
      },
    ]
    await page.goto('check-ins/checkin-1/edit')
    const photo = page.getByRole('img', { name: 'Your photo' })
    await expect(photo).toBeVisible()
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    await expect(page.getByText('Photo: waiting for approval')).toBeVisible()

    page.on('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect.poll(() => state.writes.map((write) => `${write.method} ${write.table}`)).toEqual(['DELETE media'])
  })

  test('are visible to the uploader on the event page, marked as only theirs', async ({ page }) => {
    const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
    state.media = [pendingPhoto]
    await page.goto(`events/${TONIGHT_ID}`)
    const photo = page.getByRole('img', { name: 'Your photo' })
    await expect(photo).toBeVisible()
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    await expect(page.getByText('Only you, until approved')).toBeVisible()
  })
})

test('imported sets can be rated later in the history', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  const checkin = {
    id: 'checkin-1',
    user_id: memberProfile.id,
    rating: null,
    rating_sound: null,
    rating_crowd: null,
    rating_location: null,
    rating_lineup: null,
    text: null,
    visibility: null,
    verified_gps: false,
    verified_admin: false,
    imported: true,
    event: { id: TONIGHT_ID, name: 'Old Rave', date_start: '2024-05-04', date_end: null, status: 'approved', venue: null },
    set_checkins: [
      {
        id: 'set-checkin-1',
        set_id: SET_ID,
        rating: null,
        text: null,
        imported: true,
        media: [],
        set: { id: SET_ID, floor_id: null, set_type: 'solo', start_at: null, end_at: null, status: 'approved', set_artists: [{ role: 'dj', artist: { id: 'a', name: 'Subsonic', status: 'approved', artist_default_genres: [] } }] },
      },
    ],
  }
  state.checkins = [checkin]
  state.rpcResults.get_checkin_card = {
    id: checkin.id, created_at: '2026-01-01T00:00:00Z', imported: true, rating: null, rating_sound: null, rating_crowd: null, rating_location: null, rating_lineup: null,
    text: null, verified: false, reactions: { bassface: 0, dance: 0, fire: 0, mine: null }, companions: [], photos: [], sets: [],
    user: { id: memberProfile.id, username: memberProfile.username, display_name: memberProfile.display_name, avatar_path: null },
    event: { id: TONIGHT_ID, name: 'Old Rave', date_start: '2019-05-04', date_end: null, status: 'approved', venue_name: 'Flex', venue_city: 'Wien' },
  }
  await page.goto('check-ins')
  await page.getByRole('link', { name: /Old Rave/ }).click()
  // Your own check-in opens as a page, and the pencil leads to the form.
  await page.getByRole('link', { name: 'Edit check-in' }).click()
  await page.getByRole('slider', { name: 'Rating for Subsonic' }).fill('4')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await expect.poll(() => state.writes.find((write) => write.table === 'set_checkins')?.body).toEqual({ rating: 4 })
})
