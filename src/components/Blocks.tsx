import type { Block } from '@/lib/content'

/** Paragraphs, bullet lists and subheadings, the only three block types the
 *  pipeline emits. Shared by the item pages and the route guide. */
export function Blocks({ blocks, lead }: { blocks: Block[]; lead?: boolean }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'subheading') {
          return (
            <h3 key={i} className="mt-6 text-base font-semibold first:mt-0">
              {block.text}
            </h3>
          )
        }
        if (block.type === 'bullets') {
          return (
            <ul key={i} className="mt-3 list-disc space-y-2 pl-5 first:mt-0">
              {block.items.map((text, j) => (
                <li key={j} className="leading-relaxed">
                  {text}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className={`mt-3 leading-relaxed first:mt-0 ${lead ? 'text-lg' : ''}`}>
            {block.text}
          </p>
        )
      })}
    </>
  )
}
