#!/usr/bin/env node
/**
 * Turn assets/ and uk/assets/ into public/content.{lang}.json.
 *
 * Runs on the Mac, never ships. The app reads the JSON and never parses
 * Markdown at runtime.
 *
 * This script is deliberately strict. It is the only thing standing between a
 * content typo and a broken page in a gallery with no signal, so anything it
 * does not understand is a build failure, not a warning.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareImages } from './images.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'public')

const SOURCES = {
  en: join(ROOT, 'assets'),
  uk: join(ROOT, 'uk', 'assets'),
}

/** Section headings map to a stable kind. Map by text, never by position:
 *  `Practical` appears in only 13 of 78 files, so indexes differ per item. */
const HEADING_KIND = {
  en: {
    'In one line': 'inOneLine',
    'What you are looking at': 'whatYouAreLookingAt',
    'The story': 'story',
    'Look for': 'lookFor',
    'Interesting facts': 'facts',
    Practical: 'practical',
    'Talking point': 'talkingPoint',
  },
  uk: {
    'Одним рядком': 'inOneLine',
    'Що ви бачите': 'whatYouAreLookingAt',
    Історія: 'story',
    Знайдіть: 'lookFor',
    'Цікаві факти': 'facts',
    Практичне: 'practical',
    'Тема для розмови': 'talkingPoint',
  },
}

const CANONICAL_ORDER = [
  'inOneLine',
  'whatYouAreLookingAt',
  'story',
  'lookFor',
  'facts',
  'practical',
  'talkingPoint',
]

/** The route guide has its own heading table, same rule: map by text. */
const ROUTE_HEADING_KIND = {
  en: {
    Entrance: 'entrance',
    'Shape of the day': 'shape',
    'If you are ahead of schedule': 'ahead',
    'If you are running out of steam': 'tired',
    Practical: 'practical',
    Sources: 'sources',
  },
  uk: {
    Вхід: 'entrance',
    'Розклад дня': 'shape',
    'Якщо ви випереджаєте графік': 'ahead',
    'Якщо сили закінчуються': 'tired',
    Практичне: 'practical',
    Джерела: 'sources',
  },
}

const ROUTE_ORDER = ['entrance', 'shape', 'ahead', 'tired', 'practical', 'sources']

/** Present on every item in both languages. Everything else may be null.
 *  `room` is not here on purpose: the Pyramid sits in the Cour Napoléon and
 *  has no room number. */
const REQUIRED_FIELDS = [
  'id',
  'title',
  'department',
  'wing',
  'level',
  'category',
  'tags',
  'time_needed',
  'crowd',
  'image',
  'image_source',
  'image_license',
]

/** Walking order, computed from the English files and copied to Ukrainian by
 *  id so both languages sort identically. Matches assets/INDEX.md. */
const WING_ORDER = [
  ['Denon', 'Entresol'],
  ['Denon', '0'],
  ['Denon', '0 to 1'],
  ['Denon', '1'],
  ['Sully', '-1'],
  ['Sully', '0'],
  ['Sully', '1'],
  ['Sully', '2'],
  ['Richelieu', '-1'],
  ['Richelieu', '0'],
  ['Richelieu', '1'],
  ['Richelieu', '2'],
  ['Cour Napoléon', '0'],
]

const problems = []
function fail(file, rule, detail) {
  problems.push(`${file}\n    ${rule}: ${detail}`)
}

// ---------------------------------------------------------------- frontmatter

/**
 * A deliberately tiny YAML subset. The content uses exactly four value shapes,
 * `bare`, `"quoted"`, `[a, b]` and `null`, so anything else is a typo we want
 * to hear about rather than silently coerce.
 */
function parseFrontmatter(raw, file) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
  if (!m) {
    fail(file, 'frontmatter', 'no --- block at the top of the file')
    return [null, '']
  }
  const data = {}
  for (const [i, line] of m[1].split('\n').entries()) {
    if (!line.trim()) continue
    const idx = line.indexOf(':')
    if (idx === -1 || line.startsWith(' ')) {
      fail(file, 'frontmatter', `line ${i + 1} is not "key: value": ${line}`)
      continue
    }
    const key = line.slice(0, idx).trim()
    const rest = line.slice(idx + 1).trim()
    if (rest === 'null' || rest === '') data[key] = null
    else if (rest.startsWith('[') && rest.endsWith(']')) {
      data[key] = rest
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (rest.startsWith('"') && rest.endsWith('"')) data[key] = rest.slice(1, -1)
    else data[key] = rest
  }
  return [data, m[2]]
}

