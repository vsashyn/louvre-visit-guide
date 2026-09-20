import type { Item } from './content'

/**
 * Lowercase and strip combining marks so `recamier` finds Récamier.
 *
 * Under NFD this also decomposes Cyrillic й and ї into и and і plus a mark, so
 * those pairs become interchangeable in search. That is a slight over-match and
 * a deliberate one: it buys typo tolerance and costs nothing, because both the
 * query and the haystack go through the same function.
 */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Fields searched, in descending order of how much a hit is worth. */
function haystack(item: Item): string[] {
  return [item.title, item.titleEN, item.titleFR ?? '', item.artist ?? '']
}

function score(item: Item, q: string): number {
  const fields = haystack(item).map(norm)
  let best = 0
  for (const [i, f] of fields.entries()) {
    if (!f) continue
    const weight = [100, 80, 60, 50][i] ?? 40
    if (f.startsWith(q)) best = Math.max(best, weight + 10)
    else if (f.includes(q)) best = Math.max(best, weight)
    // Match a later word in the field, so "milo" finds "Venus de Milo".
    else if (f.split(/\s+/).some((w) => w.startsWith(q))) best = Math.max(best, weight - 5)
  }
  return best
}

/** Ranked flat results. Walking order breaks ties so the list stays stable. */
export function search(items: Item[], query: string): Item[] {
  const q = norm(query)
  if (!q) return items
  return items
    .map((item) => ({ item, s: score(item, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.item.order - b.item.order)
    .map((r) => r.item)
}
