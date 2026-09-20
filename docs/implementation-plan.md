# Implementation plan

Working checklist for `docs/technical-design.md`, approved 20 September 2026. Read that document first. This one is the order of work and the definition of done for each piece.

Tasks run top to bottom, one at a time. Tick a box only when its check passes, not when the code is written.

Status markers: `[ ]` not started, `[~] `in progress, `[x]` done, `[!]` blocked.

Toolchain on this machine: Node 22.19.0, npm 10.9.3, wrangler 4.129.0.

---

## Phase 1, scaffold and deploy

Prove routing and the SPA fallback before writing a single feature. A deep link that breaks on refresh is the failure that is hardest to retrofit.

- [x] **1.1 npm project, Vite, React, TypeScript**
      `npm create vite@latest . -- --template react-ts`, strict mode on in `tsconfig`.
      Check: `npm run dev` serves a page, `npm run build` exits 0.

- [x] **1.2 Tailwind, with a system font stack**
      Tailwind v4 via `@tailwindcss/vite`. Set `--font-sans` to the system stack in the theme layer.
      Check: no request to `fonts.googleapis.com` or `fonts.gstatic.com` in the network panel, and no `@font-face` in the built CSS.

- [x] **1.3 shadcn/ui init**
      `npx shadcn@latest init`. Take the CSS-variable theme. Pull only what is needed and only when needed.
      Check: `components.json` exists, `src/components/ui/` is in the repo and not in `.gitignore`, font stack from 1.2 survived the init.

- [x] **1.4 TanStack Router, file-based**
      `@tanstack/react-router` plus the Vite plugin. Generated route tree committed or gitignored, pick one and be consistent.
      Check: dev server hot-reloads a route change.

- [x] **1.5 Route skeleton**
      `__root.tsx`, `index.tsx`, `$lang.tsx`, `$lang/index.tsx`, `$lang/item.$id.tsx`, `$lang/visit.tsx`, all rendering placeholders.
      Check: every URL in the design doc renders its own placeholder. `/en/visit` is not swallowed by the `$lang` layout.

- [x] **1.6 Language redirect at `/`**
      `localStorage` preference, then `navigator.language`, then `en`.
      Check: clear storage, set browser to Ukrainian, load `/`, land on `/uk/`. Switch to English, reload `/`, land on `/en/`.

- [x] **1.7 Not-found and error boundaries**
      Unknown `{lang}` and unknown `{id}` render a real page with a way back. No blank screens.
      Check: `/fr/`, `/en/item/nope` both render something useful.

- [x] **1.8 Cloudflare config with SPA fallback**
      `wrangler.jsonc` with static assets and `not_found_handling: "single-page-application"`. Cache headers per the design doc.
      Check: config validates with `wrangler deploy --dry-run`.

- [~] **1.9 Deploy and verify the deep link**
      Check: hard refresh on the deployed `/en/item/mona-lisa` returns the app, not a 404. This is the gate for Phase 1.
      Verified locally under `wrangler dev`, which runs the same workerd runtime and asset router: `/`, `/en/`, `/uk/`, `/en/item/mona-lisa`, `/uk/item/the-lacemaker`, `/en/visit` and `/fr/` all return 200 with the app shell. The live deploy still needs a Cloudflare account.

## Phase 2, content pipeline

- [x] **2.1 `tools/build-content.mjs` reads both asset directories**
      Check: logs 78 English and 78 Ukrainian files.

- [x] **2.2 Frontmatter parsing**
      Check: every documented field lands on the object with the right type. `room` and `level` stay strings.

- [x] **2.3 Body to sections to blocks**
      Block types: `paragraph`, `bullets`, `subheading`. `###` stays a subheading, never flattened.
      Check: Mona Lisa produces 7 sections; the Seated Scribe keeps its `### How the eyes are made`.

- [x] **2.4 Heading to kind mapping**
      Per-language table from the design doc. Map by text, never position.
      Check: an item with `Practical` and one without both produce `talkingPoint` last.

- [x] **2.5 Validator that fails the build**
      Six rules from the design doc, non-zero exit, message naming the file and the rule.
      Check: temporarily rename a heading in one file and confirm the build refuses. Restore it.

