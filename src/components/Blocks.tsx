import type { Block } from '@/lib/content'

/** Paragraphs, bullet lists and subheadings, the only three block types the
 *  pipeline emits. Shared by the item pages, the route guide and the setup
 *  page. Every block renders at the same size: `In one line` used to be set
 *  larger and it made the top of an item page read as two different documents. */
export function Blocks({ blocks }: { blocks: Block[] }) {
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
          <p key={i} className="mt-3 leading-relaxed first:mt-0">
            {block.text}
          </p>
        )
      })}
    </>
  )
}
