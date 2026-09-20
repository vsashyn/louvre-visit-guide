# Louvre guide

Content for a personal offline guide to the Louvre. One Markdown file per item in `assets/`, 78 of them, covering paintings, sculpture, objects and rooms across all three wings.

- `CLAUDE.md` is the project brief: what the app has to do, the stack, and the exact content format. Read it before adding files.
- `docs/technical-design.md` is the implementation plan.
- `assets/INDEX.md` lists every item grouped by wing and level, in walking order.

Every file carries YAML frontmatter with the fields `CLAUDE.md` specifies, then the same eight body sections in the same order, so `content.json` generation can rely on the shape. Each item also carries an image: `image` (Wikimedia Commons thumbnail URL), `image_source` (description page with the photographer) and `image_license`. Thumbnails rather than originals, because upload.wikimedia.org rate-limits full-size files and answers 429 after a few dozen fetches.

## Ukrainian version

`uk/` mirrors the repository in Ukrainian: 78 translated item files with the same ids, a translated index, README, project brief and technical docs. English remains the source of truth. `uk/README.md` records which frontmatter values are translated, which stay machine-stable, and how the Ukrainian section headings map back to the English ones.

`Louvre-Guide-UK.pdf` is the complete Ukrainian guide as a single 173-page document: cover, how to use it, the three routes, practical notes, a contents list, then every item with its metadata table, image and full text, and an image-credits appendix at the end.

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

## Suggested routes

### Half day, about 3 hours

Enter through Sully. Salle des Caryatides and the Sleeping Hermaphroditus, then the Venus de Milo, then the Daru staircase up to the Winged Victory. Botticelli frescoes, Salon Carré, Grande Galerie with the Leonardos, Salle des États for the Mona Lisa and the Veronese, Salle Mollien and Salle Daru for the big French canvases. Down to the Michelangelo gallery for the Slaves and the Canova. Out past the Pyramid.

This is essentially the Louvre's own masterpieces trail plus the two rooms of French nineteenth-century painting.

### Full day, about 6 hours with a break

Morning as above, finishing in Denon around midday. Break in the Cour Marly, Richelieu level -1, which has benches, daylight and almost nobody in it.

Afternoon in Richelieu. Cour Marly and Cour Puget, then level 0 for Hammurabi, the Lamassu in the Cour Khorsabad, Ebih-Il, the Naram-Sin stele and the Tomb of Philippe Pot. Level 1 for the Napoleon III Apartments. Level 2 for the Marie de' Medici gallery, the two Vermeers, the Rembrandts, and van Eyck in the Netherlandish rooms.

### Second visit

Sully. The medieval moat at level -1, the Crypt of the Sphinx, then Egyptian antiquities at level 1 for the Seated Scribe, the Gebel el-Arak knife and the Dendera zodiac. Level 2 for French painting from the Pietà of Villeneuve through La Tour, Watteau, Chardin and Fragonard. Then the Denon entresol for the Lady of Auxerre and the Etruscan rooms.

## Practical notes

- Book a timed ticket online. Entry without one is difficult.
- The Pyramid entrance has the longest queue. The Carrousel du Louvre entrance, from 99 rue de Rivoli or the Palais Royal Musée du Louvre metro, is usually faster.
- Closed Tuesdays. Late opening Wednesdays and Fridays, which is the quietest time to see the Mona Lisa.
- Free cloakrooms under the Pyramid. Large bags are not allowed in the galleries.
- Cafés: Café Mollien in Denon level 1, beside the Salle Mollien, with a terrace. Café Richelieu on Richelieu level 1.
- Download the official Louvre app as well. It has live room closures and navigation, which a static guide cannot.

## Status, as of September 2026

- The Mona Lisa is still in Room 711. The Louvre Nouvelle Renaissance project will move her to a purpose-built room under the Cour Carrée with a separate ticket, planned for around 2031.
- The Galerie d'Apollon reopened on 22 July 2026 after the October 2025 theft of eight pieces of the French Crown Jewels. The cases are gone and no jewels are on display. The surviving jewels are to be shown in a separate secured gallery.
- The Spanish painting rooms in Denon, 720 to 734, have had extended partial closures, which affects the Murillo.

Room numbers move. Each file records the room the Louvre published for that work in 2025 or 2026, and the three items above carry the caveat in their `Practical` section.

## Sources

Room numbers and locations come from the Louvre's own 2025 visitor trail PDFs, "The Louvre's Masterpieces" and "Secret Treasures of the Richelieu Wing", and from collections.louvre.fr. Dates, dimensions, inventory numbers, provenance and the factual claims in each file come from the Louvre collections database and from Wikipedia's referenced articles on each work, cross-checked where sources disagreed. Disputed attributions, dates and interpretations are flagged as disputed in the text rather than resolved silently.
