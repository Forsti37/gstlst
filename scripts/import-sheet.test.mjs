import { describe, expect, it } from 'vitest'
import { normalizeName, parseCsvLine, parseDecimalComma, similarity } from './import-sheet.mjs'

describe('import helpers', () => {
  it('reads quoted cells with a decimal comma', () => {
    const cells = parseCsvLine('2023,FYS,Beatpatrol,Wien,Marx Halle,Koven,"48,1878","16,4045"')
    expect(cells).toHaveLength(8)
    expect(parseDecimalComma(cells[6])).toBeCloseTo(48.1878)
    expect(parseDecimalComma(cells[7])).toBeCloseTo(16.4045)
  })

  it('treats an empty coordinate as missing', () => {
    expect(parseDecimalComma('')).toBeNull()
  })

  it('normalizes names like the database does', () => {
    expect(normalizeName('A.M.C.')).toBe('amc')
    expect(normalizeName('Camo & Krooked')).toBe('camo and krooked')
    expect(normalizeName('Sacré Coeur')).toBe('sacre coeur')
    expect(normalizeName('[Ivy]')).toBe('ivy')
  })

  it('scores spelling variants higher than different names', () => {
    expect(similarity('Excalibur Mefjus', 'Excalibur Mefjus')).toBe(1)
    expect(similarity('Kaira', 'Kayra')).toBeLessThan(1)
    expect(similarity('Kaira', 'Dossa')).toBe(0)
  })
})
