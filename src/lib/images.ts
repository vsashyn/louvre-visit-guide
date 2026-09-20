import { useCallback, useEffect, useState } from 'react'
import type { Item } from './content'

/**
 * The picture cache lives in the service worker, in its own cache that survives
 * app updates. This module is the app's half of that conversation.
 *
 * Nothing downloads on its own. Sixteen megabytes over museum wifi is a
 * decision a visitor makes at home, not something an install event does behind
 * their back.
 */
export type CacheState =
  | { kind: 'unavailable' }
  | { kind: 'checking' }
  | { kind: 'complete'; total: number }
  | { kind: 'missing'; missing: string[]; total: number }
  | { kind: 'working'; done: number; total: number }
  | { kind: 'failed'; failed: string[]; total: number }

const urlFor = (src: string) => '/' + src

export function imageUrls(items: Item[]): string[] {
  return items.filter((i) => i.image).map((i) => urlFor(i.image!.src))
}

export function totalMegabytes(items: Item[]): number {
  const bytes = items.reduce((sum, i) => sum + (i.image?.bytes ?? 0), 0)
  return Math.round(bytes / 1024 / 1024)
}

/** Titles of the works whose picture is not on this phone, in walking order. */
export function missingTitles(items: Item[], missing: string[]): string[] {
  const set = new Set(missing)
  return items.filter((i) => i.image && set.has(urlFor(i.image.src))).map((i) => i.title)
}

async function controller(): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller
    // On the very first launch the worker activates and claims the page a
    // moment after the app mounts. Without this wait the card decides there is
    // no worker and hides itself until the next launch, which is exactly the
    // launch where a visitor most needs to be offered the download.
    return await new Promise((resolve) => {
      const stop = (value: ServiceWorker | null) => {
        clearTimeout(timer)
        navigator.serviceWorker.removeEventListener('controllerchange', onChange)
        resolve(value)
      }
      const onChange = () => stop(navigator.serviceWorker.controller)
      const timer = setTimeout(() => stop(null), 5000)
      navigator.serviceWorker.addEventListener('controllerchange', onChange)
    })
  } catch {
    return null
  }
}

export function useImageCache(items: Item[]) {
  const [state, setState] = useState<CacheState>({ kind: 'checking' })
  const urls = imageUrls(items)
  const total = urls.length

  useEffect(() => {
    let live = true
    const onMessage = (event: MessageEvent) => {
      if (!live) return
      const data = event.data || {}
      if (data.type === 'IMAGE_STATUS') {
        setState(
          data.missing.length === 0
            ? { kind: 'complete', total: data.total }
            : { kind: 'missing', missing: data.missing, total: data.total },
        )
      }
      if (data.type === 'IMAGE_PROGRESS') {
        setState({ kind: 'working', done: data.done, total: data.total })
      }
      if (data.type === 'IMAGE_DONE') {
        setState(
          data.failed.length
            ? { kind: 'failed', failed: data.failed, total: data.total }
            : { kind: 'complete', total: data.total },
        )
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    // Checked on every launch, so a visitor learns about a gap in the queue
    // outside rather than in front of the work.
    controller().then((sw) => {
      if (!live) return
      if (!sw) return setState({ kind: 'unavailable' })
      sw.postMessage({ type: 'IMAGE_STATUS', urls })
    })
    return () => {
      live = false
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
    // The url list is derived from the loaded content, which does not change
    // within a language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  const download = useCallback(
    async (only?: string[]) => {
      const sw = await controller()
      if (!sw) return
      const wanted = only?.length ? only : urls
      setState({ kind: 'working', done: 0, total: wanted.length })
      sw.postMessage({ type: 'CACHE_IMAGES', urls: wanted })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total],
  )

  return { state, download, total }
}
