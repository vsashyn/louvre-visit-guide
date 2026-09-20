# Louvre guide technical design

How we build the app. Written 20 September 2026. This replaces the vanilla-JS plan, kept for reference in `docs/archive/vanilla-offline-plan.md`.

The plan below is as approved and is not rewritten as work lands. Where the two differ, `docs/implementation-plan.md` is what was actually built and why. One change is worth knowing before you read: `docs/visit-route.md`, referenced throughout, has been replaced by `content/route.en.md` and `content/route.uk.md` and deleted, exactly as this document asks.

## What changed

Three decisions from the old plan are reversed.

Audio is gone. No text-to-speech, no narration tracks, no Media Session, no mini player, no section offsets, no Lock Screen work. Text and images only. This removes the largest chunk of the old pipeline and the two hardest risks in it, Safari Range requests and background playback.

The stack is React, TanStack Router, Tailwind and shadcn/ui instead of vanilla JavaScript.

The app is bilingual. Every item page exists in English and Ukrainian with a switch between them, and the content in `uk/assets/` stops being a print-only artefact and becomes a first-class half of the app.

## Scope

Three kinds of page.

An index at the root listing all 78 items with a search box that filters by name.

An item page per work, one URL per language.

A route guide page, the curated full-day walk that currently lives in `docs/visit-route.md`.

Out of scope, unchanged. No accounts, no analytics, no sync, no sharing, no comments. Saved works and visit state are not in this plan either; add them later if the trip wants them.

## Is a framework still the right call

The old plan argued for no framework on bundle size. That argument was overstated and the constraint it protected is unaffected.

React with TanStack Router lands around 60 to 70 KB gzipped. Tailwind compiles to a stylesheet of a few kilobytes at this page count. shadcn/ui copies component source into the repo rather than adding a dependency at runtime, so it costs bundle bytes and nothing else. Against a payload dominated by roughly 16 MB of images, the framework is rounding error.

The real constraints are unchanged and the stack does not threaten either. No third-party requests at runtime, which shadcn satisfies by construction and Tailwind satisfies as long as nobody reaches for a Google-hosted font. Everything serves cache-first from local storage.

One thing to watch. shadcn's default setup assumes a web font in places. Override the font stack to system fonts before building any component, or the no-web-fonts rule leaks.

## URLs and routing

Language is a path segment. It makes the switch a link to the same route with one param changed, keeps every URL shareable and bookmarkable, and means no hidden state decides what a link shows.

```
/                       redirect to /{lang}/
/{lang}/                index, all items, search
/{lang}/item/{id}       one item
/{lang}/visit           the route guide
```

`{lang}` is `en` or `uk`. `{id}` is the filename stem, identical across languages, which is what makes the language switch a one-param change.

The redirect at `/` reads a stored preference, falls back to `navigator.language`, then to `en`.

An unknown `{lang}` or `{id}` renders a not-found page rather than throwing. With no network in a gallery, a blank screen is indistinguishable from a broken app.

### Do not name the path segment `route`

TanStack Router reserves `route` as a filename token for the file that declares a directory's own layout route. Per the routing docs, `src/routes/posts.tsx`, `src/routes/posts.route.tsx` and `src/routes/posts/route.tsx` all resolve to the same URL, `/posts`.

So there is no spelling of a `route` file that gives you the URL `/{lang}/route`. Both the nested form and the flat form collapse onto `/{lang}` and collide with the language layout route. The token is configurable through `routeToken`, but renaming a framework convention to win one URL segment is a bad trade.

Use `/visit`. The feature is still called the route guide everywhere a human reads it.

### Layout

```
src/routes/
  __root.tsx            shell, theme, error and not-found boundaries
  index.tsx             redirect to /{lang}/
  $lang.tsx             validates lang, loads content for it, renders header
  $lang/index.tsx       the index page
  $lang/item.$id.tsx    the item page
  $lang/visit.tsx       the route guide
```

`$lang.tsx` holds the loader. Both child pages read the already-loaded content from context rather than fetching again.

## Language switch

The switch sits in the header on every page and renders as two links, not a dropdown. Two options do not need a menu, and a link works with the back button.

