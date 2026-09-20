export const LANGS = ['en', 'uk'] as const
export type Lang = (typeof LANGS)[number]

const STORAGE_KEY = 'louvre-guide.lang'

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value)
}

export function other(lang: Lang): Lang {
  return lang === 'en' ? 'uk' : 'en'
}

/** Reading storage throws in a private window, so every access is guarded. */
export function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isLang(v) ? v : null
  } catch {
    return null
  }
}

export function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* ignore, the URL still carries the language */
  }
}

/** Stored preference, then the browser, then English. */
export function detectLang(): Lang {
  const stored = readStoredLang()
  if (stored) return stored
  const nav = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
  for (const tag of nav) {
    const base = tag.toLowerCase().split('-')[0]
    if (isLang(base)) return base
  }
  return 'en'
}

export const LANG_LABEL: Record<Lang, string> = { en: 'English', uk: 'Українська' }
export const LANG_SHORT: Record<Lang, string> = { en: 'EN', uk: 'УК' }
