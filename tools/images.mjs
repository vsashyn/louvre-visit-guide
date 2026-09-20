/**
 * Images for the item pages: download, licence gate, WebP.
 *
 * Runs on the Mac as part of `npm run content`. Everything it downloads lands
 * in a cache outside the repository, so a rebuild converts from disk and
 * touches the network only for an image it has never seen.
 *
 * The licence gate is the reason this file is strict. Twenty of the 78 images
 * are under an attribution licence, which makes the credit line a condition of
 * use rather than a courtesy. Anything whose licence or author cannot be
 * resolved from Commons is dropped, and the item renders without a picture.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import sharp from 'sharp'

const CACHE =
  process.env.LOUVRE_IMAGE_CACHE ??
  join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'louvre-guide')
const SRC_DIR = join(CACHE, 'src')
const META_DIR = join(CACHE, 'meta')

/* Measured across all 78 sources: 1400px q82 is 18.6 MB, 1200px q82 is 13.4 MB
 * and 1400px q75 is 13.6 MB. The design doc offers 1200px as the lever if the
 * set runs long, but quality buys the same megabytes as resolution here, and
 * the pixels are what pinch-zoom is for. */
const LONG_EDGE = 1400
const QUALITY = 75

const UA = 'louvre-guide/0.1 (offline museum guide, personal project; Node)'

const sha = (s) => createHash('sha1').update(s).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** `https://commons.wikimedia.org/wiki/File:Foo_bar.jpg` to `File:Foo bar.jpg`. */
export function commonsTitle(sourceUrl) {
  try {
    const path = new URL(sourceUrl).pathname
    const m = /^\/wiki\/(.+)$/.exec(path)
    if (!m) return null
    const title = decodeURIComponent(m[1])
    return title.startsWith('File:') ? title : null
  } catch {
    return null
  }
}

const stripTags = (html) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Commons metadata for a batch of file titles, cached one JSON file per title.
 * Fifty titles per request is the API's limit for anonymous callers.
 */
async function fetchMetadata(titles, { offline }) {
  const out = new Map()
  const wanted = []
  for (const title of titles) {
    const path = join(META_DIR, sha(title) + '.json')
    if (existsSync(path)) out.set(title, JSON.parse(readFileSync(path, 'utf8')))
    else wanted.push(title)
  }
  if (!wanted.length) return out
  if (offline) return out

  mkdirSync(META_DIR, { recursive: true })
  for (let i = 0; i < wanted.length; i += 50) {
    const batch = wanted.slice(i, i + 50)
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2' +
      '&prop=imageinfo&iiprop=extmetadata&titles=' +
      batch.map(encodeURIComponent).join('|')
    const res = await fetch(url, { headers: { 'user-agent': UA } })
    if (!res.ok) throw new Error(`Commons API ${res.status}`)
    const json = await res.json()
    const normalised = new Map()
    for (const n of json.query?.normalized ?? []) normalised.set(n.to, n.from)
    for (const page of json.query?.pages ?? []) {
      const ex = page.imageinfo?.[0]?.extmetadata ?? {}
      const value = (k) => (ex[k]?.value ?? '').toString()
      const meta = {
        missing: !!page.missing,
        artist: value('Artist') ? stripTags(value('Artist')) : null,
        credit: value('Credit') ? stripTags(value('Credit')) : null,
        license: value('LicenseShortName') || null,
        restrictions: value('Restrictions') || null,
        attributionRequired: value('AttributionRequired') || null,
      }
      const title = normalised.get(page.title) ?? page.title
      out.set(title, meta)
      writeFileSync(join(META_DIR, sha(title) + '.json'), JSON.stringify(meta))
      if (title !== page.title) writeFileSync(join(META_DIR, sha(page.title) + '.json'), JSON.stringify(meta))
    }
    await sleep(250)
  }
  return out
}

