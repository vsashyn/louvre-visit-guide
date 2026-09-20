import type { Block } from './content'
import type { Lang } from './lang'

/** The setup guide at /{lang}/offline, emitted from content/offline.{lang}.md.
 *  The first three sections are the steps and are numbered on the page. */
export type OfflineSectionKind = 'install' | 'pictures' | 'check' | 'inside'

export const OFFLINE_STEPS: readonly OfflineSectionKind[] = ['install', 'pictures', 'check']

export interface OfflineSection {
  kind: OfflineSectionKind
  heading: string
  blocks: Block[]
}

export interface OfflineGuide {
  lang: Lang
  title: string
  lead: string
  sections: OfflineSection[]
}

const cache = new Map<Lang, Promise<OfflineGuide>>()

export function loadOfflineGuide(lang: Lang): Promise<OfflineGuide> {
  let p = cache.get(lang)
  if (!p) {
    p = fetch(`/offline.${lang}.json`).then((r) => {
      if (!r.ok) throw new Error(`offline.${lang}.json is not available (${r.status})`)
      return r.json() as Promise<OfflineGuide>
    })
    cache.set(lang, p)
  }
  return p
}
