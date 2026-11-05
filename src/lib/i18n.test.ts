import { describe, expect, it } from 'vitest'
import de from '../locales/de.json'
import en from '../locales/en.json'

function keysOf(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null ? keysOf(child as object, `${prefix}${key}.`) : [`${prefix}${key}`],
  )
}

describe('translations', () => {
  it('has the same keys in English and German', () => {
    expect(keysOf(de).sort()).toEqual(keysOf(en).sort())
  })
})
