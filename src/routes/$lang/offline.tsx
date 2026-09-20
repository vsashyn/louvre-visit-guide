import { createFileRoute, notFound, useLoaderData } from '@tanstack/react-router'
import { isLang } from '@/lib/lang'
import { loadOfflineGuide, OFFLINE_STEPS } from '@/lib/offline'
import { Blocks } from '@/components/Blocks'
import { BackLink } from '@/components/BackLink'
import { ImageCacheCard } from '@/components/ImageCacheCard'

export const Route = createFileRoute('/$lang/offline')({
  loader: async ({ params }) => {
    if (!isLang(params.lang)) throw notFound()
    return loadOfflineGuide(params.lang)
  },
  component: OfflinePage,
})

function OfflinePage() {
  const guide = Route.useLoaderData()
  const items = useLoaderData({ from: '/$lang' })
  const lang = guide.lang

  return (
    <article className="pb-4">
      <BackLink lang={lang} />
      <header>
        <h1 className="text-2xl font-semibold leading-tight">{guide.title}</h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">{guide.lead}</p>
      </header>

      {/* The page you read to set this up is the place to do it, so the live
          state of the picture cache sits at the top rather than being
          described three paragraphs down. */}
      <div className="mt-6">
        <ImageCacheCard items={items} lang={lang} showComplete />
      </div>

      {guide.sections.map((section) => {
        const step = OFFLINE_STEPS.indexOf(section.kind)
        return (
          <section key={section.kind} className="mt-8">
            <h2 className="flex items-center gap-2 font-semibold">
              {step >= 0 && (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs text-background">
                  {step + 1}
                </span>
              )}
              {section.heading}
            </h2>
            <div className={step >= 0 ? 'pl-8' : ''}>
              <Blocks blocks={section.blocks} />
            </div>
          </section>
        )
      })}
    </article>
  )
}
