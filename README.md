# Louvre guide

Content for a personal offline guide to the Louvre. One Markdown file per item in `assets/`, 78 of them, covering paintings, sculpture, objects and rooms across all three wings.

- `CLAUDE.md` is the project brief: what the app has to do, the stack, and the exact content format. Read it before adding files.
- `docs/technical-design.md` is the implementation plan.
- `assets/INDEX.md` lists every item grouped by wing and level, in walking order.

Every file carries YAML frontmatter with the fields `CLAUDE.md` specifies, then the same eight body sections in the same order, so `content.json` generation can rely on the shape. Each item also carries an image: `image` (Wikimedia Commons thumbnail URL), `image_source` (description page with the photographer) and `image_license`. Thumbnails rather than originals, because upload.wikimedia.org rate-limits full-size files and answers 429 after a few dozen fetches.

## Ukrainian version

`uk/` mirrors the repository in Ukrainian: 78 translated item files with the same ids, a translated index, README, project brief and technical docs. English remains the source of truth. `uk/README.md` records which frontmatter values are translated, which stay machine-stable, and how the Ukrainian section headings map back to the English ones.


## Coverage

| Department | Items |
|---|---|
| Paintings | 47 |
| Greek, Etruscan and Roman antiquities | 8 |
| Sculptures | 6 |
| Near Eastern antiquities | 5 |
| Egyptian antiquities | 4 |
| Decorative arts | 3 |
| Palace, rooms and architecture | 5 |

The paintings run from Cimabue in the 1280s to Delacroix in 1830 and cover the Italian, French, Netherlandish, Flemish, Dutch, German and Spanish schools. Forty-three items are tagged `must-see` and eight `hidden-gem`, the latter all in rooms that are usually close to empty.

## Status, as of September 2026

- The Mona Lisa is still in Room 711. The Louvre Nouvelle Renaissance project will move her to a purpose-built room under the Cour Carrée with a separate ticket, planned for around 2031.
- The Galerie d'Apollon reopened on 22 July 2026 after the October 2025 theft of eight pieces of the French Crown Jewels. The cases are gone and no jewels are on display. The surviving jewels are to be shown in a separate secured gallery.
- The Spanish painting rooms in Denon, 720 to 734, have had extended partial closures, which affects the Murillo.

Room numbers move. Each file records the room the Louvre published for that work in 2025 or 2026, and the three items above carry the caveat in their `Practical` section.

## Sources

Room numbers and locations come from the Louvre's own 2025 visitor trail PDFs, "The Louvre's Masterpieces" and "Secret Treasures of the Richelieu Wing", and from collections.louvre.fr. Dates, dimensions, inventory numbers, provenance and the factual claims in each file come from the Louvre collections database and from Wikipedia's referenced articles on each work, cross-checked where sources disagreed. Disputed attributions, dates and interpretations are flagged as disputed in the text rather than resolved silently.
