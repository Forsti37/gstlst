// Turns the private sheet into idempotent SQL plus a review list. Nothing here connects to a
// database: apply the output with `npx supabase db query --remote -f data/import.sql`.
//
//   node scripts/import-sheet.mjs --admin <profile uuid>   real admin profile (prod)
//   node scripts/import-sheet.mjs --dev-admin              creates a placeholder admin (dev only)
//
// Input, all in the gitignored data/ folder because the repo is public:
//   dnb events - Data.csv   Jahr, Promoter, Event, Ort, Location, Artist, Lat, Long
//   event-dates.csv         one row per event with date_start and date_end
//   import-overrides.json   optional corrections, see docs/SETUP.md
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function parseCsvLine(line) {
  const cells = []
  let quoted = false
  let cell = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else cell += ch
  }
  cells.push(cell)
  return cells.map((c) => c.trim())
}

/** Mirrors public.normalize_name in the database. */
export function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s*[&+]\s*/g, ' and ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const parseDecimalComma = (value) => {
  const number = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(number) ? null : number
}

const slugify = (value) => normalizeName(value).replace(/ /g, '-')

/** Trigram similarity as pg_trgm computes it. */
export function similarity(a, b) {
  const trigrams = (text) => {
    const set = new Set()
    for (const word of normalizeName(text).split(' ').filter(Boolean)) {
      const padded = `  ${word} `
      for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3))
    }
    return set
  }
  const x = trigrams(a)
  const y = trigrams(b)
  const shared = [...x].filter((t) => y.has(t)).length
  const union = x.size + y.size - shared
  return union === 0 ? 0 : shared / union
}

