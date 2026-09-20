import { Moon, Sun } from 'lucide-react'
import { setTheme, useDark } from '@/lib/theme'
import type { Lang } from '@/lib/lang'
import { t } from '@/lib/ui'

export function ThemeToggle({ lang }: { lang: Lang }) {
  const dark = useDark()
  const s = t(lang)
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? s.themeToLight : s.themeToDark}
      className="flex size-11 items-center justify-center rounded-md active:bg-muted hover:bg-muted/50"
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}