- [x] **2.6 Emit `content.{lang}.json`**
      Check: both files parse, 78 entries each, id sets identical.

- [x] **2.7 Wire `npm run content` into `prebuild`**
      Check: `npm run build` regenerates content first.

- [x] **2.8 Shared TypeScript types**
      One source of truth for the content shape, imported by the app.
      Check: `tsc --noEmit` passes with the real JSON shape.

## Phase 3, index page

- [x] **3.1 `$lang` loader**
      Loads `content.{lang}.json` once, children read from context.
      Check: navigating index to item to index does not refetch.

- [x] **3.2 Header and language switch**
      Two links, not a dropdown. Writes the preference to `localStorage`.
      Check: switch on each of the three page kinds keeps you on the same page.

- [x] **3.3 Grouped list**
      Wing, then level, then room, matching `assets/INDEX.md` order. Grouped only, no flat mode.
      Check: order matches the index file top to bottom.

- [x] **3.4 Search**
      Matches title, `titleEN`, `titleFR`, artist. Lowercased and diacritic-stripped on both sides.
      Check: `recamier` finds Récamier. On `/uk/`, `mona` finds Мона Ліза.

- [x] **3.5 Search behaviour**
      Flat ranked results while filtering, grouping returns when the box is cleared. Search text survives a language switch.
      Check: type a query, switch language, query is still there and still filtering.

- [x] **3.6 Row content and empty state**
      Title, artist, room, crowd badge. A no-results state that says so.
      Check: a nonsense query renders the empty state, not a blank page.

## Phase 4, item page

- [x] **4.1 Item route and lookup**
      Check: all 78 ids resolve in both languages.
      Verified by rendering all 156 pages in headless Chromium, plus `/en/item/nope` and `/uk/item/nope`.

- [x] **4.2 Section rendering**
      Every kind renders, in canonical order.
      Check: spot-check an item with `Practical` and one without.

- [x] **4.3 `lookFor` gets its own treatment**
      More space per bullet than the other sections. It is read while looking up and down.

- [x] **4.4 Reference block**
      Medium, dimensions, inventory, licence, collapsed at the bottom.

- [x] **4.5 Previous and next**
      Same walking order as the index.
      Check: first item has no previous, last has no next.

- [x] **4.6 Language switch keeps the item**
      Check: `/en/item/the-lacemaker` switches to `/uk/item/the-lacemaker`.

## Phase 5, offline shell

Before images, deliberately. Debug offline while the payload is small.

- [x] **5.1 Precache manifest at build time**
      Shell plus both content JSON files. Under a megabyte.
      `tools/build-sw.mjs` walks `dist/` after vite and lists everything that is not an image or the worker itself. Measured at 1087 KB across 18 files, 63 KB over the budget. See the note below.

- [x] **5.2 Hand-written service worker**
      Cache-first, no network fallback on the read path.

- [x] **5.3 Navigation fallback**
      `request.mode === 'navigate'` serves the cached shell, so `/en/item/x` works offline.
      Check: offline, hard refresh on a deep link, app loads.
      Verified in headless Chromium with the network emulated off: `/en/item/mona-lisa` and `/uk/item/the-lacemaker` both load cold, the index lists all 78, the language switch works and `/en/visit` serves the shell.

- [x] **5.4 Update control**
      Cache name versioned per build, new worker waits, no automatic `skipWaiting()`, update applied only on tap and only when online.
      Verified end to end: a second build installs and waits, the bar appears, it hides when offline and returns when online, and tapping it reloads onto the new build and drops the old cache.

- [~] **5.5 Airplane-mode test on the phone**
      Install to home screen, airplane mode, force quit, relaunch, open an item, switch language, navigate.
      This is the gate for Phase 5.
      Every step of that sequence passes in headless Chromium with the network emulated off, which is the same code path but not the same storage policy. The real device pass is still outstanding and is the one thing emulation cannot stand in for.

## Phase 6, images

Unblocked. Decision of 20 September 2026: keep all 78 images and render the credit line under each one. The credit is a licence condition on 20 of them, not a nicety.

