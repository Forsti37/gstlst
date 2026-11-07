import { genreFamily } from './api'

const genres = [
  { id: 'electronic', parent_id: null },
  { id: 'dnb', parent_id: 'electronic' },
  { id: 'neuro', parent_id: 'dnb' },
  { id: 'liquid', parent_id: 'dnb' },
  { id: 'techno', parent_id: 'electronic' },
  { id: 'bounce', parent_id: 'techno' },
]

describe('genreFamily', () => {
  it('includes a genre and everything below it', () => {
    expect([...genreFamily('dnb', genres)].sort()).toEqual(['dnb', 'liquid', 'neuro'])
  })

  it('is just the genre for a leaf', () => {
    expect([...genreFamily('bounce', genres)]).toEqual(['bounce'])
  })
})
