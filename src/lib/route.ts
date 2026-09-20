import type { Block, Item } from './content'
import type { Lang } from './lang'

/**
 * The shape emitted by tools/build-content.mjs from content/route.{lang}.md.
 * The build refuses to emit a stop whose `items` do not all resolve, so every
 * id in here has a page.
 */
export type RouteSectionKind = 'entrance' | 'shape' | 'ahead' | 'tired' | 'practical' | 'sources'

export interface RouteSection {
  kind: RouteSectionKind
  heading: string
  blocks: Block[]
}

export interface RouteStop {
  /** Null on a detour, which has no place in the clock. */
  clock: string | null
  room: string | null
  minutes: number | null
  label: string | null
  note: string | null
  items: string[]
}

export interface RouteGuide {
  lang: Lang
  title: string
  lead: string
  stops: RouteStop[]
  detours: RouteStop[]
  sections: RouteSection[]
}

const cache = new Map<Lang, Promise<RouteGuide>>()

export function loadRoute(lang: Lang): Promise<RouteGuide> {
  let p = cache.get(lang)
  if (!p) {
    p = fetch(`/route.${lang}.json`).then((r) => {
      if (!r.ok) throw new Error(`route.${lang}.json is not available (${r.status})`)
      return r.json() as Promise<RouteGuide>
    })
    cache.set(lang, p)
  }
  return p
}

export function resolveStopItems(stop: RouteStop, byId: Map<string, Item>): Item[] {
  return stop.items.map((id) => byId.get(id)).filter((i): i is Item => !!i)
}
