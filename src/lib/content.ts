import type { Lang } from './lang'

/**
 * The shape emitted by tools/build-content.mjs.
 *
 * These types and that script are two halves of one contract. Change one and
 * change the other. The pipeline builds these objects literally, so the shape
 * is guaranteed by construction; what is not guaranteed is that this file still
 * describes it.
 */

export type SectionKind =
  | 'inOneLine'
  | 'whatYouAreLookingAt'
  | 'story'
  | 'lookFor'
  | 'facts'
  | 'practical'
  | 'talkingPoint'

/** Canonical order. The pipeline refuses to emit an item that deviates. */
export const SECTION_ORDER: readonly SectionKind[] = [
  'inOneLine',
  'whatYouAreLookingAt',
  'story',
  'lookFor',
  'facts',
  'practical',
  'talkingPoint',
]

export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'subheading'; text: string }

export interface Section {
  kind: SectionKind
  heading: string
  blocks: Block[]
}

export interface Location {
  department: string
  wing: string
  /** A string, not a number: one level is the word "Entresol". */
  level: string
  /** Null for the Pyramid, which sits in the Cour Napoléon. */
  room: string | null
  gallery: string | null
}

export interface ItemImage {
  /** Relative to the site root, e.g. `images/mona-lisa.webp`. */
  src: string
  width: number
  height: number
  /** Size of the WebP on disk, summed by the download card. */
  bytes: number
  /** The Commons page that names the photographer. */
  source: string
  license: string
  /**
   * Mandatory in the credit line for the twenty images under an attribution
   * licence, printed for the rest because it costs nothing. Null only when
   * Commons names nobody and the licence does not require it.
   */
  author: string | null
}

export interface Item {
  id: string
  lang: Lang
  title: string
  /** Carried in both languages so search can match a Latin query on /uk/. */
  titleEN: string
  titleFR: string | null
  artist: string | null
  artistDates: string | null
  date: string | null
  medium: string | null
  dimensions: string | null
  inventory: string | null
  location: Location
  category: 'painting' | 'sculpture' | 'object' | 'interior' | 'architecture'
  tags: string[]
  timeNeeded: string
  crowd: 'very low' | 'low' | 'medium' | 'high' | 'extreme'
  /** Null when the licence gate dropped the image. The page renders without
   *  one, because the text was always the point. */
  image: ItemImage | null
  /** The line under the title: artist, date, wing, level, room. */
  locator: string
  /** Position in walking order, contiguous from 0, identical across languages. */
  order: number
  sections: Section[]
}

const cache = new Map<Lang, Promise<Item[]>>()

/**
 * Loaded once per language and held for the session. The service worker serves
 * these from cache with no network fallback, so a failure here means the
 * download step never completed, not that the network is slow.
 */
export function loadContent(lang: Lang): Promise<Item[]> {
  let p = cache.get(lang)
  if (!p) {
    p = fetch(`/content.${lang}.json`).then((r) => {
      if (!r.ok) throw new Error(`content.${lang}.json is not available (${r.status})`)
      return r.json() as Promise<Item[]>
    })
    cache.set(lang, p)
  }
  return p
}

export function byId(items: Item[]): Map<string, Item> {
  return new Map(items.map((i) => [i.id, i]))
}