On the item page it points at the same item in the other language. On the index it preserves the current search text. On the route guide it points at the same page.

Selecting a language writes it to `localStorage` so the next cold start at `/` lands in the right place.

## Content pipeline

`tools/build-content.mjs`, Node, run with `npm run content`. It never ships.

It reads `assets/` and `uk/assets/`, and writes into `public/`.

```
assets/*.md      ┐
uk/assets/*.md   ┘
      |  tools/build-content.mjs
      v
public/
  content.en.json
  content.uk.json
  route.en.json
  route.uk.json
  images/<id>.webp
```

### Parsing an item

Frontmatter becomes metadata. The body splits on `##` headings into sections, and each section's paragraphs and bullet lists become separate block types so the app lays them out instead of rendering Markdown at runtime.

Map headings to a stable `kind` through a per-language table.

| kind | English | Ukrainian |
|---|---|---|
| `inOneLine` | In one line | Одним рядком |
| `whatYouAreLookingAt` | What you are looking at | Що ви бачите |
| `story` | The story | Історія |
| `lookFor` | Look for | Знайдіть |
| `facts` | Interesting facts | Цікаві факти |
| `practical` | Practical | Практичне |
| `talkingPoint` | Talking point | Тема для розмови |

Map by heading text, never by position. `Practical` appears in 13 of 78 files, so the section index of `Talking point` differs between items.

Some items carry `###` subheadings inside a section. Keep them as a `subheading` block type. Do not flatten them.

### Validation, and make it fail the build

The pipeline is the only thing standing between a content typo and a broken page in a gallery. It should refuse to emit on any of these.

- An id present in one language and not the other.
- A heading that is not in the table for its language.
- Sections out of the canonical order.
- A missing required frontmatter field.
- An `id` that does not match its filename.
- An item with no image.

These are the same checks already run by hand against the current content, which passes all of them today. Wiring them into the build is what keeps that true.

### Images

Frontmatter already carries `image`, a Wikimedia thumbnail URL, plus `image_source` and `image_license`.

The pipeline downloads each one into a build cache outside the repo, converts to WebP with sharp at 1400 px on the long edge, and writes `public/images/<id>.webp`. The cache means a rebuild does not re-download.

Fetch the URL in the frontmatter as-is. It points at a thumbnail host on purpose. Full-size originals on `upload.wikimedia.org` are rate-limited and answer 429 after a few dozen fetches, which is what forced the switch.

One image per item, shared by both languages. No detail crops. The old plan wanted crops keyed to `Look for` bullets, but there is no source for them beyond the single thumbnail, and cropping 78 works by hand is a project of its own. Pinch-zoom on the main image covers the same need.

Budget roughly 200 KB per image at that size, so about 16 MB for the set. Measure it rather than trusting the estimate, and drop to 1200 px if it runs long.

### Drop an image rather than guess at its licence

The pipeline decides per image, and the rule is that doubt means no image.

| What the Commons metadata says | What happens |
|---|---|
| Public domain or CC0 | Ship it. Credit anyway, it costs nothing |
| Attribution licence, author name present | Ship it with a mandatory credit line |
| Attribution licence, no author name | Drop it |
| Licence missing or unresolvable | Drop it |
| Any usage restriction flagged | Drop it |

A dropped image is not a build failure. The item renders without a hero image and the page still works, because the text was always the point.

Checked against the current content, that rule drops nothing. All 78 images resolve to a definite licence, all 20 attribution-required ones carry an author name, and none is flagged with a usage restriction. The gate exists so that stays true when content changes, not because anything is wrong today.

The split is 48 public domain, 10 CC0 and 20 under CC BY or CC BY-SA. Those 20 need the photographer credited wherever the image appears, and `image_source` is the page that names them.

### The route guide needs a structured source

`docs/visit-route.md` is prose with a Markdown table. Parsing it would be brittle and it has no Ukrainian translation.

Move it to `content/route.en.md` and `content/route.uk.md`, each with frontmatter holding the stop list and a Markdown body for the prose around it. Delete `docs/visit-route.md` once the move is done. One source, no drift.

```yaml
stops:
  - clock: "11:15"
    room: "Denon 703"
    minutes: 5
    items: [winged-victory-of-samothrace]
    note: quick pass, you come back
```

