import { describe, expect, it } from 'vitest'
import { normalizeSlug } from '../../lib/slug'
import { emptyEventDraft, eventCheckinActions, newSetActions, newSetDraft, setCheckinActions } from './draft'

const USER = 'user-1'

describe('eventCheckinActions', () => {
  it('uses the check-in id as client_uuid and writes no server-only fields', () => {
    const [first] = eventCheckinActions(USER, 'event-1', 'checkin-1', emptyEventDraft(), null)
    expect(first).toMatchObject({ kind: 'insert', table: 'event_checkins', onConflict: 'id' })
    const row = (first as { row: Record<string, unknown> }).row
    expect(row.client_uuid).toBe('checkin-1')
    for (const field of ['verified_gps', 'verified_admin', 'imported']) expect(row).not.toHaveProperty(field)
  })

  it('keeps coordinates out of every row and only hands them to the GPS check, last', () => {
    const position = { lat: 48.2, lng: 16.3, capturedAt: '2025-06-08T02:30:00Z' }
    const actions = eventCheckinActions(USER, 'event-1', 'checkin-1', emptyEventDraft(), position)
    expect(actions.at(-1)).toEqual({ kind: 'gps', checkinId: 'checkin-1', ...position })
    for (const action of actions.slice(0, -1)) {
      expect(JSON.stringify(action)).not.toContain('48.2')
    }
  })

  it('writes spending to the private table only', () => {
    const actions = eventCheckinActions(USER, 'event-1', 'checkin-1', { ...emptyEventDraft(), ticketPrice: 25 }, null)
    const spending = actions.find((a) => a.kind === 'replace')
    expect(spending).toMatchObject({ table: 'private_checkin_data', row: { ticket_price: 25 } })
    expect(JSON.stringify(actions[0])).not.toContain('ticket_price')
  })

  it('leaves visibility empty so that the check-in follows the settings', () => {
    const [first] = eventCheckinActions(USER, 'event-1', 'checkin-1', emptyEventDraft(), null)
    expect((first as { row: Record<string, unknown> }).row.visibility).toBeNull()
  })
})

describe('setCheckinActions', () => {
  it('refuses a set without a rating', () => {
    expect(() => setCheckinActions(USER, 'checkin-1', newSetDraft('set-1', []))).toThrow()
  })

  it('accepts a rating of zero', () => {
    expect(setCheckinActions(USER, 'checkin-1', { ...newSetDraft('set-1', []), rating: 0 })).toHaveLength(1)
  })

  it('writes tags and genres after the set check-in they point to', () => {
    const draft = { ...newSetDraft('set-1', ['g1']), rating: 4.5, tagIds: ['t1'] }
    const tables = setCheckinActions(USER, 'checkin-1', draft).map((a) => (a as { table: string }).table)
    expect(tables).toEqual(['set_checkins', 'set_checkin_tags', 'set_checkin_genres'])
  })

  it('uploads a photo into the user folder before its media row, with no status from the client', () => {
    const draft = { ...newSetDraft('set-1', []), rating: 4, photo: new Blob(['x']) }
    const [, upload, media] = setCheckinActions(USER, 'checkin-1', draft)
    expect(upload).toMatchObject({ kind: 'upload' })
    expect((upload as { path: string }).path.startsWith(`${USER}/`)).toBe(true)
    expect(media).toMatchObject({ table: 'media' })
    expect((media as { row: Record<string, unknown> }).row).not.toHaveProperty('moderation_status')
  })
})

describe('newSetActions', () => {
  it('creates new artists first, as pending by leaving the status out', () => {
    const actions = newSetActions(USER, 'event-1', {
      id: 'set-1',
      type: 'b2b',
      artists: [{ id: 'a1', name: 'Fred V', isNew: true }, { id: 'a2', name: 'Etherwood', isNew: false }],
      mcs: [{ id: 'a3', name: 'MC Flow', isNew: true }],
      floorId: null,
      newFloor: null,
    })
    const tables = actions.map((a) => (a as { table: string }).table)
    expect(tables).toEqual(['artists', 'artists', 'sets', 'set_artists', 'set_artists', 'set_artists'])
    expect((actions[0] as { row: Record<string, unknown> }).row).not.toHaveProperty('status')
    expect((actions.at(-1) as { row: Record<string, unknown> }).row.role).toBe('mc')
  })

  it('creates a new floor before the set that uses it', () => {
    const actions = newSetActions(USER, 'event-1', {
      id: 'set-1',
      type: 'solo',
      artists: [{ id: 'a1', name: 'Bea', isNew: false }],
      mcs: [],
      floorId: null,
      newFloor: { id: 'f1', name: 'Main' },
    })
    expect((actions[0] as { table: string }).table).toBe('floors')
    expect((actions[1] as { row: Record<string, unknown> }).row.floor_id).toBe('f1')
  })
})

describe('normalizeSlug', () => {
  it('builds slugs like the import does', () => {
    expect(normalizeSlug('Camo & Krooked')).toBe('camo-and-krooked')
    expect(normalizeSlug('A.M.C.')).toBe('amc')
    expect(normalizeSlug('Brückenträume')).toBe('bruckentraume')
  })
})
