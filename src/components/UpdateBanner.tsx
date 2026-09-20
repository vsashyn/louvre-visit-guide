import type { Lang } from '@/lib/lang'
import { applyUpdate, useOnline, useUpdateReady } from '@/lib/sw'
import { t } from '@/lib/ui'
import { Button } from '@/components/ui/button'

/** Offline the update cannot be applied anyway, so the bar stays out of the
 *  way until there is a connection to apply it over. */
export function UpdateBanner({ lang }: { lang: Lang }) {
  const ready = useUpdateReady()
  const online = useOnline()
  const s = t(lang)
  if (!ready || !online) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm">{s.updateReady}</p>
        <Button className="h-11 shrink-0" onClick={applyUpdate}>
          {s.updateAction}
        </Button>
      </div>
    </div>
  )
}