The pipeline emits `route.{lang}.json`. Stops resolve `items` against the content set so the page can link them, and a stop with an empty `items` list still renders as a plain row.

## Data shape

`content.{lang}.json` is an array.

```json
{
  "id": "mona-lisa",
  "lang": "en",
  "title": "Mona Lisa",
  "titleEN": "Mona Lisa",
  "titleFR": "La Joconde",
  "artist": "Leonardo da Vinci",
  "artistDates": "1452–1519",
  "date": "c. 1503–1519",
  "medium": "Oil on poplar panel",
  "dimensions": "77 × 53 cm",
  "inventory": "INV 779 (also MR 316)",
  "location": {
    "department": "Paintings",
    "wing": "Denon",
    "level": "1",
    "room": "711",
    "gallery": "Salle des États"
  },
  "category": "painting",
  "tags": ["must-see", "renaissance", "leonardo", "portrait"],
  "timeNeeded": "10 min",
  "crowd": "extreme",
  "image": { "src": "images/mona-lisa.webp", "width": 1400, "height": 2100,
             "source": "https://commons.wikimedia.org/wiki/File:...",
             "license": "Public domain" },
  "sections": [
    { "kind": "inOneLine", "heading": "In one line",
      "blocks": [{ "type": "paragraph", "text": "A silk merchant's wife…" }] }
  ]
}
```

`room` and `level` stay strings. Louvre rooms are labels, and one level is the word `Entresol`.

`titleEN` is carried in both languages so search can match a Latin query against a Ukrainian page.

Content is read-only, so nothing needs a database. Decode once in the `$lang` loader and hold it in memory.

## Pages

### Index

All 78 items, grouped by room in walking order, wing then level then room, the same order `assets/INDEX.md` uses. Grouped is the default and the only mode. A search box at the top filters as you type.

Search matches title in the current language, `titleEN`, `titleFR` and artist. Normalise both sides to lowercase and strip diacritics so `recamier` finds Récamier. At 78 items a plain substring filter over four fields is enough. No index library, no debounce.

Matching `titleEN` is what makes the bilingual case work. Someone reading in Ukrainian types `mona` off the wall label and still lands on Мона Ліза.

When the filter is active, drop the grouping and show a flat ranked list. Grouped results with one row per group read badly.

Each row gives the title, artist, room and a crowd badge. Room number matters most, because that is what you match against the wall.

### Item

Hero image with credit line, then the locator line with wing, level and room, then the sections in canonical order.

`lookFor` renders as a list with more space per item than the other sections, because it is the one you read while looking up and down.

Medium, dimensions, inventory number and licence collapse at the bottom. Reference, not reading.

Pinch-zoom on the image. Half the `Look for` bullets point at things invisible at page scale.

Previous and next links follow the same walking order as the index, so the item page works as a way to move through a room.

### Route guide

The stop table as the spine, one row per stop, with clock, room, minutes and the works at that stop linked to their item pages.

Then the prose sections around it, entrance advice, the shape of the day, what to drop when running out of steam.

Keep it readable on a phone held one-handed. The table is the thing people will actually look at mid-visit, so it goes first and the prose goes under it.

## Offline

Unchanged as a requirement, and simpler now that audio is gone.

A hand-written service worker over a precache list generated at build time. Cache-first with no network fallback on the read path. Museum wifi does not fail cleanly, it fails by answering.

Split the caching in two.

The install step precaches the shell, which is the HTML, JS, CSS, icons and both `content.{lang}.json` and `route.{lang}.json`. Under a megabyte, small enough that it never half-fails.

Images download through an explicit in-app button with a progress bar and a completion state, into a separate cache. Precaching 16 MB in an install event is the failure the old plan warned about, and that warning still holds.

Two SPA details the old plan did not have to handle.

The service worker must answer navigations for `/en/item/anything` from the cached shell, because those paths do not exist as files. Match on `request.mode === 'navigate'` and serve the cached `index.html`.

Cloudflare needs the same fallback for the first load, before a worker is installed. Cloudflare Workers static assets does this with `not_found_handling: "single-page-application"`.