/** Cached download. Wikimedia answers 429 in bursts, so back off and retry. */
async function download(url, { offline }) {
  const ext = (/\.(\w{3,4})(?:$|\?)/.exec(url)?.[1] ?? 'jpg').toLowerCase()
  const path = join(SRC_DIR, sha(url) + '.' + ext)
  if (existsSync(path)) return readFileSync(path)
  if (offline) return null
  mkdirSync(SRC_DIR, { recursive: true })
  let wait = 1000
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(path, buf)
      return buf
    }
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} for ${url}`)
    await sleep(wait)
    wait *= 2
  }
  throw new Error(`gave up after four attempts on ${url}`)
}

/**
 * Decide per image. Doubt means no image, and a dropped image is not a build
 * failure; the item renders without one because the text was always the point.
 */
function gate(item, meta) {
  const stated = item.image.license ?? ''
  const free = /^(public domain|cc0)/i.test(stated)
  if (!meta || meta.missing) {
    return free
      ? { ok: true, author: null, note: 'no Commons metadata, licence taken from the frontmatter' }
      : { ok: false, why: 'licence could not be resolved on Commons' }
  }
  if (meta.restrictions) return { ok: false, why: `usage restriction: ${meta.restrictions}` }
  if (free) return { ok: true, author: meta.artist }
  if (!meta.artist) return { ok: false, why: 'attribution licence with no author named on Commons' }
  return { ok: true, author: meta.artist }
}

/**
 * Returns a map of id to the image record the app ships, or null for a dropped
 * image, plus a list of human-readable notes for the build log.
 */
export async function prepareImages(items, outDir, { offline = false } = {}) {
  const notes = []
  const dropped = []
  const titles = items.map((i) => commonsTitle(i.image.source)).filter(Boolean)
  const meta = await fetchMetadata(titles, { offline })

  mkdirSync(outDir, { recursive: true })
  const result = new Map()
  let bytes = 0

  for (const item of items) {
    const title = commonsTitle(item.image.source)
    const verdict = gate(item, title ? meta.get(title) : null)
    if (!verdict.ok) {
      dropped.push(`${item.id}: ${verdict.why}`)
      result.set(item.id, null)
      continue
    }

    const out = join(outDir, `${item.id}.webp`)
    let buf
    if (existsSync(out)) {
      buf = readFileSync(out)
    } else {
      const src = await download(item.image.remote, { offline })
      if (!src) {
        dropped.push(`${item.id}: not downloaded and no cache, run with a network connection`)
        result.set(item.id, null)
        continue
      }
      buf = await sharp(src)
        .rotate()
        .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()
      writeFileSync(out, buf)
    }
    const dims = await sharp(buf).metadata()
    bytes += buf.length
    result.set(item.id, {
      src: `images/${item.id}.webp`,
      width: dims.width,
      height: dims.height,
      /* So the download card can tell a visitor what they are agreeing to
       * before it starts pulling 14 MB over museum wifi. */
      bytes: buf.length,
      source: item.image.source,
      license: item.image.license,
      /* Mandatory wherever the image appears for the twenty under an
       * attribution licence, and printed for the rest because it costs
       * nothing. */
      author: verdict.author ?? null,
    })
    if (verdict.note) notes.push(`${item.id}: ${verdict.note}`)
  }

  // A dropped image must not be left sitting in public/ from an earlier build.
  // Shipping the bytes is the thing the licence gate exists to prevent, and
  // nobody would notice a file the JSON no longer points at.
  const keep = new Set([...result.entries()].filter(([, v]) => v).map(([id]) => `${id}.webp`))
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.webp') && !keep.has(f)) {
      rmSync(join(outDir, f))
      notes.push(`removed public/images/${f}, no longer shipped`)
    }
  }

  const shipped = [...result.values()].filter(Boolean).length
  notes.unshift(
    `images: ${shipped} shipped, ${dropped.length} dropped, ${(bytes / 1024 / 1024).toFixed(1)} MB total`,
  )
  for (const d of dropped) notes.push(`dropped ${d}`)
  return { images: result, notes }
}
