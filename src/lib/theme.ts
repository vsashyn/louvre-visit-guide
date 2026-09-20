import { useSyncExternalStore } from 'react'

/**
 * Light or dark, with the system setting as the default.
 *
 * Galleries are dim and the app is read at arm's length in them, so this is
 * not decoration. The class is applied by an inline script in index.html
 * before first paint; this module keeps it in step afterwards.
 */
export type Theme = 'system' | 'light' | 'dark'

const KEY = 'louvre-guide.theme'
const DARK = '#0b0b0c'
const LIGHT = '#ffffff'

const listeners = new Set<() => void>()
let theme: Theme = read()

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function isDark(value: Theme = theme): boolean {
  return value === 'dark' || (value === 'system' && systemPrefersDark())
}

function paint(): void {
  const dark = isDark()
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? DARK : LIGHT)
}

export function setTheme(next: Theme): void {
  theme = next
  try {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    /* the class is still applied for this session */
  }
  paint()
  for (const l of listeners) l()
}

/** Follow the system while no explicit choice has been made. */
export function watchSystemTheme(): void {
  if (typeof matchMedia !== 'function') return
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme === 'system') {
      paint()
      for (const l of listeners) l()
    }
  })
}

export function useDark(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => isDark(),
    () => false,
  )
}