/** Stable UUID from a natural key, so that repeated imports hit the same rows. */
function stableId(kind, key) {
  const hash = createHash('sha1').update(`gstlst:${kind}:${key}`).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

const sqlText = (value) => (value === null || value === undefined || value === '' ? 'null' : `'${String(value).replaceAll("'", "''")}'`)

const DEV_ADMIN_ID = '00000000-0000-4000-a000-00000000da01'
const IS_VALID_DATE = /^\d{4}-\d{2}-\d{2}$/

function mostCommon(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

function main() {
  const args = process.argv.slice(2)
  const devAdmin = args.includes('--dev-admin')
  const adminId = devAdmin ? DEV_ADMIN_ID : args[args.indexOf('--admin') + 1]
  if (!devAdmin && (!args.includes('--admin') || !adminId)) {
    throw new Error('Pass --admin <profile uuid>, or --dev-admin for the dev project.')
  }

  const readCsv = (path) =>
    readFileSync(path, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(parseCsvLine)

  const [, ...sheetRows] = readCsv('data/dnb events - Data.csv')
  const [datesHeader, ...dateRows] = readCsv('data/event-dates.csv')
  const overrides = existsSync('data/import-overrides.json')
    ? JSON.parse(readFileSync('data/import-overrides.json', 'utf8'))
    : {}

  const dateCol = Object.fromEntries(datesHeader.map((h, i) => [h, i]))
  const eventKey = (year, event, location) => `${year}|${event}|${location}`

  const events = new Map()
  for (const r of dateRows) {
    const key = eventKey(r[dateCol.year], r[dateCol.event], r[dateCol.location])
    events.set(key, {
      key,
      year: r[dateCol.year],
      promoter: r[dateCol.promoter],
      name: r[dateCol.event],
      city: r[dateCol.city],
      location: r[dateCol.location],
      dateStart: r[dateCol.date_start],
      dateEnd: r[dateCol.date_end],
      confidence: r[dateCol.confidence],
      artists: [],
    })
  }

  const review = { missingEvents: [] }
  const venueCoords = new Map()
  for (const [year, promoter, name, city, location, artist, lat, lng] of sheetRows) {
    const key = eventKey(year, name, location)
    const event = events.get(key)
    if (!event) {
      review.missingEvents.push(key)
      continue
    }
    if (promoter !== event.promoter) event.promoter ||= promoter
    if (artist && !event.artists.includes(artist)) event.artists.push(artist)
    const venueKey = `${city}|${location}`
    const coords = `${parseDecimalComma(lat)}/${parseDecimalComma(lng)}`
    if (!venueCoords.has(venueKey)) venueCoords.set(venueKey, [])
    venueCoords.get(venueKey).push({ coords, event: key })
  }

  const invalidDates = [...events.values()].filter((e) => !IS_VALID_DATE.test(e.dateStart) || (e.dateEnd && !IS_VALID_DATE.test(e.dateEnd)))
  if (invalidDates.length > 0 || review.missingEvents.length > 0) {
    console.error('Import stopped. Events without a valid date:', invalidDates.map((e) => e.key))
    console.error('Sheet rows without an event-dates.csv row:', review.missingEvents)
    process.exit(1)
  }

  // Venues --------------------------------------------------------------------------------
  const venueInfo = overrides.venues ?? {}
  const venues = new Map()
  for (const event of events.values()) {
    const venueKey = `${event.city}|${event.location}`
    if (venues.has(venueKey)) continue
    const entries = venueCoords.get(venueKey) ?? []
    const info = venueInfo[venueKey] ?? {}
    const main = mostCommon(entries.map((e) => e.coords))
    const [lat, lng] = (main ?? 'null/null').split('/')
    venues.set(venueKey, {
      id: stableId('venue', venueKey),
      name: info.name ?? event.location,
      city: event.city,
      country: info.country ?? overrides.cityCountries?.[event.city] ?? 'AT',
      type: info.type ?? 'other',
      lat: lat === 'null' ? null : Number(lat),
      lng: lng === 'null' ? null : Number(lng),
      outliers: entries.filter((e) => e.coords !== main),
      main,
    })
  }

  // Promoters, series ---------------------------------------------------------------------
  const promoters = new Map()
  for (const event of events.values()) {
    const slug = slugify(event.promoter)
    if (!promoters.has(slug)) promoters.set(slug, { id: stableId('promoter', slug), name: event.promoter, slug })
  }

  // An event name that recurs becomes a series. The overrides map other names onto a series.
  const seriesOverride = new Map(
    Object.entries(overrides.series ?? {}).flatMap(([series, names]) => names.map((name) => [normalizeName(name), series])),
  )
  const nameCounts = new Map()
  for (const event of events.values()) {
    const n = normalizeName(event.name)
    nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1)
  }
  const series = new Map()
  for (const event of events.values()) {
    const n = normalizeName(event.name)
    const seriesName = seriesOverride.get(n) ?? (nameCounts.get(n) > 1 ? event.name : null)
    if (!seriesName) continue
    const slug = slugify(seriesName)
    if (!series.has(slug)) {
      series.set(slug, { id: stableId('series', slug), name: seriesName, slug, promoter: promoters.get(slugify(event.promoter)).id, events: [] })
    }
    series.get(slug).events.push(event)
    event.seriesId = series.get(slug).id
  }

  // Artists and sets ----------------------------------------------------------------------
  const groupMembers = overrides.groups ?? {}
  const artists = new Map()
  const addArtist = (name, kind) => {
    const slug = slugify(name)
    if (!artists.has(slug)) artists.set(slug, { id: stableId('artist', slug), name, slug, kind, spellings: new Set([name]) })
    artists.get(slug).spellings.add(name)
    return artists.get(slug)
  }

  const b2bByEvent = new Map()
  // "row" names a single sheet row that holds the whole B2B, such as "Mevo & Final Phase".
  const replacedRows = new Set()
  for (const { event, row, artists: names } of overrides.b2b ?? []) {
    if (!b2bByEvent.has(event)) b2bByEvent.set(event, [])
    b2bByEvent.get(event).push(names)
    if (row) replacedRows.add(`${event}|${normalizeName(row)}`)
  }

  const sets = []
  for (const event of events.values()) {
    const b2bs = b2bByEvent.get(event.key) ?? []
    const inB2b = new Set(b2bs.flat().map(normalizeName))
    for (const names of b2bs) {
      sets.push({
        id: stableId('set', `${event.key}|${names.join('+')}`),
        event,
        type: names.length === 3 ? 'b2b2b' : 'b2b',
        artists: names.map((name) => addArtist(name, 'person')),
      })
    }
    for (const name of event.artists) {
      if (inB2b.has(normalizeName(name)) || replacedRows.has(`${event.key}|${normalizeName(name)}`)) continue
      const looksLikeGroup = / & /.test(name) || Boolean(groupMembers[name])
      sets.push({
        id: stableId('set', `${event.key}|${name}`),
        event,
        type: 'solo',
        artists: [addArtist(name, looksLikeGroup ? 'group' : 'person')],
      })
    }
  }

  const memberships = []
  for (const [group, members] of Object.entries(groupMembers)) {
    const groupArtist = artists.get(slugify(group))
    if (!groupArtist) continue
    for (const member of members) memberships.push([groupArtist.id, addArtist(member, 'person').id])
  }

  // SQL -----------------------------------------------------------------------------------
  const out = ['begin;']
  const insert = (table, columns, rows, conflict = 'on conflict do nothing') => {
    if (rows.length === 0) return
    out.push(`insert into public.${table} (${columns}) values\n  ${rows.map((r) => `(${r})`).join(',\n  ')}\n${conflict};`)
  }

  if (devAdmin) {
    out.push(`-- Placeholder admin for the dev project. Google login arrives in phase 2.
insert into auth.users (id, email, aud, role) values ('${DEV_ADMIN_ID}', 'dev-admin@gstlst.invalid', 'authenticated', 'authenticated') on conflict do nothing;
insert into public.profiles (id, username, display_name, birth_year, role) values ('${DEV_ADMIN_ID}', 'dev_admin', 'Dev Admin', 2000, 'admin') on conflict do nothing;`)
  }

  const admin = sqlText(adminId)
  insert('venues', 'id, name, city, country_code, lat, lng, venue_type, status, created_by',
    [...venues.values()].map((v) => `'${v.id}', ${sqlText(v.name)}, ${sqlText(v.city)}, '${v.country}', ${v.lat ?? 'null'}, ${v.lng ?? 'null'}, '${v.type}', 'approved', ${admin}`))
  insert('promoters', 'id, name, slug, status, created_by',
    [...promoters.values()].map((p) => `'${p.id}', ${sqlText(p.name)}, ${sqlText(p.slug)}, 'approved', ${admin}`))
  insert('event_series', 'id, name, slug, default_promoter_id, status, created_by',
    [...series.values()].map((s) => `'${s.id}', ${sqlText(s.name)}, ${sqlText(s.slug)}, '${s.promoter}', 'approved', ${admin}`))

  for (const e of events.values()) e.id = stableId('event', e.key)
  insert('events', 'id, series_id, name, date_start, date_end, venue_id, status, created_by',
    [...events.values()].map((e) =>
      `'${e.id}', ${e.seriesId ? `'${e.seriesId}'` : 'null'}, ${sqlText(e.name)}, '${e.dateStart}', ${e.dateEnd ? `'${e.dateEnd}'` : 'null'}, '${venues.get(`${e.city}|${e.location}`).id}', 'approved', ${admin}`))
  insert('event_promoters', 'event_id, promoter_id',
    [...events.values()].map((e) => `'${e.id}', '${promoters.get(slugify(e.promoter)).id}'`))

  insert('artists', 'id, name, slug, kind, status, created_by',
    [...artists.values()].map((a) => `'${a.id}', ${sqlText(a.name)}, ${sqlText(a.slug)}, '${a.kind}', 'approved', ${admin}`))
  insert('artist_members', 'group_id, member_id', memberships.map(([g, m]) => `'${g}', '${m}'`))
  insert('sets', 'id, event_id, set_type, status, created_by',
    sets.map((s) => `'${s.id}', '${s.event.id}', '${s.type}', 'approved', ${admin}`))
  insert('set_artists', 'set_id, artist_id, role',
    sets.flatMap((s) => s.artists.map((a) => `'${s.id}', '${a.id}', 'dj'`)))

  // The user's history: imported check-ins carry no ratings and count as unverified.
  for (const e of events.values()) e.checkinId = stableId('checkin', `${adminId}|${e.key}`)
  insert('event_checkins', 'id, user_id, event_id, imported, client_uuid',
    [...events.values()].map((e) => `'${e.checkinId}', ${admin}, '${e.id}', true, '${stableId('client', `${adminId}|${e.key}`)}'`))
  insert('set_checkins', 'id, event_checkin_id, set_id, imported',
    sets.map((s) => `'${stableId('setcheckin', `${adminId}|${s.id}`)}', '${s.event.checkinId}', '${s.id}', true`))
  out.push('commit;\n')
  writeFileSync('data/import.sql', out.join('\n\n'))

  // Review list ---------------------------------------------------------------------------
  const lines = ['# Import review', '', `${events.size} events, ${sets.length} sets, ${artists.size} artists, ${venues.size} venues, ${promoters.size} promoters, ${series.size} series.`, '']
  const section = (title, items, empty = 'None.') => {
    lines.push(`## ${title}`, '', ...(items.length ? items.map((i) => `- ${i}`) : [empty]), '')
  }

  section('Venues with differing coordinates (the most common pair is used)',
    [...venues.values()].flatMap((v) => v.outliers.map((o) => `${v.name}, ${v.city}: using ${v.main}, but ${o.event} has ${o.coords}`)))

  const byCoords = new Map()
  for (const v of venues.values()) {
    if (!byCoords.has(v.main)) byCoords.set(v.main, [])
    byCoords.get(v.main).push(`${v.name}, ${v.city}`)
  }
  section('Different venues sharing coordinates',
    [...byCoords.entries()].filter(([coords, names]) => names.length > 1 && !overrides.sharedCoordinatesOk?.includes(coords)).map(([coords, names]) => `${coords}: ${names.join(' / ')}`))

  section('Events without artists', [...events.values()].filter((e) => sets.every((s) => s.event !== e)).map((e) => `${e.dateStart} ${e.name} (${e.location})`))

  section('Names with "&": imported as one group, decide duo vs. B2B',
    [...artists.values()].filter((a) => / & /.test(a.name) && !groupMembers[a.name]).map((a) => a.name))

  const similarPairs = (label, names) => {
    const unique = [...new Set(names)]
    const pairs = []
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const score = similarity(unique[i], unique[j])
        const confirmedDistinct = overrides.distinctNames?.some((pair) => pair.includes(unique[i]) && pair.includes(unique[j]))
        if (score > 0.6 && !confirmedDistinct) pairs.push(`${label}: ${unique[i]} / ${unique[j]} (${score.toFixed(2)})`)
      }
    }
    return pairs
  }
  section('Similar names (trigram > 0.6)', [
    ...similarPairs('Artist', [...artists.values()].map((a) => a.name)),
    ...similarPairs('Venue', [...venues.values()].map((v) => v.name)),
    ...similarPairs('Promoter', [...promoters.values()].map((p) => p.name)),
    ...similarPairs('Event', [...events.values()].map((e) => e.name)),
  ])

  section('Series', [...series.values()].map((s) => `${s.name}: ${s.events.map((e) => e.dateStart).join(', ')}`))
  section('Dates not confirmed yet', [...events.values()].filter((e) => e.confidence !== 'high').map((e) => `${e.dateStart} ${e.name} (${e.location})`))
  section('Artists without a country or genre', [`All ${artists.size}: artist countries and default genres aren't in the sheet.`])
  writeFileSync('data/import-review.md', lines.join('\n'))

  console.log(`Wrote data/import.sql and data/import-review.md: ${events.size} events, ${sets.length} sets, ${artists.size} artists, ${venues.size} venues.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
