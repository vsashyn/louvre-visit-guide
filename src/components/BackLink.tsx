import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { Lang } from '@/lib/lang'
import { t } from '@/lib/ui'

/**
 * Back to where you came from, and to the list when there is nowhere to go
 * back to.
 *
 * Going back through history keeps the search query you arrived with. A deep
 * link opened from a message or the home screen has no history behind it, and
 * that is the case a plain link to the index exists for.
 */
export function BackLink({ lang }: { lang: Lang }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const s = t(lang)
  const className =
    '-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-md pl-1 pr-3 text-sm text-muted-foreground active:bg-muted hover:bg-muted/50'

  if (canGoBack) {
    return (
      <button type="button" onClick={() => router.history.back()} className={className}>
        <ChevronLeft className="size-4" />
        {s.back}
      </button>
    )
  }
  return (
    <Link to="/$lang" params={{ lang }} className={className}>
      <ChevronLeft className="size-4" />
      {s.backToList}
    </Link>
  )
}