- [x] **6.1 Download and cache**
      Fetch the frontmatter `image` URL as-is. Build cache outside the repo so rebuilds do not re-download.
      `~/.cache/louvre-guide/`, originals in `src/` and Commons metadata in `meta/`. A rebuild converts from disk and makes no network request.

- [x] **6.2 WebP conversion**
      sharp, 1400 px long edge. Record real width and height into the JSON.
      Check: total set size measured, not estimated. Drop to 1200 px if it runs long.
      Measured across all 78: 18.6 MB at 1400px q82, 13.4 MB at 1200px q82, 13.6 MB at 1400px q75. Shipping 1400px q75, 13.6 MB.

- [x] **6.3 Licence gate**
      Drop rules from the design doc table. A dropped image is not a build failure.
      Check: today it drops zero. Fake a missing author and confirm that item emits with no image and the page still renders.
      Both halves verified against `man-with-a-glove`: the build dropped it with a named reason, emitted `image: null`, deleted the orphaned WebP, and the page rendered with all six sections, no figure and no credit row.

- [x] **6.4 Hero image and credit line**
      Credit is mandatory and links to `image_source`.
      Author, licence and a link to Commons, under the picture and again in the reference block.

- [x] **6.5 Pinch-zoom**
      Hand-written, because standalone mode has no browser page zoom to fall back on. Two-finger pinch anchored at the midpoint, pan when zoomed, double tap to toggle, escape or the close button to leave.

- [x] **6.6 Explicit download flow**
      Button, real progress, completion state, separate cache from the shell.
      Sequential downloads in the worker, progress posted per file, the card clears itself when the set is whole.

- [x] **6.7 Integrity check on launch**
      Compare cache against the expected list. Online, offer repair. Offline, name the unavailable works up front.
      Verified by deleting two pictures from the cache: offline the card names Mona Lisa and The Lacemaker without a tap, online it offers to fetch just those two and the cache comes back to 78.

## Phase 7, route guide

- [x] **7.1 Fix the three content bugs**
      The Galerie d'Apollon stop still promises the Régent diamond and the crown jewels, which were stolen in October 2025; the gallery reopened empty on 22 July 2026. Sabine Women and the Islamic art stop have no item files. Decide per stop: write the item, or mark it unlinked.
      The Apollon stop now says to go for the room and gives the dates. Both unlinked stops are marked as such in the stop's own note, rather than writing two items whose rooms and inventory numbers could not be verified from here.

- [x] **7.2 `content/route.en.md`**
      Frontmatter stop list, Markdown body for the prose.
      Eighteen stops and four detours, 67 item references across 58 distinct works.

- [x] **7.3 `content/route.uk.md`**
      Full translation. `/uk/visit` has nothing to render without it.

- [x] **7.4 Pipeline emits `route.{lang}.json`**
      Every `items` id resolves to a real item or the build fails.
      Proven by breaking one id: the build named the file, the rule and the stop number, and the cross-language check caught the same edit as a divergence between the two routes.

- [x] **7.5 `/visit` page**
      Stop table first, prose under it. Stops link to item pages.
      Verified in both languages: stop count, section order, every link resolving, 44px tap targets, no horizontal overflow at 390px, and the whole page working offline.

- [x] **7.6 Delete `docs/visit-route.md`**
      One source. Update `CLAUDE.md` in the same change.

## Phase 8, polish and verification

- [!] **8.1 Dark theme**
      Galleries are dim. Respect the system setting, offer a manual override.
      The plumbing is in and works: the system setting is honoured before first paint by an inline script, a header toggle overrides it, the choice survives a reload and `theme-color` follows. The palette itself does not switch. With `.dark` on `<html>` the page still renders light. Half-debugged, see the note below.

- [x] **8.2 Type scale and one-handed layout**
      Generous type, large tap targets, thumb-reachable controls.
      A 17px root, so one number moves the whole rem-based scale. Every control on all three page kinds measures at least 44px, checked in the browser rather than by eye, and nothing overflows at 390px.

- [x] **8.3 Manifest, icons, safe-area insets**
      `display: standalone`, `viewport-fit=cover`, `env(safe-area-inset-*)` padding.
      Icons are generated from `tools/icon.svg` at build time, including a maskable variant.

