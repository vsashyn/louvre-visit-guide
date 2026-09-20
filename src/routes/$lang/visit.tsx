import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { byId, type Item } from '@/lib/content'
import { loadContent } from '@/lib/content'
import { isLang, type Lang } from '@/lib/lang'
import { loadRoute, resolveStopItems, type RouteStop } from '@/lib/route'
import { t } from '@/lib/ui'
import { Blocks } from '@/components/Blocks'

export const Route = createFileRoute('/$lang/visit')({
  loader: async ({ params }) => {
    if (!isLang(params.lang)) throw notFound()
    const [items, route] = await Promise.all([loadContent(params.lang), loadRoute(params.lang)])
    return { route, byId: byId(items) }
  },
  component: VisitPage,
})

/** Works at a stop, as tappable rows rather than a run of inline links. This
 *  page is read standing up, in a crowd, with one hand. */
function StopItems({ items, lang }: { items: Item[]; lang: Lang }) {
  if (!items.length) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to="/$lang/item/$id"
            params={{ lang, id: item.id }}
            className="flex min-h-11 items-center rounded-full border border-border px-3 text-sm active:bg-muted hover:bg-muted/50"
          >
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function StopRow({
  stop,
  lang,
  items,
}: {
  stop: RouteStop
  lang: Lang
  items: Item[]
}) {
  const s = t(lang)
  return (
    <li className="flex gap-3 border-t border-border py-4 first:border-t-0">
      {stop.clock && (
        <span className="w-12 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
          {stop.clock}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium leading-snug">{stop.label}</p>
          {stop.minutes ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {s.minutesShort(stop.minutes)}
            </span>
          ) : null}
        </div>
        {stop.room && <p className="mt-0.5 text-sm text-muted-foreground">{stop.room}</p>}
        <StopItems items={items} lang={lang} />
        {stop.note && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stop.note}</p>}
      </div>
    </li>
  )
}

function VisitPage() {
  const { route, byId: index } = Route.useLoaderData()
  const lang = route.lang

  return (
    <article className="pb-4">
      <header>
        <h1 className="text-2xl font-semibold leading-tight">{route.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{route.lead}</p>
      </header>

      {/* The table is the spine, so it comes before the prose. It is what
          anyone actually looks at mid-visit. */}
      <ul className="mt-6 border-t border-border">
        {route.stops.map((stop, i) => (
          <StopRow key={i} stop={stop} lang={lang} items={resolveStopItems(stop, index)} />
        ))}
      </ul>

      {route.sections.map((section) => (
        <section key={section.kind} className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.heading}
          </h2>
          <Blocks blocks={section.blocks} />
          {section.kind === 'ahead' && route.detours.length > 0 && (
            <ul className="mt-4 border-t border-border">
              {route.detours.map((stop, i) => (
                <StopRow key={i} stop={stop} lang={lang} items={resolveStopItems(stop, index)} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  )
}
