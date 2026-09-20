import { useMemo } from 'react'
import { createFileRoute, useLoaderData, useNavigate, useParams } from '@tanstack/react-router'
import type { Item } from '@/lib/content'
import { isLang, type Lang } from '@/lib/lang'
import { search } from '@/lib/search'
import { t } from '@/lib/ui'
import { ItemRow } from '@/components/ItemRow'
import { ImageCacheCard } from '@/components/ImageCacheCard'
import { Link } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'

type IndexSearch = { q?: string }

export const Route = createFileRoute('/$lang/')({
  // The query lives in the URL so the language switch, which preserves search
  // params, carries it across without extra plumbing.
  validateSearch: (raw: Record<string, unknown>): IndexSearch => {
    const q = typeof raw.q === 'string' && raw.q.trim() ? raw.q : undefined
    return q ? { q } : {}
  },
  component: IndexPage,
})

/** Items are already in walking order, so a single pass builds the groups. */
function groupByWingLevel(items: Item[]) {
  const groups: { key: string; wing: string; level: string; items: Item[] }[] = []
  for (const item of items) {
    const { wing, level } = item.location
    const key = `${wing}|${level}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, wing, level, items: [item] })
  }
  return groups
}

function IndexPage() {
  const { lang } = useParams({ from: '/$lang/' })
  const { q } = Route.useSearch()
  const items = useLoaderData({ from: '/$lang' })
  const navigate = useNavigate({ from: '/$lang/' })
  const s = t(lang as Lang)

  const filtered = useMemo(() => (q ? search(items, q) : items), [items, q])
  const groups = useMemo(() => (q ? [] : groupByWingLevel(items)), [items, q])

  if (!isLang(lang)) return null

  const setQuery = (value: string) => {
    navigate({
      search: value.trim() ? { q: value } : {},
      replace: true, // typing should not fill the back stack
    })
  }

  return (
    <div>
      <div className="sticky top-[var(--header-total)] z-10 -mx-4 bg-background/95 px-4 pb-3 pt-1 backdrop-blur">
        <Input
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          value={q ?? ''}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s.searchPlaceholder}
          aria-label={s.searchPlaceholder}
          className="h-11 text-base"
        />
      </div>

      {!q && <ImageCacheCard items={items} lang={lang} />}

      {q ? (
        filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-medium">{s.noResults}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.noResultsHint}</p>
          </div>
        ) : (
          <>
            <p className="px-0 py-2 text-xs text-muted-foreground">{s.results(filtered.length)}</p>
            <ul>
              {filtered.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} lang={lang} />
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mb-6">
            <h2 className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.wing} · {s.level} {g.level}
            </h2>
            <ul>
              {g.items.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} lang={lang} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Link
        to="/$lang/offline"
        params={{ lang }}
        className="mt-6 flex min-h-11 items-center justify-center rounded-lg border border-border text-sm text-muted-foreground active:bg-muted hover:bg-muted/50"
      >
        {s.offlineLink}
      </Link>
    </div>
  )
}