// ---------------------------------------------------------------------- body

/**
 * Split the body into a locator line plus sections of blocks.
 * No inline markup exists anywhere in the content, verified across all 156
 * files, so block text is plain text and needs no inline parser.
 */
function parseBody(body, kinds, file) {
  const lines = body.split('\n')

  let locator = ''
  const sections = []
  let current = null
  let para = []
  let bullets = []

  const flush = () => {
    if (para.length) {
      const text = para.join(' ').trim()
      if (current) current.blocks.push({ type: 'paragraph', text })
      else if (!locator) locator = text
      para = []
    }
    if (bullets.length) {
      if (current) current.blocks.push({ type: 'bullets', items: [...bullets] })
      bullets = []
    }
  }

  for (const line of lines) {
    const t = line.trimEnd()

    if (t.startsWith('# ')) {
      flush()
      continue // the h1 duplicates frontmatter title
    }
    if (t.startsWith('## ')) {
      flush()
      const heading = t.slice(3).trim()
      const kind = kinds[heading]
      if (!kind) {
        fail(file, 'unknown heading', `"${heading}" is not in the table for this file`)
        current = null
        continue
      }
      current = { kind, heading, blocks: [] }
      sections.push(current)
      continue
    }
    if (t.startsWith('### ')) {
      flush()
      if (current) current.blocks.push({ type: 'subheading', text: t.slice(4).trim() })
      continue
    }
    if (t.startsWith('- ')) {
      if (para.length) flush()
      bullets.push(t.slice(2).trim())
      continue
    }
    if (!t.trim()) {
      flush()
      continue
    }
    if (bullets.length) flush()
    para.push(t.trim())
  }
  flush()

  return { locator, sections }
}

// ------------------------------------------------------------------ per item

function readLang(lang) {
  const dir = SOURCES[lang]
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
    .sort()

  const items = []
  for (const f of files) {
    const file = `${lang}:${f}`
    const raw = readFileSync(join(dir, f), 'utf8')
    const [fm, body] = parseFrontmatter(raw, file)
    if (!fm) continue

    const stem = f.replace(/\.md$/, '')
    if (fm.id !== stem) fail(file, 'id mismatch', `id "${fm.id}" does not match filename`)
    for (const key of REQUIRED_FIELDS) {
      if (fm[key] === undefined || fm[key] === null) fail(file, 'missing field', key)
    }

    const { locator, sections } = parseBody(body, HEADING_KIND[lang], file)

    const order = sections.map((s) => s.kind)
    const expected = CANONICAL_ORDER.filter((k) => order.includes(k))
    if (order.join(',') !== expected.join(',')) {
      fail(file, 'section order', `${order.join(', ')}`)
    }

    items.push({
      id: stem,
      lang,
      title: fm.title,
      titleEN: lang === 'en' ? fm.title : fm.title_en,
      titleFR: fm.title_fr ?? null,
      artist: fm.artist ?? null,
      artistDates: fm.artist_dates ?? null,
      date: fm.date ?? null,
      medium: fm.medium ?? null,
      dimensions: fm.dimensions ?? null,
      inventory: fm.inventory ?? null,
      location: {
        department: fm.department,
        wing: fm.wing,
        level: String(fm.level),
        room: fm.room === null ? null : String(fm.room),
        gallery: fm.gallery ?? null,
      },
      category: fm.category,
      tags: fm.tags ?? [],
      timeNeeded: fm.time_needed,
      crowd: fm.crowd,
      /* Replaced below by the record the app ships, or by null when the
       * licence gate drops the image. */
      image: {
        remote: fm.image,
        source: fm.image_source,
        license: fm.image_license,
      },
      locator,
      sections,
    })
  }
  return items
}

// --------------------------------------------------------------------- build

