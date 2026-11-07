import { expect, test } from '@playwright/test'
import { memberProfile, mockBackend, SET_ID, TONIGHT_ID } from './mock-backend'

const reactions = { bassface: 0, dance: 0, fire: 0, mine: null }

const card = (id: string, name: string, patch: object = {}) => ({
  id,
  created_at: '2026-11-06T22:00:00Z',
  rating: 4.5,
  rating_sound: 5,
  rating_crowd: null,
  rating_location: null,
  rating_lineup: null,
  text: 'Was für ein Abriss',
  verified: true,
  user: { id: 'friend-1', username: 'lisa', display_name: 'Lisa', avatar_path: null },
  event: { id: TONIGHT_ID, name, date_start: '2026-11-06', date_end: null, status: 'approved', venue_name: 'Flex', venue_city: 'Wien' },
  reactions,
  companions: [],
  photos: [],
  sets: [
    {
      id: 'set-checkin-1',
      rating: 5,
      text: null,
      status: 'approved',
      set_type: 'b2b',
      set_artists: [
        { role: 'dj', artist: { id: 'a1', name: 'Fred V' } },
        { role: 'dj', artist: { id: 'a2', name: 'Etherwood' } },
      ],
      reactions,
    },
  ],
  ...patch,
})

test('the feed shows a card with its sets, ratings and pending label', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  state.rpcResults.get_friends_feed = [card('c1', 'Beatpatrol', { event: { id: TONIGHT_ID, name: 'Kellersession', date_start: '2026-11-06', date_end: null, status: 'pending', venue_name: 'Keller', venue_city: 'Melk' } })]
  state.rpcResults.get_public_feed = []
  await page.goto('./')
  const friends = page.getByRole('tabpanel', { name: 'Friends' })
  await expect(friends.getByText('Kellersession')).toBeVisible()
  await expect(friends.getByText('Under review')).toBeVisible()
  await expect(friends.getByText('Fred V b2b Etherwood')).toBeVisible()
  await expect(friends.getByText('Was für ein Abriss')).toBeVisible()
  await expect(friends.getByText('Sound 5.0')).toBeVisible()
})

test('the tabs switch between friends and public, by tap and by swipe', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  state.rpcResults.get_friends_feed = [card('c1', 'Friends Event')]
  state.rpcResults.get_public_feed = [card('c2', 'Public Event')]
  await page.goto('./')
  await expect(page.getByRole('tab', { name: 'Friends' })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'Public' }).click()
  await expect(page.getByRole('tab', { name: 'Public' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Public Event')).toBeInViewport()

  // A swipe to the right goes back to the friends.
  await page.getByRole('tabpanel', { name: 'Public' }).evaluate((panel) => {
    const touch = (x: number) => new Touch({ identifier: 1, target: panel, clientX: x, clientY: 300 })
    panel.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(60)], changedTouches: [touch(60)] }))
    panel.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [touch(300)], changedTouches: [touch(300)] }))
    panel.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(300)] }))
  })
  await expect(page.getByRole('tab', { name: 'Friends' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Friends Event')).toBeInViewport()
})

test('scrolling loads the next page with a cursor', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  state.rpcResults.get_public_feed = []
  const first = Array.from({ length: 15 }, (_, i) => card(`p1-${i}`, `Event ${i}`, { created_at: `2026-11-06T${String(22 - i).padStart(2, '0')}:00:00Z`.replace('T-', 'T0') }))
  state.rpcResults.get_friends_feed = first
  await page.goto('./')
  await expect(page.getByText('Event 0', { exact: true })).toBeVisible()
  state.rpcResults.get_friends_feed = [card('p2-0', 'Second Page')]
  await page.locator('main').evaluate((main) => main.scrollTo(0, main.scrollHeight))
  await expect(page.getByText('Second Page')).toBeVisible()
  const calls = state.rpcCalls.filter((call) => call.name === 'get_friends_feed')
  expect(calls.at(-1)!.before_time).toBe(first.at(-1)!.created_at)
})

test('a reaction answers at once, changes and goes away', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  state.rpcResults.get_friends_feed = [card('c1', 'Reaction Event')]
  state.rpcResults.get_public_feed = []
  await page.goto('./')
  const pane = page.getByRole('tabpanel', { name: 'Friends' })
  // The check-in's own reactions sit at the bottom of the card, below its sets.
  const fire = pane.getByRole('button', { name: 'Fire' }).last()
  const dance = pane.getByRole('button', { name: 'Dance' }).last()

  await fire.click()
  await expect(fire).toHaveAttribute('aria-pressed', 'true')
  await expect(fire).toContainText('1')
  await expect.poll(() => state.rpcCalls.find((call) => call.name === 'set_reaction')).toMatchObject({ target: 'event_checkin', target_id: 'c1', kind: 'fire' })

  await dance.click()
  await expect(dance).toHaveAttribute('aria-pressed', 'true')
  await expect(fire).toHaveAttribute('aria-pressed', 'false')

  await dance.click()
  await expect(dance).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => state.writes.some((write) => write.table === 'reactions' && write.method === 'DELETE')).toBe(true)
})

