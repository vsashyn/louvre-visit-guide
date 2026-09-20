import {
  Link,
  Outlet,
  createFileRoute,
  notFound,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import { LANG_SHORT, isLang, other, storeLang, type Lang } from '@/lib/lang'
import { loadContent } from '@/lib/content'
import { UpdateBanner } from '@/components/UpdateBanner'
import { ThemeToggle } from '@/components/ThemeToggle'

export const Route = createFileRoute('/$lang')({
  beforeLoad: ({ params }) => {
    if (!isLang(params.lang)) throw notFound()
  },
  // Loaded once here; every child page reads it from this loader rather than
  // fetching again.
  loader: ({ params }) => loadContent(params.lang as Lang),
  component: LangLayout,
})

function LangSwitch({ lang }: { lang: Lang }) {
  const target = other(lang)
  // Rebuild the current URL with the language segment swapped.
  //
  // `to="."` does not work here. This component lives in the $lang layout, so
  // the router resolves "." to /$lang and the switch drops you on the index
  // from every page. Deriving the href from the live location keeps you on the
  // same item, and carries the search string so the index keeps its query.
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, searchStr: s.location.searchStr }),
  })
  const href = pathname.replace(/^\/(en|uk)(?=\/|$)/, `/${target}`) + searchStr

  return (
    <Link
      to={href}
      onClick={() => storeLang(target)}
      className="flex size-11 items-center justify-center rounded-md border border-input text-xs font-medium active:bg-muted hover:bg-muted/50"
      aria-label={target === 'uk' ? 'Перемкнути на українську' : 'Switch to English'}
    >
      {LANG_SHORT[target]}
    </Link>
  )
}

function LangLayout() {
  const { lang } = useParams({ from: '/$lang' })
  if (!isLang(lang)) return null

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 pt-[var(--safe-top)] backdrop-blur">
        <div className="mx-auto flex h-[var(--header-h)] max-w-2xl items-center justify-between gap-2 pl-4 pr-2">
          <Link
            to="/$lang"
            params={{ lang }}
            className="-ml-2 flex min-h-11 items-center rounded-md px-2 font-semibold active:bg-muted hover:bg-muted/50"
          >
            {lang === 'uk' ? 'Лувр' : 'Louvre'}
          </Link>
          <nav className="flex items-center text-sm">
            <Link
              to="/$lang/visit"
              params={{ lang }}
              className="flex min-h-11 items-center rounded-md px-2 active:bg-muted hover:bg-muted/50"
              activeProps={{ className: 'underline' }}
            >
              {lang === 'uk' ? 'Маршрут' : 'Route'}
            </Link>
            <ThemeToggle lang={lang} />
            <LangSwitch lang={lang} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <Outlet />
      </main>
      <UpdateBanner lang={lang} />
    </div>
  )
}