const byLang = {}
for (const lang of Object.keys(SOURCES)) byLang[lang] = readLang(lang)

// Ids must match across languages, or the language switch breaks.
const enIds = new Set(byLang.en.map((i) => i.id))
const ukIds = new Set(byLang.uk.map((i) => i.id))
for (const id of enIds) if (!ukIds.has(id)) fail(`uk:${id}.md`, 'missing translation', id)
for (const id of ukIds) if (!enIds.has(id)) fail(`en:${id}.md`, 'missing original', id)

// Walking order from the English set, applied to both.
const rank = new Map()
for (const item of byLang.en) {
  const wi = WING_ORDER.findIndex(
    ([w, l]) => w === item.location.wing && l === item.location.level,
  )
  const roomNum = /^(\d+)/.exec(item.location.room ?? '')
  // Tie-break on id, not title: Ukrainian titles sort differently, which would
  // give the two languages a different intra-room order and desync prev/next
  // across the language switch. id also matches assets/INDEX.md.
  // Then the room string, so a work in room 346 precedes one spanning 346-348.
  rank.set(item.id, [
    wi === -1 ? 99 : wi,
    roomNum ? Number(roomNum[1]) : 9999,
    item.location.room ?? '',
    item.id,
  ])
  if (wi === -1) {
    fail(`en:${item.id}.md`, 'unknown wing/level', `${item.location.wing} / ${item.location.level}`)
  }
}
const sortKey = (id) => rank.get(id) ?? [99, 9999, '', id]
for (const lang of Object.keys(byLang)) {
  byLang[lang].sort((a, b) => {
    const ka = sortKey(a.id)
    const kb = sortKey(b.id)
    if (ka[0] !== kb[0]) return ka[0] - kb[0]
    if (ka[1] !== kb[1]) return ka[1] - kb[1]
    for (const i of [2, 3]) {
      if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1
    }
    return 0
  })
  byLang[lang].forEach((item, i) => {
    item.order = i
  })
}