test('sets can be reacted to on their own, and the list of who reacted opens', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  const reacted = { ...reactions, fire: 1 }
  state.rpcResults.get_friends_feed = [card('c1', 'List Event', { reactions: reacted })]
  state.rpcResults.get_public_feed = []
  state.rpcResults.list_reactions = [{ username: 'max', display_name: 'Max', avatar_path: null, kind: 'fire' }]
  await page.goto('./')
  const pane = page.getByRole('tabpanel', { name: 'Friends' })
  await pane.getByRole('button', { name: 'Who reacted' }).click()
  await expect(pane.getByRole('link', { name: /Max/ })).toBeVisible()
  await pane.getByRole('button', { name: 'Reactions for Fred V b2b Etherwood' }).click()
  await pane.getByRole('button', { name: 'Bassface' }).first().click()
  await expect.poll(() => state.rpcCalls.find((call) => call.name === 'set_reaction')).toMatchObject({ target: 'set_checkin', target_id: 'set-checkin-1', kind: 'bassface' })
})

test('a reaction waits in the queue without reception', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  state.rpcResults.get_friends_feed = [card('c1', 'Offline Event')]
  state.rpcResults.get_public_feed = []
  await page.goto('./')
  await expect(page.getByText('Offline Event')).toBeVisible()
  state.offline = true
  const fire = page.getByRole('tabpanel', { name: 'Friends' }).getByRole('button', { name: 'Fire' }).last()
  await fire.click()
  await expect(fire).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('1 entry waiting to upload')).toBeVisible()
  state.offline = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => state.rpcCalls.some((call) => call.name === 'set_reaction')).toBe(true)
})

test('a tagged friend adopts a check-in with the sets selected, and rates them', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  state.rpcResults.tagged_checkin = { event_id: TONIGHT_ID, set_ids: [SET_ID] }
  state.tables.notifications = [
    { id: 'n1', type: 'tagged', payload: { actor: 'Lisa', event: 'Tonight Rave', event_id: TONIGHT_ID, checkin_id: 'their-checkin' }, read_at: null, updated_at: '2026-11-06T22:00:00Z' },
  ]
  await page.goto('inbox')
  await page.getByRole('link', { name: /Lisa tagged you at Tonight Rave/ }).click()
  await expect(page).toHaveURL(/adopt=their-checkin/)
  await page.getByRole('button', { name: 'I was here' }).click()
  await expect(page.getByRole('button', { name: /Bea/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Rate 1 set' }).click()
  await expect(page.getByRole('button', { name: '1 set still needs a rating' })).toBeDisabled()
  await page.getByRole('slider', { name: 'Rating for Bea' }).fill('4')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect.poll(() => state.writes.find((write) => write.table === 'checkin_companions')?.body).toEqual({ status: 'adopted' })
})

test('going can be set on an upcoming event', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  await page.goto(`events/${TONIGHT_ID}`)
  await page.getByRole('button', { name: 'I’m going' }).click()
  await expect.poll(() => state.writes.find((write) => write.table === 'going')?.body).toMatchObject({ user_id: memberProfile.id, event_id: TONIGHT_ID })
})

test('an artist can be put on the wishlist from their page', async ({ page }) => {
  const state = await mockBackend(page, { signedIn: true, profile: memberProfile })
  state.tables.artists = [{ id: 'artist-1', name: 'Bea', status: 'approved', kind: 'person', country_code: 'CZ', instagram_url: null }]
  await page.goto('artists/artist-1')
  await expect(page.getByRole('heading', { name: 'Bea' })).toBeVisible()
  await page.getByRole('button', { name: 'Want to see' }).click()
  await expect.poll(() => state.writes.find((write) => write.table === 'wishlist_artists')?.body).toMatchObject({ artist_id: 'artist-1' })
})

test.describe('notifications', () => {
  test('types and quiet hours save, with the time zone', async ({ page }) => {
    await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('settings')
    await page.getByRole('button', { name: 'Reactions' }).click()
    await expect(page.getByRole('button', { name: 'Reactions' })).toHaveAttribute('aria-pressed', 'false')
    await page.getByLabel('From').fill('23:00')
    await expect(page.getByLabel('From')).toHaveValue('23:00')
  })

  test('nothing asks for permission before the first check-in', async ({ page, context }) => {
    await context.grantPermissions([])
    await mockBackend(page, { signedIn: true, profile: memberProfile })
    await page.goto('./')
    await expect(page.getByText('Get notified?')).toBeHidden()
  })
})
