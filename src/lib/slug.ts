/** Mirrors public.normalize_name, with dashes. The database adds a suffix to taken slugs. */
export function normalizeSlug(name: string) {
  const slug = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s*[&+]\s*/g, ' and ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
  return slug || crypto.randomUUID().slice(0, 8)
}
