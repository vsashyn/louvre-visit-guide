# Louvre guide

A mobile guide app for visiting the Louvre. A visitor picks an artwork and gets the history behind it in text and images, in English or Ukrainian.

## What the app has to do

- Work fully offline. Museum wifi and cell service inside the galleries are unreliable, so everything the visitor needs is downloaded before the visit and read from local storage. No network call is allowed on the critical path of viewing an item.
- Carry text and one image per item. No audio. Narration was planned and dropped; see `docs/technical-design.md`.
- Let the visitor select an item and explore it in depth. Selection can come from browsing, searching, or walking a room, and it opens the full story, not a caption.
- Fit one-handed phone use in a crowded room. Short reading sessions, large tap targets.
- Work in English and Ukrainian. Every item page exists in both, with a switch between them that keeps you on the same item.

## Repository layout

- `assets/` holds the content, one Markdown file per item. 78 exist, covering all three wings: paintings, sculpture, objects and rooms. `assets/INDEX.md` is a generated table of all of them, grouped by wing and level.
- `docs/technical-design.md` is the implementation plan. Read it before writing app code.
- `content/` holds the prose that is not about a single work. `route.{lang}.md` is the curated full-day route, one file per language. Frontmatter carries the stop list, the body carries the prose around it. The pipeline emits `route.{lang}.json` and fails the build if a stop points at an id that has no item, or if the two languages describe different walks. `offline.{lang}.md` is the setup guide for getting the app onto a phone, emitted the same way.
- `docs/archive/` holds superseded plans. Reference only, do not build from it.
- `src/` is the app, `tools/` the build scripts, `public/` the generated JSON and WebP images. `dist/` is the deployable output.
- `.claude/` holds Claude Code settings.
- `uk/` holds the Ukrainian content. `uk/assets/` mirrors `assets/` file for file with the same ids, plus a translated `README.md` and `CLAUDE.uk.md`. Technical documentation is English only and is not translated; superseded translations sit in `uk/docs/archive/`. English stays the source of truth, and `uk/README.md` records the section-heading mapping the content pipeline needs.
- `Louvre-Guide-UK.pdf` is the whole Ukrainian guide as one printable document, generated from `uk/assets/` by `tools/build-pdf.py`. It is not tracked in git; regenerate it rather than looking for it in a fresh clone.

## Stack

An offline-first web app on React, TanStack Router, Tailwind and shadcn/ui, built with Vite, hosted as a static site on Cloudflare and installed to the iPhone home screen where it runs standalone. No web fonts and no third-party requests at runtime. shadcn copies component source into the repo, so it costs bundle bytes and nothing else. An earlier native iOS plan and an earlier vanilla-JS plan were both dropped; see `docs/archive/`.

Four kinds of page. An index at the root with search over all items, one page per item per language, a route guide page, and a setup page at `/{lang}/offline` that explains how to install the app and download the pictures. Language is a path segment, so `/en/item/mona-lisa` and `/uk/item/mona-lisa` are the same work in two languages and the switch is one link.

`assets/`, `uk/assets/` and `content/route.{lang}.md` are the source of truth. `tools/build-content.mjs` turns them into `content.{lang}.json`, `route.{lang}.json` and WebP images. The app never parses Markdown at runtime. Images download into `~/.cache/louvre-guide/`, so a rebuild converts from disk and touches the network only for something it has never seen.

Offline is the hard requirement, not a feature. A hand-written service worker serves everything cache-first with no network fallback, and answers SPA navigations from the cached shell. The shell and the JSON precache at install; images download through an explicit in-app button into a separate cache, because precaching 16 MB in an install event is how that step fails. `docs/technical-design.md` has the reasoning and the rest of the tactics, and `docs/implementation-plan.md` tracks what is built and what each decision cost.

## Content format

Each file in `assets/` is Markdown with YAML frontmatter. The filename matches the `id`.

Frontmatter fields: `id`, `title`, `title_fr`, `artist`, `artist_dates`, `date`, `medium`, `dimensions`, `inventory`, `department`, `wing`, `level`, `room`, `gallery`, `category`, `tags`, `time_needed`, `crowd`, `image`, `image_source`, `image_license`.

`image` is a Wikimedia Commons thumbnail URL, `image_source` the description page that names the photographer, `image_license` the licence string. Anything not public domain needs attribution wherever the app shows it.

Point `image` at a thumbnail, never a full-size original. upload.wikimedia.org rate-limits originals and starts returning 429 after a few dozen fetches; the thumbnail hosts do not. 1600px where available, smaller where the source file is narrower, which matches the main-image size the technical design asks for anyway.

If an image's licence does not resolve, or needs attribution and has no named author, or carries a usage restriction, drop the image rather than ship it. The item renders without one. The build enforces this.

Body sections, in this order:

1. `# Title`, then a one-line locator with artist, date, wing, level and room.
2. `## In one line`
3. `## What you are looking at`
4. `## The story`
5. `## Look for`
6. `## Interesting facts`
7. `## Practical`, only when the room needs advice about queues or timing.
8. `## Talking point`

Keep new files to this shape. The pipeline maps each heading to a stable section kind through a per-language table and fails the build on an unknown heading, so renaming or reordering breaks downstream work. Map by heading text, never by position: `Practical` appears in only 13 of 78 files, so section indexes differ between items.

## Writing the content

The existing files set the voice. Match it.

- Concrete facts with names, dates and places. "A note by the Florentine clerk Agostino Vespucci in October 1503", not "scholars believe".
- Write for someone standing in the room, tired and surrounded by people. Tell them where to look.
- No art-history jargon without an immediate plain gloss.
- `Look for` items are physical things visible on the surface, not interpretation.
- Rooms, inventory numbers and dates must be verifiable. Flag anything uncertain rather than smoothing it over.
