import { hashOf, posterLayers } from './poster'

describe('posterLayers', () => {
  it('gives an event the same look every time', () => {
    expect(posterLayers('event-1')).toBe(posterLayers('event-1'))
  })

  it('gives different events different looks', () => {
    expect(posterLayers('event-1')).not.toBe(posterLayers('event-2'))
  })

  it('uses only the brand colors', () => {
    const layers = posterLayers('event-1')
    expect(layers).toContain('var(--gst-red)')
    expect(layers).toContain('var(--gst-blue)')
    expect(layers).not.toMatch(/#[0-9a-f]{3,6}/i)
  })

  it('hashes to an unsigned number', () => {
    expect(hashOf('x')).toBeGreaterThanOrEqual(0)
  })
})
