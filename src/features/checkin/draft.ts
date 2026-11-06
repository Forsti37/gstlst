import type { Position } from '../../lib/geo'
import { normalizeSlug } from '../../lib/slug'
import { insert, type QueuedAction } from '../offline/actions'
import type { SetType, Visibility } from './api'

export interface PickedEntity {
  id: string
  name: string
  isNew: boolean
}

export interface NewSet {
  id: string
  type: SetType
  artists: PickedEntity[]
  mcs: PickedEntity[]
  floorId: string | null
  newFloor: { id: string; name: string } | null
}

export interface SetDraft {
  setId: string
  setCheckinId: string
  rating: number | null
  text: string
  tagIds: string[]
  genreIds: string[]
  photo: Blob | null
}

export interface EventCheckinDraft {
  rating: number | null
  ratingSound: number | null
  ratingCrowd: number | null
  ratingLocation: number | null
  ratingLineup: number | null
  text: string
  visibility: Visibility | null
  companionIds: string[]
  ticketPrice: number | null
  otherSpend: number | null
}

export const emptyEventDraft = (): EventCheckinDraft => ({
  rating: null,
  ratingSound: null,
  ratingCrowd: null,
  ratingLocation: null,
  ratingLineup: null,
  text: '',
  visibility: null,
  companionIds: [],
  ticketPrice: null,
  otherSpend: null,
})

export const newSetDraft = (setId: string, genreIds: string[]): SetDraft => ({
  setId,
  setCheckinId: crypto.randomUUID(),
  rating: null,
  text: '',
  tagIds: [],
  genreIds,
  photo: null,
})

export function artistActions(userId: string, artist: PickedEntity): QueuedAction[] {
  if (!artist.isNew) return []
  return [insert('artists', { id: artist.id, name: artist.name, slug: normalizeSlug(artist.name), created_by: userId })]
}

/** A set the user added. Pending, but usable by them right away. */
export function newSetActions(userId: string, eventId: string, set: NewSet): QueuedAction[] {
  const people = [...set.artists, ...set.mcs]
  return [
    ...people.flatMap((artist) => artistActions(userId, artist)),
    ...(set.newFloor ? [insert('floors', { id: set.newFloor.id, event_id: eventId, name: set.newFloor.name, created_by: userId })] : []),
    insert('sets', {
      id: set.id,
      event_id: eventId,
      floor_id: set.newFloor?.id ?? set.floorId,
      set_type: set.type,
      created_by: userId,
    }),
    ...set.artists.map((artist) =>
      insert('set_artists', { set_id: set.id, artist_id: artist.id, role: set.type === 'live' ? 'live' : 'dj' }, 'set_id,artist_id,role'),
    ),
    ...set.mcs.map((artist) => insert('set_artists', { set_id: set.id, artist_id: artist.id, role: 'mc' }, 'set_id,artist_id,role')),
  ]
}

/** Everything a set check-in writes. Rating is required: imported history is the only exception. */
export function setCheckinActions(userId: string, checkinId: string, draft: SetDraft): QueuedAction[] {
  if (draft.rating === null) throw new Error('A set check-in needs a rating')
  const actions: QueuedAction[] = [
    insert('set_checkins', {
      id: draft.setCheckinId,
      event_checkin_id: checkinId,
      set_id: draft.setId,
      rating: draft.rating,
      text: draft.text.trim() || null,
    }),
    ...draft.tagIds.map((tagId) => insert('set_checkin_tags', { set_checkin_id: draft.setCheckinId, tag_id: tagId }, 'set_checkin_id,tag_id')),
    ...draft.genreIds.map((genreId) => insert('set_checkin_genres', { set_checkin_id: draft.setCheckinId, genre_id: genreId }, 'set_checkin_id,genre_id')),
  ]
  if (draft.photo) {
    const path = `${userId}/${crypto.randomUUID()}.webp`
    actions.push({ kind: 'upload', path, blob: draft.photo })
    actions.push(
      insert('media', {
        id: crypto.randomUUID(),
        owner_id: userId,
        event_checkin_id: checkinId,
        set_checkin_id: draft.setCheckinId,
        storage_path: path,
      }),
    )
  }
  return actions
}

export function eventCheckinActions(
  userId: string,
  eventId: string,
  checkinId: string,
  draft: EventCheckinDraft,
  position: Position | null,
): QueuedAction[] {
  const actions: QueuedAction[] = [
    insert('event_checkins', {
      id: checkinId,
      user_id: userId,
      event_id: eventId,
      rating: draft.rating,
      rating_sound: draft.ratingSound,
      rating_crowd: draft.ratingCrowd,
      rating_location: draft.ratingLocation,
      rating_lineup: draft.ratingLineup,
      text: draft.text.trim() || null,
      visibility: draft.visibility,
      client_uuid: checkinId,
    }),
    ...draft.companionIds.map((friendId) =>
      insert('checkin_companions', { event_checkin_id: checkinId, user_id: friendId }, 'event_checkin_id,user_id'),
    ),
  ]
  if (draft.ticketPrice !== null || draft.otherSpend !== null) {
    actions.push({
      kind: 'replace',
      table: 'private_checkin_data',
      row: { event_checkin_id: checkinId, ticket_price: draft.ticketPrice, other_spend: draft.otherSpend },
      onConflict: 'event_checkin_id',
    })
  }
  if (position) {
    actions.push({ kind: 'gps', checkinId, lat: position.lat, lng: position.lng, capturedAt: position.capturedAt })
  }
  return actions
}