Version the cache per build, let a new worker wait rather than calling `skipWaiting()`, and apply an update only when the user taps and only when online. During a visit the app should be frozen by design.

On every launch, compare the image cache against the expected list. If something is missing and you are online, offer to repair. If something is missing and you are offline, name the unavailable works up front rather than failing when one is tapped.

## Hosting

Cloudflare Workers with static assets, deployed with `wrangler deploy`, SPA fallback on.

Content-hashed filenames get `Cache-Control: public, max-age=31536000, immutable`. `index.html` and the service worker get `no-cache`. A stale cached service worker is the one reliable way to get permanently stuck on an old build.

Pick the hostname before the first install and never change it. Browser storage is scoped to the origin, and moving later orphans the cache rather than migrating it.

## Content to fix before building the route page

Three problems in `docs/visit-route.md`, all found by checking it against `assets/`.

It sends you to the Galerie d'Apollon for "the Régent diamond and the crown jewels". The jewels were stolen in October 2025 and the gallery reopened empty on 22 July 2026, which is what `assets/the-galerie-dapollon.md` says. The route contradicts the item it links to.

It lists David's Sabine Women and a stop for Islamic art on Denon -1. Neither has an item file, so neither can be linked. Either write the items or mark the stops as unlinked.

It has no Ukrainian translation, so `/uk/visit` has nothing to render.

Fix these in the content before wiring the page, not after.

## Build order

1. Scaffold. Vite, React, TypeScript, Tailwind, shadcn, TanStack Router. Deploy to Cloudflare and confirm a deep link like `/en/item/mona-lisa` survives a hard refresh. Prove the routing and the SPA fallback before writing features.
2. Content pipeline to `content.{lang}.json`, text only, with the validator wired in and failing the build.
3. Index page with search, both languages, language switch.
4. Item page, all sections, switch preserving the item.
5. Service worker, precached shell, airplane-mode test on the phone.
6. Images through the pipeline and onto the item page, with zoom, then the explicit download flow and the integrity check.
7. Route content restructured and translated, then the route guide page.
8. Dark theme, type scale, safe-area insets, one-handed pass on a real phone.

Step 5 sits before images deliberately. Offline is the requirement, so it gets tested while the payload is still small enough to debug.

## Tests worth having

The validator in step 2 covers content. Beyond it, two things are worth automating and nothing else is.

A build-time check that every `items` id in the route files resolves to a real item.

A smoke test that renders each of the 78 item pages in both languages and fails on a thrown error. 156 renders is cheap and catches a malformed section long before the gallery does.

Everything else is a manual pass. Airplane mode, force quit, relaunch from the home screen, open an item, switch language, open the route, follow a link from it.

## Known risks

Storage eviction is still the main one. Mitigated by installing to the home screen, keeping the payload near 16 MB, and checking integrity on every launch. Not eliminated.

The Ukrainian content is now load-bearing. It was proof-read as a print document, not as an app. Section structure is validated, but a bad line break or a too-long title in a narrow column will only show up on a phone.

Image licensing is a real obligation, not a formality. Twenty items need attribution. The build gate stops an unattributable image from shipping, but it cannot stop a redesign from deleting the credit line off a page. That one is on review.

Every claim about WebKit storage policy deserves a check on your actual phone and iOS version.

## Decisions taken

From the plan review on 20 September 2026.

The index is grouped by room. No flat mode.

`docs/visit-route.md` is deleted once `content/route.{lang}.md` replaces it.

Technical documentation is English only. The Ukrainian translation of the old design has moved to `uk/docs/archive/vanilla-offline-plan.md` and is not retranslated. `uk/` keeps translations of content and of the reader-facing README, not of engineering docs.

An image with an uncertain licence is dropped rather than shipped, enforced at build time by the table above.

All 78 images ship, including the 20 that need attribution. The credit line under each image is not decoration, it is the licence condition, and removing it puts the app out of compliance. The stricter public-domain-only policy was considered and rejected: it would have cost the hero image on twelve sculptures, three room interiors and the Pyramid to avoid printing a photographer's name.

`CLAUDE.md` is updated to match this plan rather than left contradicting it.

## Open decisions

None. The image question was settled on 20 September 2026: keep all 78 and render the credit line.
