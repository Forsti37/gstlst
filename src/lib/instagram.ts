const HANDLE = '[A-Za-z0-9._]{1,30}'
const FROM_URL = new RegExp(`^(?:https?://)?(?:www\\.|m\\.)?instagram\\.com/(${HANDLE})/?(?:[?#].*)?$`, 'i')
const FROM_HANDLE = new RegExp(`^@?(${HANDLE})$`)

/**
 * Turns a profile link or an @handle into the one form the database accepts.
 * Empty input means "no link" (''), anything else unreadable is null.
 */
export function toInstagramUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return ''
  const handle = FROM_URL.exec(value)?.[1] ?? FROM_HANDLE.exec(value)?.[1]
  return handle ? `https://www.instagram.com/${handle}/` : null
}

export function instagramHandle(url: string) {
  return `@${url.replace(/^https:\/\/www\.instagram\.com\//, '').replace(/\/$/, '')}`
}