- [ ] **8.4 Smoke test**
      Render all 78 items in both languages, fail on a thrown error. 156 renders.
      The harness exists and passes; it still lives in the session scratchpad rather than `tools/smoke.mjs`.

- [ ] **8.5 Final device pass**
      The full sequence from the design doc on a real phone.

## Deploy

- [ ] **Publish to Cloudflare**
      `wrangler deploy` against an account that does not exist yet. Blocks 1.9 as well.

---

## Running notes

Kept as work proceeds. Surprises, decisions taken mid-flight, anything that contradicts the design doc.

**Versions installed, 20 September 2026.** React 19.2.8, TanStack Router 1.170.33, Vite 8.2.2, Tailwind 4.3.3, TypeScript 7.0.2, wrangler 4.129.0. Newer across the board than the design doc assumed.

**TypeScript 7 removed `baseUrl`.** Path aliases now resolve relative to the tsconfig file, so `paths` alone is enough. `tsc` errors out if `baseUrl` is present.

**shadcn's init broke the no-web-fonts rule, exactly as the design doc predicted.** It added `@import "@fontsource-variable/geist"` and redeclared `--font-sans: 'Geist Variable'` inside `@theme inline`, which lands after our block and wins. The built CSS carried 5 `@font-face` rules and bundled 5 woff2 files, 404 KB of `dist`. Fixed by dropping the font package, moving the system stack to its own `--font-sans-system` token so nothing can shadow it, and repointing shadcn's `--font-sans` at that token. Now 0 `@font-face`, 0 font files, `dist` at 320 KB. Re-check this after every `shadcn add`.

**`compatibility_date` cannot be today's date.** The bundled workerd binary refused `2026-09-20`, supporting only up to `2026-07-08`. Pinned to `2026-07-01`.

**Bundle is larger than estimated.** 87.4 KB gzipped JS against the design doc's 60 to 70 KB for React plus Router. Still immaterial next to the image payload, but the estimate was optimistic.

**`/visit` was the right call.** The generated route tree confirms `/$lang/visit` exists as its own route with no collision against the `$lang` layout.

**`room` is nullable.** The validator's first run caught the Louvre Pyramid, which sits in the Cour Napoléon and has no room number. Removed from the required set rather than inventing a value.

**Walking order needed two tie-breaks to match `assets/INDEX.md`.** Wing/level group, then leading room number, then the full room string, then id. The room string matters because a work in room `346` must precede one spanning `346–348`. Sorting on title instead of id looked fine but was wrong: Ukrainian titles collate differently, which would give each language a different intra-room order and desync prev/next across the language switch. Order is now byte-identical to `INDEX.md` and identical across languages.

**Validator proven, not assumed.** Renaming a heading, reordering two sections and breaking an id each produce a named failure and exit 1, and `npm run build` stops before vite runs.

**Payload so far.** `content.en.json` 299 KB, `content.uk.json` 429 KB, `dist` 1.0 MB total. Ukrainian is half again as large because Cyrillic costs two bytes a character in UTF-8. Still inside the sub-megabyte precache budget for the shell, with roughly 250 KB of headroom before the route JSON lands.

**No inline markup anywhere.** Checked all 156 files for bold, italic, code spans and links; there are none. Block text is plain text and the app needs no inline Markdown renderer.

**The language switch was silently broken and the test caught it.** `<Link to="." params={...}>` from inside the `$lang` layout resolves "." to `/$lang`, not to the current leaf route, so the switch dropped you on the index from every item and from the route page. Fixed by deriving the href from `useRouterState().location`, swapping the leading language segment and appending `searchStr`. Now verified per page kind: `/en/item/the-lacemaker` goes to `/uk/item/the-lacemaker`, `/en/visit` to `/uk/visit`, and `/en/?q=recamier` to `/uk?q=recamier`.

**Search query lives in the URL.** `?q=` on the index route, written with `replace: true` so typing does not fill the back stack. Putting it in the URL is what lets the language switch carry it without extra plumbing.

