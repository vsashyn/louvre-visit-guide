import { useState } from 'react'
import type { ItemImage } from '@/lib/content'
import type { Lang } from '@/lib/lang'
import { t } from '@/lib/ui'
import { ZoomViewer } from '@/components/ZoomViewer'

/**
 * The credit under the picture is a licence condition on twenty of the 78
 * images, not decoration. It renders for all of them, and it renders here
 * rather than only in the collapsed reference block, because "wherever the app
 * shows the image" is what the licence says.
 */
export function HeroImage({ image, alt, lang }: { image: ItemImage; alt: string; lang: Lang }) {
  const s = t(lang)
  const [zoom, setZoom] = useState(false)
  const [broken, setBroken] = useState(false)

  if (broken) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
        {s.noPicture}
      </div>
    )
  }

  return (
    <figure className="mb-5">
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label={s.zoomOpen}
        className="block w-full overflow-hidden rounded-lg bg-muted"
      >
        <img
          src={'/' + image.src}
          alt={alt}
          width={image.width}
          height={image.height}
          decoding="async"
          onError={() => setBroken(true)}
          className="h-auto w-full"
          style={{ aspectRatio: `${image.width} / ${image.height}` }}
        />
      </button>
      <figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {image.author && <span>{image.author} · </span>}
        {image.license}
        {' · '}
        <a
          href={image.source}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Wikimedia Commons
        </a>
      </figcaption>
      {zoom && <ZoomViewer image={image} alt={alt} lang={lang} onClose={() => setZoom(false)} />}
    </figure>
  )
}
