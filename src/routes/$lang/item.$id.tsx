import { Link, createFileRoute, notFound, useParams } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import type { Block, Item, Section } from '@/lib/content'
import { loadContent } from '@/lib/content'
import { isLang, type Lang } from '@/lib/lang'
import { t, type Strings } from '@/lib/ui'
import { Badge } from '@/components/ui/badge'
import { HeroImage } from '@/components/HeroImage'
import { Blocks } from '@/components/Blocks'

export const Route = createFileRoute('/$lang/item/$id')({
  // `loadContent` hands back the promise the $lang loader already holds, so
  // this resolves without a second fetch. Resolving the id here rather than in
  // the component is what turns an unknown id into a real 404 instead of a
  // crash, and it gives prev/next somewhere to come from.
  loader: async ({ params }) => {
    if (!isLang(params.lang)) throw notFound()
    const items = await loadContent(params.lang)
    const at = items.findIndex((i) => i.id === params.id)
    const item = items[at]
    if (!item) throw notFound()
    // The array is emitted in walking order, so neighbours are neighbours.
    return { item, prev: items[at - 1] ?? null, next: items[at + 1] ?? null }
  },
  component: ItemPage,
  notFoundComponent: ItemNotFound,
})

/**
 * `Look for` is the one section read with your eyes going up and down between
 * the page and the wall, so each bullet gets a row of its own with a rule
 * between. Losing your place here costs more than the vertical space does.
 */
function LookFor({ blocks }: { blocks: Block[] }) {
  const bullets = blocks.flatMap((b) => (b.type === 'bullets' ? b.items : []))
  const rest = blocks.filter((b) => b.type !== 'bullets')
  return (
    <>
      {rest.length > 0 && <Blocks blocks={rest} />}
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
        {bullets.map((text, i) => (
          <li key={i} className="flex gap-3 px-4 py-4 leading-relaxed">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function SectionView({ section }: { section: Section }) {
  const { kind, heading, blocks } = section

  let body
  if (kind === 'lookFor') body = <LookFor blocks={blocks} />
  else if (kind === 'practical')
    body = (
      <div className="mt-3 rounded-lg bg-muted px-4 py-3">
        <Blocks blocks={blocks} />
      </div>
    )
  else if (kind === 'talkingPoint')
    body = (
      <div className="mt-3 border-l-2 border-input pl-4">
        <Blocks blocks={blocks} />
      </div>
    )
  else body = <Blocks blocks={blocks} lead={kind === 'inOneLine'} />

  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h2>
      {body}
    </section>
  )
}

function ReferenceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

/** Reference, not reading. Closed by default and never in the way. */
function Reference({ item, s }: { item: Item; s: Strings }) {
  return (
    <details className="group mt-10 rounded-lg border border-border">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {s.details}
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <dl className="border-t border-border px-4 py-2 text-sm">
        {item.medium && <ReferenceRow label={s.medium}>{item.medium}</ReferenceRow>}
        {item.dimensions && (
          <ReferenceRow label={s.dimensions}>{item.dimensions}</ReferenceRow>
        )}
        {item.inventory && (
          <ReferenceRow label={s.inventory}>
            <span className="tabular-nums">{item.inventory}</span>
          </ReferenceRow>
        )}
        {item.image && (
          <ReferenceRow label={s.image}>
            {item.image.author && <>{item.image.author} · </>}
            {item.image.license}
            {' · '}
            <a
              href={item.image.source}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {s.imageSource}
            </a>
          </ReferenceRow>
        )}
      </dl>
    </details>
  )
}

function Neighbour({
  item,
  lang,
  label,
  side,
}: {
  item: Item
  lang: Lang
  label: string
  side: 'prev' | 'next'
}) {
  return (
    <Link
      to="/$lang/item/$id"
      params={{ lang, id: item.id }}
      className={`flex min-h-16 flex-col justify-center gap-1 rounded-lg border border-border px-3 py-3 active:bg-muted hover:bg-muted/50 ${
        side === 'next' ? 'col-start-2 text-right' : ''
      }`}
    >
      <span className="text-xs text-muted-foreground">
        {side === 'prev' ? `← ${label}` : `${label} →`}
      </span>
      <span className="text-sm font-medium leading-snug">{item.title}</span>
    </Link>
  )
}

function ItemPage() {
  const { item, prev, next } = Route.useLoaderData()
  const lang = item.lang
  const s = t(lang)
  const busy =
    item.crowd === 'extreme' ? s.busy.extreme : item.crowd === 'high' ? s.busy.high : null

  return (
    <article className="pb-4">
      {item.image && <HeroImage image={item.image} alt={item.title} lang={lang} />}
      <header>
        <h1 className="text-2xl font-semibold leading-tight">{item.title}</h1>
        {item.titleFR && item.titleFR !== item.title && (
          <p className="mt-1 text-sm text-muted-foreground">{item.titleFR}</p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.locator}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{item.timeNeeded}</span>
          {busy && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {busy}
            </Badge>
          )}
        </div>
      </header>

      {item.sections.map((section) => (
        <SectionView key={section.kind} section={section} />
      ))}

      <Reference item={item} s={s} />

      <nav className="mt-8 grid grid-cols-2 gap-3">
        {prev && <Neighbour item={prev} lang={lang} label={s.previous} side="prev" />}
        {next && <Neighbour item={next} lang={lang} label={s.next} side="next" />}
      </nav>
    </article>
  )
}

function ItemNotFound() {
  const { lang } = useParams({ from: '/$lang' })
  const safe: Lang = isLang(lang) ? lang : 'en'
  const s = t(safe)
  return (
    <div className="py-16 text-center">
      <p className="font-medium">{s.itemNotFound}</p>
      <Link
        to="/$lang"
        params={{ lang: safe }}
        className="mt-4 inline-block underline underline-offset-2"
      >
        {s.backToList}
      </Link>
    </div>
  )
}
