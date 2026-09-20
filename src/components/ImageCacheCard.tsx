import { Check } from 'lucide-react'
import type { Item } from '@/lib/content'
import type { Lang } from '@/lib/lang'
import { missingTitles, totalMegabytes, useImageCache } from '@/lib/images'
import { useOnline } from '@/lib/sw'
import { t } from '@/lib/ui'
import { Button } from '@/components/ui/button'

/**
 * The explicit download, and the launch-time integrity check, in one card.
 *
 * Offline with pictures missing it stops being a button and becomes a warning
 * that names the works, because finding out in front of the Victory of
 * Samothrace is too late to do anything about it.
 */
export function ImageCacheCard({
  items,
  lang,
  showComplete = false,
}: {
  items: Item[]
  lang: Lang
  /** The index hides a finished download; the setup page confirms it. */
  showComplete?: boolean
}) {
  const { state, download } = useImageCache(items)
  const online = useOnline()
  const s = t(lang)

  const frame = (children: React.ReactNode) => (
    <section className="mb-4 rounded-lg border border-border px-4 py-3">{children}</section>
  )

  if (state.kind === 'unavailable' || state.kind === 'checking') return null
  if (state.kind === 'complete') {
    return showComplete
      ? frame(
          <p className="flex items-center gap-2 text-sm">
            <Check className="size-4 shrink-0" />
            {s.picturesDone}
          </p>,
        )
      : null
  }

  if (state.kind === 'working') {
    const pct = state.total ? Math.round((state.done / state.total) * 100) : 0
    return frame(
      <>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{s.picturesTitle}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {s.picturesWorking(state.done, state.total)}
          </p>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
        </div>
      </>,
    )
  }

  const missing = state.kind === 'missing' ? state.missing : state.failed
  const titles = missingTitles(items, missing)

  if (!online) {
    // Named, not counted, and named without a tap. A list behind a disclosure
    // is not being told up front which works will have no picture.
    const shown = titles.slice(0, 5)
    const rest = titles.slice(5)
    return frame(
      <>
        <p className="text-sm">{s.picturesMissingOffline(missing.length)}</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {shown.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
        {rest.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {s.picturesMore(rest.length)}
            </summary>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {rest.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </details>
        )}
      </>,
    )
  }

  const everything = missing.length === state.total
  return frame(
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{s.picturesTitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {everything
            ? s.picturesSize(totalMegabytes(items), state.total)
            : s.picturesMissingOnline(missing.length)}
        </p>
      </div>
      <Button className="h-11 shrink-0" onClick={() => download(missing)}>
        {state.kind === 'failed' ? s.picturesRetry : s.picturesDownload}
      </Button>
    </div>,
  )
}
