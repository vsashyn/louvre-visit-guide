import { Link } from '@tanstack/react-router'
import type { Item } from '@/lib/content'
import type { Lang } from '@/lib/lang'
import { t } from '@/lib/ui'
import { Badge } from '@/components/ui/badge'

/** Room sits in a fixed-width slot so the column lines up across rows. Gap
 *  alone does not align columns when the labels differ in length. */
export function ItemRow({
  item,
  lang,
  showRoom = true,
}: {
  item: Item
  lang: Lang
  showRoom?: boolean
}) {
  const s = t(lang)
  const busy =
    item.crowd === 'extreme' ? s.busy.extreme : item.crowd === 'high' ? s.busy.high : null

  return (
    <Link
      to="/$lang/item/$id"
      params={{ lang, id: item.id }}
      className="flex gap-3 rounded-lg px-3 py-3 -mx-3 active:bg-muted hover:bg-muted/50"
    >
      {showRoom && (
        <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
          {item.location.room ?? '—'}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium leading-snug">{item.title}</span>
          {busy && (
            <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
              {busy}
            </Badge>
          )}
        </span>
        {item.artist && (
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">{item.artist}</span>
        )}
      </span>
    </Link>
  )
}
