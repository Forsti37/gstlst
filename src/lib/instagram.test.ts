import { instagramHandle, toInstagramUrl } from './instagram'

describe('toInstagramUrl', () => {
  it('accepts handles and profile links in their usual shapes', () => {
    for (const input of ['dossa.dnb', '@dossa.dnb', 'instagram.com/dossa.dnb', 'https://www.instagram.com/dossa.dnb/', 'https://instagram.com/dossa.dnb?igsh=abc123', ' http://m.instagram.com/dossa.dnb ']) {
      expect(toInstagramUrl(input)).toBe('https://www.instagram.com/dossa.dnb/')
    }
  })

  it('treats empty input as removing the link', () => {
    expect(toInstagramUrl('  ')).toBe('')
  })

  it('rejects anything that is not an Instagram profile', () => {
    for (const input of ['https://evil.example/dossa', 'javascript:alert(1)', 'https://www.instagram.com/p/abc/def', 'two words', 'a'.repeat(31)]) {
      expect(toInstagramUrl(input)).toBeNull()
    }
  })
})

describe('instagramHandle', () => {
  it('shows the handle of a stored link', () => {
    expect(instagramHandle('https://www.instagram.com/dossa.dnb/')).toBe('@dossa.dnb')
  })
})
