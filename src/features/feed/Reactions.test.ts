import { describe, expect, it } from 'vitest'
import { applyReaction, reactionAction } from './Reactions'

const empty = { bassface: 0, dance: 0, fire: 0, mine: null }

describe('applyReaction', () => {
  it('adds a first reaction', () => {
    expect(applyReaction(empty, 'fire')).toEqual({ bassface: 0, dance: 0, fire: 1, mine: 'fire' })
  })

  it('moves a reaction when another one is tapped: one per user', () => {
    const before = { bassface: 2, dance: 0, fire: 1, mine: 'fire' as const }
    expect(applyReaction(before, 'bassface')).toEqual({ bassface: 3, dance: 0, fire: 0, mine: 'bassface' })
  })

  it('removes a reaction when it is tapped again', () => {
    const before = { bassface: 0, dance: 1, fire: 0, mine: 'dance' as const }
    expect(applyReaction(before, 'dance')).toEqual(empty)
  })
})

describe('reactionAction', () => {
  it('sets through the function, so that only the kind can change', () => {
    expect(reactionAction('u', 'set_checkin', 's', null, 'fire')).toEqual({ kind: 'rpc', fn: 'set_reaction', args: { target: 'set_checkin', target_id: 's', kind: 'fire' } })
  })

  it('deletes when the current one is tapped', () => {
    expect(reactionAction('u', 'event_checkin', 'e', 'fire', 'fire')).toMatchObject({ kind: 'delete', table: 'reactions', match: { user_id: 'u', target_id: 'e' } })
  })
})