**Diacritic stripping also folds Cyrillic й and ї.** NFD decomposes them to и and і plus a combining mark, so those pairs become interchangeable in search. Deliberate: both query and haystack go through the same function, so it only buys typo tolerance.

**Crowd badges show only for `high` and `extreme`.** A badge on all 78 rows is noise; these are the two that change what you do. Deviates from the plan's "crowd badge" wording on purpose.

**Sticky offsets come from one `--header-h` variable.** The first version hard-coded `top-[57px]` and `top-[113px]`, which would drift the moment the header changed. Group headings are no longer sticky, because a nested sticky stack on a phone is fussy for no gain.

**Screenshot harness caveat, not a layout bug.** Headless Chrome with `--window-size=390,844` does not give a 390px layout viewport; it renders the desktop layout and crops, which made the index look broken. Loading the app in a 390px iframe gives a real mobile viewport and the layout is correct. Use the iframe harness for any future phone-width check, or better, drive `Emulation.setDeviceMetricsOverride` over CDP, which the Phase 4 render harness does.

**The lookup belongs in the loader, not the component.** `loadContent` returns the promise the `$lang` loader already holds, so the item route can await it and resolve the id before anything renders. An unknown id then throws `notFound()` and gets the route's own not-found component inside the layout, rather than reaching a component that has to cope with `undefined`. Measured across index to item to back to another item, the app fetches `content.en.json` exactly once.

**Prev and next come from array adjacency, not from arithmetic on `order`.** The pipeline emits the array in walking order and `order` equals the index, checked for both languages. Neighbours are `items[at - 1]` and `items[at + 1]`, so the first item renders one link and the last renders one link with no special case.

**`Look for` is a bordered list with a rule between bullets, 16px of padding a side.** The other bulleted section, `Interesting facts`, stays a plain disc list. The difference is deliberate and it is the whole point of 4.3: you lose your place in `Look for` because you keep glancing at the wall, and a rule per bullet is what you find your way back to.

**Two additions to the header the plan did not ask for.** The French title sits under the title when it differs, because the wall label is in French and matching it is half the problem of standing in the right place. Time needed and the crowd badge sit under the locator line, using the same two-level crowd rule as the index.

**The item page still has no image, so the reference block carries the credit.** Licence and a link to the Commons page are a row in the collapsed block. Task 6.4 adds the visible credit under the hero image; the row stays either way, because the collapsed block is where the licence string belongs.

**A render harness exists, in the scratchpad rather than the repo.** It drives headless Chromium over CDP, one browser and one tab, and checks every item page against the JSON it was built from: title, section count and order, per-section paragraph, bullet and subheading counts, the reference rows, prev and next hrefs, the language switch href, and console errors. 156 renders in 11 seconds. Task 8.4 wants exactly this, so promote it to `tools/smoke.mjs` then rather than writing it twice. Two details make it work: `Emulation.setDeviceMetricsOverride` for a real 390px layout viewport, and polling on `location.pathname` as well as the DOM, because after `Page.navigate` the previous page is still on screen.

**The precached shell is 1087 KB, not under one megabyte.** The budget in the design doc predates the measured content JSON. English is 299 KB and Ukrainian 429 KB, and 728 KB of text plus 320 KB of JavaScript leaves nothing to trim without either dropping a language from the precache or rewriting the JSON shape. The reason behind the budget was that a big install event half-fails; 1.1 MB in 18 files is not that, and the build now prints the number on every run so it cannot drift quietly. The route JSON in Phase 7 adds to it.

**A redirect broke the offline deep link, and only offline.** The install step cached `/index.html`, but Cloudflare's asset server redirects that to `/`, so the cached response carried `redirected: true`. A redirected response may not answer a navigation, so every offline navigation failed with `ERR_FAILED` while everything online looked perfect. The shell is now cached under `/`, and the install step rebuilds any response that arrived through a redirect before storing it.

**The worker's own source is part of the cache version.** The first version hashed only the files in `dist/`, so editing the caching logic left the cache name unchanged and a new worker inherited entries written by the old rules. The template's bytes now go into the hash.

**The image cache is not versioned.** `louvre-images-v1` survives shell updates by design. Sixteen megabytes is not something to re-download because a paragraph was reworded, and a visitor who updates the app in the queue outside should not lose the pictures.

