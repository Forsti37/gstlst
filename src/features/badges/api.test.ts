import { levelName, nextThreshold } from './api'
import { sortFunFacts } from './FunFacts'

describe('levelName', () => {
  it('uses the name of the level and falls back to the badge', () => {
    expect(levelName({ name: 'Regular', level_names: ['Regular', 'Local', 'Part of the Furniture'] }, 3)).toBe('Part of the Furniture')
    expect(levelName({ name: 'Raver', level_names: null }, 2)).toBe('Raver')
  })
})

describe('nextThreshold', () => {
  it('finds the next level, and nothing after the last', () => {
    expect(nextThreshold({ levels: [5, 10, 25], level: 0 })).toBe(5)
    expect(nextThreshold({ levels: [5, 10, 25], level: 2 })).toBe(25)
    expect(nextThreshold({ levels: [5, 10, 25], level: 3 })).toBeNull()
  })
})

describe('sortFunFacts', () => {
  it('puts rare facts before common ones', () => {
    const sorted = sortFunFacts([
      { id: '1', kind: 'artist_seen', payload: { n: 1 } },
      { id: '2', kind: 'event_milestone', payload: { n: 50 } },
      { id: '3', kind: 'first_venue', payload: {} },
    ])
    expect(sorted.map((fact) => fact.id)).toEqual(['2', '3', '1'])
  })
})
