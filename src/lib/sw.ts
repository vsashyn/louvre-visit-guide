import { useSyncExternalStore } from 'react'

/**
 * Registration and the update handshake.
 *
 * The worker itself never calls skipWaiting, so a new build sits in the wings
 * until the visitor taps. During a visit the app is frozen by design: the one
 * thing worse than an old paragraph is the app reloading while you are reading
 * it in a room with no signal.
 */
let waiting: ServiceWorker | null = null
let expectingReload = false
const listeners = new Set<() => void>()

const notify = () => {
  for (const l of listeners) l()
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload when the swap was asked for. A controller arriving on first
    // install is not a reason to throw the page away.
    if (!expectingReload) return
    expectingReload = false
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const watch = (worker: ServiceWorker | null) => {
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              waiting = worker
              notify()
            }
          })
        }
        if (reg.waiting && navigator.serviceWorker.controller) {
          waiting = reg.waiting
          notify()
        }
        reg.addEventListener('updatefound', () => watch(reg.installing))
      })
      .catch(() => {
        // An unregistrable worker means no offline mode, not a broken app.
      })
  })
}

export function applyUpdate(): void {
  if (!waiting) return
  expectingReload = true
  waiting.postMessage({ type: 'SKIP_WAITING' })
  waiting = null
  notify()
}

/** True once a new build has installed and is waiting to take over. */
export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => waiting !== null,
    () => false,
  )
}

/** `navigator.onLine` as a hook. False is reliable, true only means a link. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('online', l)
      window.addEventListener('offline', l)
      return () => {
        window.removeEventListener('online', l)
        window.removeEventListener('offline', l)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}