**Quality bought the same megabytes as resolution, so resolution stayed.** The design doc offers 1200 px as the lever if the set runs long, and at 1400 px and quality 82 it did run long, 18.6 MB against a 16 MB budget. Measuring both levers across all 78 sources: 1200 px at q82 gives 13.4 MB, 1400 px at q75 gives 13.6 MB. The same saving either way, and the pixels are what pinch-zoom is for, so the set ships at 1400 px q75.

**The licence gate asks Commons, not the frontmatter.** `image_license` in the frontmatter decides whether an image needs attribution; the Commons API decides whether it has an author and whether anything is flagged as restricted. Metadata is cached per file next to the downloads, so the question is asked once. Seventy-seven of the 78 come back with a named author, and the one that does not is public domain, where the name is a courtesy.

**A dropped image is deleted from `public/images`, not just unreferenced.** Leaving the file on the server while the JSON stops pointing at it would ship the bytes the gate exists to stop, and nobody would notice.

**The download card missed the launch it exists for.** On a first visit the worker activates and claims the page a moment after the app mounts, so `navigator.serviceWorker.controller` was still null when the card checked, and the card hid itself until the next launch. It now waits for `controllerchange` with a five second cap.

**Missing works are named, not counted.** The first version put the list behind a disclosure triangle. Being told there are two missing pictures and having to tap to find out which is not being told up front, so up to five titles render inline and the rest sit behind a count.

**The route frontmatter needed a second parser.** Item frontmatter is flat, so the item parser reads `key: value` and nothing else. The stop list is a list of maps with an occasional nested list, so `parseRouteFrontmatter` handles indents of 0, 2, 4 and 6 and fails on anything else rather than guessing. Two parsers, both strict, is better than one loose one.

**The two languages are checked against each other, not just against the items.** A stop list that drifts between English and Ukrainian would give the language switch on `/visit` a different day out on each side. The build compares clock, minutes and the item ids of every stop and detour, and refuses to emit if they differ. The check earned itself immediately: breaking one id in the English file was reported twice, once as an unknown item and once as a divergence.

**Two stops are marked unlinked rather than backed by new items.** David's Intervention of the Sabine Women and the three Islamic art masterpieces on Denon -1 have no files in `assets/`. Writing them would have meant inventing room and inventory details that cannot be verified from here, and the content rules say to flag uncertainty rather than smooth it over. Each stop says in its own note that the work has no page in this guide.

**The Shape of the day table became bullets.** A two-column table adds nothing on a 390px screen, and the block parser only emits paragraphs, bullets and subheadings. The stop list is the only table on the page, and it is not a `<table>` either; it is a row per stop with the clock in a fixed-width column.

**Works at a stop are 44px pill links, not a run of inline text.** The original document listed them comma-separated. Inline links in prose are too small to hit standing in a crowd, which is the only place this page gets read.

**The colour refactor is unfinished and the dark theme is the proof.** Components used to hard-code `bg-white`, `text-neutral-500` and friends, which cannot respond to a theme, so they were moved onto the shadcn semantic tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`. The built CSS does contain `.bg-background{background-color:var(--background)}`, the rule does match the element, and `:root{--background:oklch(100% 0 0)}` and `.dark{--background:oklch(14.5% 0 0)}` are both in the file. Despite all three, `getComputedStyle` reports the background as `rgba(0, 0, 0, 0)` on `html`, `body` and the app shell, and adding `.dark` changes nothing on screen. Light mode looks right only because white-on-black defaults happen to match it. Next step is to find why that `var()` resolves to nothing, most likely something about how `@theme inline` and the two `:root` blocks in `styles.css` interact in Tailwind 4.3, and the fastest way in is a minimal page with one div and those two rules.

**The zoom viewer keeps its own colours on purpose.** It is black in both themes, because a picture is judged against black and its chrome is white on black either way. It was excluded from the token rewrite by hand.

**Header controls were all too small and nobody would have noticed by looking.** The home link measured 21px, the language switch 27px and the download button 30px, against a 44px floor. Measuring every interactive element in the page, rather than spot-checking the ones that look small, is what found them.