if (problems.length) {
  console.error(`\nContent build failed, ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

// Images are shared by both languages, so they are resolved once from the
// English set and the record is copied across by id. Downloads are cached
// outside the repo, so this is disk-only after the first run.
const { images, notes } = await prepareImages(byLang.en, join(OUT, 'images'), {
  offline: process.env.LOUVRE_OFFLINE === '1',
})
for (const note of notes) console.log(`  ${note}`)
for (const items of Object.values(byLang)) {
  for (const item of items) item.image = images.get(item.id) ?? null
}

mkdirSync(OUT, { recursive: true })
for (const [lang, items] of Object.entries(byLang)) {
  const path = join(OUT, `content.${lang}.json`)
  writeFileSync(path, JSON.stringify(items))
  const kb = (Buffer.byteLength(JSON.stringify(items)) / 1024).toFixed(0)
  console.log(`  content.${lang}.json  ${items.length} items  ${kb} KB`)
}

// ---------------------------------------------------------------- route guide

/**
 * The route frontmatter needs one shape the item files never use: a list of
 * maps. This handles exactly that, two levels deep, and refuses anything else
 * rather than guessing.
 */
function parseScalar(raw) {
  const v = raw.trim()
  if (v === '' || v === 'null') return null
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1)
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  }
  if (/^-?\d+$/.test(v)) return Number(v)
  return v
}

function parseRouteFrontmatter(raw, file) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
  if (!m) {
    fail(file, 'frontmatter', 'no --- block at the top of the file')
    return [null, '']
  }
  const data = {}
  let list = null // the list currently being filled
  let entry = null // the map currently being filled
  let nested = null // key on `entry` whose value is a block list

  for (const [i, line] of m[1].split('\n').entries()) {
    if (!line.trim()) continue
    const indent = line.length - line.trimStart().length
    const text = line.trim()
    const where = `line ${i + 1}`

    if (indent === 0) {
      const idx = text.indexOf(':')
      if (idx === -1) {
        fail(file, 'frontmatter', `${where} is not "key: value": ${text}`)
        continue
      }
      const key = text.slice(0, idx).trim()
      const rest = text.slice(idx + 1).trim()
      list = entry = nested = null
      if (rest === '') {
        list = data[key] = []
      } else {
        data[key] = parseScalar(rest)
      }
      continue
    }

    if (indent === 2 && text.startsWith('- ')) {
      if (!list) {
        fail(file, 'frontmatter', `${where} starts a list item outside a list`)
        continue
      }
      entry = {}
      nested = null
      list.push(entry)
      const rest = text.slice(2)
      const idx = rest.indexOf(':')
      if (idx === -1) {
        fail(file, 'frontmatter', `${where} is not "key: value": ${rest}`)
        continue
      }
      entry[rest.slice(0, idx).trim()] = parseScalar(rest.slice(idx + 1))
      continue
    }

    if (indent === 4 && entry) {
      const idx = text.indexOf(':')
      if (idx === -1) {
        fail(file, 'frontmatter', `${where} is not "key: value": ${text}`)
        continue
      }
      const key = text.slice(0, idx).trim()
      const rest = text.slice(idx + 1).trim()
      if (rest === '') {
        nested = key
        entry[key] = []
      } else {
        nested = null
        entry[key] = parseScalar(rest)
      }
      continue
    }

    if (indent === 6 && text.startsWith('- ') && entry && nested) {
      entry[nested].push(parseScalar(text.slice(2)))
      continue
    }

    fail(file, 'frontmatter', `${where} is indented ${indent}, which this parser does not read: ${text}`)
  }
  return [data, m[2]]
}

function readRoute(lang, ids) {
  const file = `content/route.${lang}.md`
  const path = join(ROOT, 'content', `route.${lang}.md`)
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    fail(file, 'missing file', 'the route page has nothing to render without it')
    return null
  }

  const [fm, body] = parseRouteFrontmatter(raw, file)
  if (!fm) return null
  for (const key of ['title', 'lead', 'stops']) {
    if (fm[key] === undefined || fm[key] === null) fail(file, 'missing field', key)
  }

  const { sections } = parseBody(body, ROUTE_HEADING_KIND[lang], file)
  const order = sections.map((s) => s.kind)
  const expected = ROUTE_ORDER.filter((k) => order.includes(k))
  if (order.join(',') !== expected.join(',')) fail(file, 'section order', order.join(', '))

  const clean = (rows, what) =>
    (rows ?? []).map((row, i) => {
      const items = row.items ?? []
      // Every id on the route must be a real item, or the stop links nowhere.
      for (const id of items) {
        if (!ids.has(id)) fail(file, 'unknown item', `${what} ${i + 1} points at "${id}"`)
      }
      return {
        clock: row.clock ?? null,
        room: row.room ?? null,
        minutes: typeof row.minutes === 'number' ? row.minutes : null,
        label: row.label ?? null,
        note: row.note ?? null,
        items,
      }
    })

  return {
    lang,
    title: fm.title,
    lead: fm.lead,
    stops: clean(fm.stops, 'stop'),
    detours: clean(fm.detours, 'detour'),
    sections,
  }
}

const routes = {}
for (const lang of Object.keys(SOURCES)) routes[lang] = readRoute(lang, enIds)

// The two languages must describe the same walk, or the switch on /visit lands
// you on a different day out.
if (routes.en && routes.uk) {
  const shape = (r) => ({
    stops: r.stops.map((s) => [s.clock, s.minutes, s.items.join('+')].join('|')),
    detours: r.detours.map((s) => s.items.join('+')),
  })
  const a = shape(routes.en)
  const b = shape(routes.uk)
  if (a.stops.join(' / ') !== b.stops.join(' / ')) {
    fail('content/route.uk.md', 'route mismatch', 'stops differ from the English route')
  }
  if (a.detours.join(' / ') !== b.detours.join(' / ')) {
    fail('content/route.uk.md', 'route mismatch', 'detours differ from the English route')
  }
}

if (problems.length) {
  console.error(`\nRoute build failed, ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

for (const [lang, route] of Object.entries(routes)) {
  const json = JSON.stringify(route)
  writeFileSync(join(OUT, `route.${lang}.json`), json)
  console.log(
    `  route.${lang}.json  ${route.stops.length} stops  ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB`,
  )
}
console.log('Content build ok.')
