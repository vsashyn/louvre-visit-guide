import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { ItemImage } from '@/lib/content'
import type { Lang } from '@/lib/lang'
import { t } from '@/lib/ui'

/**
 * Full-screen picture with pinch-zoom, written by hand rather than taken from
 * a library.
 *
 * Installed to the home screen the app runs standalone, where the browser's
 * own page zoom is not available, so the gesture has to be implemented. Half
 * the `Look for` bullets point at things invisible at page scale, which makes
 * this load-bearing rather than a flourish.
 */
type Transform = { scale: number; x: number; y: number }
const IDENTITY: Transform = { scale: 1, x: 0, y: 0 }
const MAX_SCALE = 6

const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

export function ZoomViewer({
  image,
  alt,
  lang,
  onClose,
}: {
  image: ItemImage
  alt: string
  lang: Lang
  onClose: () => void
}) {
  const s = t(lang)
  const stage = useRef<HTMLDivElement>(null)
  const [tf, setTf] = useState<Transform>(IDENTITY)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Touch handling sits on a raw listener because these have to be
  // non-passive: without preventDefault the page scrolls under the gesture.
  useEffect(() => {
    const el = stage.current
    if (!el) return

    let start: Transform = IDENTITY
    let startDist = 0
    let startMid = { x: 0, y: 0 }
    let panFrom: { x: number; y: number } | null = null
    let lastTap = 0
    let current = tf

    const rect = () => el.getBoundingClientRect()
    const centred = (x: number, y: number) => {
      const r = rect()
      return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 }
    }
    /* Keep at least part of the picture on screen at every scale. */
    const clamp = (next: Transform): Transform => {
      const r = rect()
      const limitX = Math.max(0, (r.width * (next.scale - 1)) / 2)
      const limitY = Math.max(0, (r.height * (next.scale - 1)) / 2)
      return {
        scale: next.scale,
        x: Math.min(limitX, Math.max(-limitX, next.x)),
        y: Math.min(limitY, Math.max(-limitY, next.y)),
      }
    }
    const apply = (next: Transform) => {
      current = clamp(next)
      setTf(current)
    }
    /* Zoom about a point: the bit of picture under your fingers stays there. */
    const zoomAbout = (point: { x: number; y: number }, from: Transform, scale: number) => {
      const next = Math.min(MAX_SCALE, Math.max(1, scale))
      const factor = next / from.scale
      return {
        scale: next,
        x: point.x - factor * (point.x - from.x),
        y: point.y - factor * (point.y - from.y),
      }
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0]!, e.touches[1]!]
        startDist = distance(a, b)
        startMid = centred((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
        start = current
        panFrom = null
        e.preventDefault()
      } else if (e.touches.length === 1) {
        const touch = e.touches[0]!
        const now = Date.now()
        if (now - lastTap < 300) {
          const point = centred(touch.clientX, touch.clientY)
          apply(current.scale > 1 ? IDENTITY : zoomAbout(point, current, 3))
          lastTap = 0
          e.preventDefault()
          return
        }
        lastTap = now
        if (current.scale > 1) {
          panFrom = { x: touch.clientX - current.x, y: touch.clientY - current.y }
          start = current
        }
      }
    }

    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0]!, e.touches[1]!]
        if (!startDist) return
        apply(zoomAbout(startMid, start, (start.scale * distance(a, b)) / startDist))
        e.preventDefault()
      } else if (e.touches.length === 1 && panFrom) {
        const touch = e.touches[0]!
        apply({ scale: current.scale, x: touch.clientX - panFrom.x, y: touch.clientY - panFrom.y })
        e.preventDefault()
      }
    }

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        panFrom = null
        startDist = 0
        // Snap back rather than leaving the picture parked off-centre.
        if (current.scale <= 1.02) apply(IDENTITY)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
    // Listeners hold their own copy of the transform, so this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="flex justify-end pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onClose}
          aria-label={s.zoomClose}
          autoFocus
          className="m-2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>
      <div
        ref={stage}
        className="flex flex-1 touch-none select-none items-center justify-center overflow-hidden"
        onDoubleClick={() => setTf((v) => (v.scale > 1 ? IDENTITY : { scale: 3, x: 0, y: 0 }))}
      >
        <img
          src={'/' + image.src}
          alt={alt}
          width={image.width}
          height={image.height}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{
            transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.scale})`,
            transformOrigin: 'center',
            willChange: 'transform',
          }}
        />
      </div>
      <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-xs text-white/60">
        {s.zoomHint}
      </p>
    </div>
  )
}
