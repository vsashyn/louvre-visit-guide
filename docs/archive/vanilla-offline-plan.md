# Louvre guide technical design (superseded)

The vanilla-JS, audio-first plan. Written 19 September 2026, superseded 20 September 2026 by `docs/technical-design.md`, which moves to React and TanStack Router and drops audio. Reference only, do not build from it.

## What this is

A static site on Cloudflare that you add to your iPhone home screen, where it runs standalone and works with the radio off. Everything it needs downloads once, before the trip, and it never touches the network in a gallery.

Moving off native trades a signing dance and a yearly fee for a browser storage problem. The trade is worth making, but the storage problem is real, and most of this document is about beating it.

Out of scope, same as before. No accounts, no analytics, no sync, no sharing, no desktop layout worth fussing over.

## Hosting

Cloudflare Workers with static assets, deployed with `wrangler deploy`. Cloudflare Pages does the same job and gives you git-push deploys if you prefer them. For a site this small the two are interchangeable, so choose on deploy ergonomics rather than capability, and check which one Cloudflare's docs currently favour before committing the config. The free tier covers all of it with room to spare.

Two hosting details actually matter, and both are about caching.

Serve content-hashed filenames with `Cache-Control: public, max-age=31536000, immutable`, and serve `index.html` and the service worker with `no-cache`. A stale cached service worker is the one reliable way to get permanently stuck on an old build.

Pick the final hostname before the first install, and never change it. Browser storage is scoped to the origin. Moving from `louvre.pages.dev` to your own domain later does not migrate the cache, it orphans it, and you re-download everything onto a phone you may not be near. Buy the domain first if you want one.

## Stack

Vite, vanilla JavaScript, no framework.

The app is four screens, a list, a detail page and an audio player. A framework would buy state management we do not have. Everything in the bundle has to be cached, parsed and run offline on a phone, so the smallest honest bundle wins. If components start feeling necessary, Preact is the escape hatch at a few kilobytes, not React.

No web fonts. The iOS system stack renders San Francisco at zero bytes and zero requests. Google Fonts is a network dependency dressed as a stylesheet.

The service worker is hand written, roughly a hundred lines, over a precache list generated at build time. Workbox would generate that for you and would also put a layer of abstraction between you and the one failure mode that ruins the trip. Debugging a service worker from a museum queue is not a thing you want to do.

The content pipeline is a Node script run on the Mac with `npm run content`. It never ships, and it keeps the whole project in one language.

## Architecture

```
assets/*.md              hand-written content, the source of truth
   |
   |  tools/build-content.mjs  (runs on your Mac)
   v
public/
  content.json           structured text, metadata, audio offsets
  audio/<id>.m4a         one narration track per artwork
  images/<id>-*.webp     artwork photographs
   |
   |  vite build  ->  dist/ plus a generated precache manifest
   v
Cloudflare               static hosting, touched once per visit at most
   |
   |  explicit in-app download into the Cache API
   v
iPhone home screen app   reads only from local cache
```

## Offline strategy

This is what decides whether the app works in the Salle des États. Eight tactics, roughly in order of importance.

### Install it to the home screen

Not a bookmark, not a Safari tab. Added to the home screen it runs standalone without browser chrome, and iOS treats its storage more generously and more durably than a regular site's. Set `display: standalone` in the web manifest alongside `apple-mobile-web-app-capable`, ship real icons, and use `viewport-fit=cover` with `env(safe-area-inset-*)` padding so it sits correctly under the notch.

One WebKit detail deserves a check on your own phone rather than trust in me. A home screen web app may get storage isolated from Safari's, which would mean anything downloaded while browsing in Safari does not exist inside the installed app. Whether or not that still holds, the safe habit is identical. Install first, then download from inside the installed app.

### Download on purpose, with a progress bar

Do not rely on the service worker's install event to quietly pull twenty megabytes. Put a Download for offline button on the first screen that fetches every artwork, writes it into the Cache API, and shows real progress and a real completion state. The user needs to know the app is ready, and the only way to know is to be told.

Keep a manifest of what was downloaded and when, and show it on the home screen as a line like "All 12 works ready, checked 3 days ago". That line is the difference between finding a problem at home and finding it in a queue.

### Never let the network into the read path

The service worker serves content cache-first with no network fallback at all. Not stale-while-revalidate, not network-first-with-timeout. If something is missing, the app says so and offers to fetch it, rather than hanging on a captive portal that intercepted the request and answered with a login page.

Museum wifi does not fail cleanly. It fails by answering.

### Play audio from blob URLs, not through the service worker

This is the trap that catches most offline audio apps on Safari. An `<audio>` element requests media with a Range header and expects a 206 Partial Content response. A service worker answering from `cache.match()` hands back a complete 200, and Safari handles that badly, especially once you seek.

Sidestep it. Read the file out of the Cache API as a blob on the main thread, wrap it with `URL.createObjectURL()`, and set that as the audio source. Seeking works, no Range negotiation happens, and at a megabyte or two per track the memory cost is nothing. Revoke the object URL when you move to another artwork.

### Keep the payload small enough that quota never comes up

Encode narration as mono AAC at 48 kbps with `afconvert -f m4af -d aac -b 48000`. Speech needs no more, and afconvert ships with macOS so the pipeline stays free of ffmpeg and Homebrew. At roughly four minutes a work that is about 1.4 MB, so twelve works land near 17 MB. `-d aach -b 32000` gives HE-AAC at half the size if you want it smaller.

Encode images as WebP through sharp, 1600 px on the long edge for the main image and 1200 px for detail crops. Figure 600 KB per artwork, so about 7 MB in total. AVIF is smaller again and needs more tooling than it earns here.

That puts the whole library near 25 MB. Every iOS storage limit worth worrying about sits far above that, which turns quota from a design constraint into a non-issue. This is the cheapest reliability win available.

### Assume storage can vanish, and check for it

Call `navigator.storage.persist()` on install. Chrome honours it. Safari's support is inconsistent and may quietly return false, so treat a grant as a bonus and never a guarantee. `navigator.storage.estimate()` is useful for showing how much is actually resident.

WebKit evicts script-writable storage from sites you have not used in a while, and a home screen app keeps its own usage clock. An app installed in March and opened in September is exactly the shape that gets evicted.

So verify instead of assuming. On every launch, compare the cache against the expected file list. If something is missing and you are online, offer to repair it. If something is missing and you are offline, name the unavailable works up front instead of failing when one is tapped.

Then build one habit into the routine. Open the app the night before you fly, on wifi, and let it confirm it is whole.

### Control updates, do not accept them

Version the cache name per build. When a new service worker installs, let it wait. Do not call `skipWaiting()` automatically, because swapping the running app for a half-fetched new version on hotel wifi is a failure with no upside.

Show an Update available note and apply it only when the user taps, and only when online. During a visit the app should be frozen by design.

### Build the shell to survive a cold start

Precache the HTML, CSS, JS, icons and `content.json` in the service worker install step, and keep that set small enough that it never partially fails. Inline the critical CSS. No third-party requests anywhere, ever, not for fonts, not for analytics, not for an icon set.

Test it the only way that counts. Airplane mode, force quit, relaunch from the home screen icon, open an artwork, play the audio, seek it, lock the phone, resume from the Lock Screen. Anything short of that sequence has not been tested.

## Playback on the Lock Screen

Wire up the Media Session API so title, artist and cover appear on the Lock Screen with working transport controls. Safari supports it, and it is what lets the phone go in a pocket while the narration plays.

Be honest about the limit. Background audio from a web app on iOS is less bulletproof than a native `AVAudioSession`, and a hard backgrounding can stop playback in ways a native app would survive. If that turns out to be what breaks the experience, it is the one genuine argument for going back to native. Test it at step 6, before building a player on top of it.

Consider the Screen Wake Lock API for the reading view so the screen does not sleep mid-paragraph while you look up at the painting.

## Content pipeline

`tools/build-content.mjs` does four jobs.

It parses each file in `assets/`, turning frontmatter into metadata and splitting the body on `##` headings into the fixed section list recorded in CLAUDE.md. Paragraphs and bullet lists become separate block types so the app lays them out properly instead of rendering Markdown at runtime.

It renders narration, one text-to-speech request per section, returned as PCM.

It assembles one track per artwork, parsing each WAV header and joining the PCM payloads, which also yields the exact start offset of every section. That is about thirty lines of `Buffer` work and needs no dependency. Those offsets go into `content.json`, and they are what let the detail screen highlight the section being narrated and let you tap a heading to seek to it.

It encodes and writes output into `public/`, AAC for audio and WebP for images.

The script is content-hashed and idempotent, so re-running it only re-synthesises artworks whose text changed.

### Which voice

Pre-generate every track through OpenRouter and ship the finished audio. Synthesis runs on the Mac at build time, so the phone never calls a model. Check that the voice you want is reachable through a speech endpoint there, since OpenRouter's core business is routing text models; if it is text-only, call that speech provider directly. A full run over twelve files is roughly 120,000 characters, a couple of dollars at typical rates.

Keep a macOS `say` path behind a flag so the pipeline still runs with no network and no API key. Download an enhanced voice in System Settings under Accessibility, Spoken Content, then `say -v <voice> -o out.aiff --data-format=LEF32@22050`.

Do not synthesise in the browser with the Web Speech API. Voices vary by device, and you cannot fix a mangled "Giocondo" without shipping a workaround.

### Images

Source photographs from collections.louvre.fr, matching on the inventory numbers already in the frontmatter. The paintings are centuries out of copyright. The photographs can carry their own terms, which for a private app on one phone is not a practical concern, though it is a reason to keep the site unlisted rather than promoted.

Store a main image per artwork plus a few detail crops keyed to the `Look for` bullets, so the app can show the thing the text points at.

## Data shape

`content.json` holds an array of artworks.

```json
{
  "id": "mona-lisa",
  "title": "Mona Lisa",
  "titleFR": "La Joconde",
  "artist": "Leonardo da Vinci",
  "artistDates": "1452-1519",
  "date": "c. 1503-1519",
  "medium": "Oil on poplar panel",
  "dimensions": "77 x 53 cm",
  "inventory": "INV 779",
  "location": {
    "department": "Paintings",
    "wing": "Denon",
    "level": 1,
    "room": "711",
    "gallery": "Salle des États"
  },
  "tags": ["must-see", "renaissance", "leonardo", "portrait"],
  "timeNeeded": "10 min",
  "crowd": "extreme",
  "sections": [
    {
      "id": "mona-lisa--in-one-line",
      "kind": "inOneLine",
      "heading": "In one line",
      "blocks": [{ "type": "paragraph", "text": "A silk merchant's wife..." }],
      "audioStart": 0
    }
  ],
  "images": [{ "src": "images/mona-lisa-main.webp", "width": 1600, "height": 2310, "kind": "main" }],
  "audio": { "src": "audio/mona-lisa.m4a", "duration": 268.4, "bytes": 1470000 }
}
```

`room` stays a string. Louvre rooms are labels, not numbers.

Content is read-only, so nothing needs a database. Decode `content.json` once at launch and hold it in memory.

Visit state is the only mutable data and it is small. Saved works, works already heard, last playback position per track. `localStorage` covers it, and it can be evicted like everything else. Nothing in it is worth a recovery mechanism.

## Screens

Rooms is the default. Wing, then room, then the works in it, because that is how you move through the building.

All works is the flat searchable list, matching title, French title and artist, because the wall label next to you gives you a title and nothing else.

Saved is what you marked before the trip.

Artwork detail is the app. Hero image, locator line, play button, then the sections in their fixed order. A mini player stays docked at the bottom while you scroll or navigate. The active section highlights as the audio moves through it, and tapping a heading seeks to that offset. `Look for` renders as a checklist against its detail crops. Medium, dimensions and inventory number collapse at the bottom, since they are reference rather than reading.

Two things to build in from the start. Generous type and a true dark theme, because galleries are dim and you read standing up. Pinch-zoom on images, since half the `Look for` bullets point at details invisible at page scale.

## Build order

1. Vite project, manifest, icons, deployed to Cloudflare and added to the home screen. Prove the install loop before writing features.
2. `build-content.mjs` through to `content.json`, text only, no media.
3. Screens reading real text, still online only.
4. Service worker, precached shell, airplane mode test.
5. Images in the pipeline and in the app, with the zoom viewer.
6. Audio in the pipeline, blob URL playback, Media Session, Lock Screen test.
7. Explicit download flow, progress, integrity check, repair.
8. Section offsets wired to highlighting and tap to seek.
9. Visit state, saved works, resume position.

Step 4 sits where it does deliberately. Offline is the requirement, so it gets tested early rather than last.

## Known risks

Storage eviction is the main one, mitigated but not eliminated by installing to the home screen, keeping the payload near 25 MB, and checking integrity on every launch.

Background audio on iOS Safari is weaker than native. Verify at step 6 before building the player out.

iOS standalone web apps have had rough edges around navigation state and relaunch behaviour. Keep routing simple, keep state recoverable from `localStorage`, and assume a relaunch can happen at any moment.

Every claim here about current WebKit storage policy deserves a check on your actual phone and iOS version. Apple changes this area more than any other, and the web is full of confidently wrong answers from three policy revisions ago.

## Open decisions

Which voice, once you have heard a few read the Mona Lisa file end to end. Judge on proper nouns, because the content is full of them. The pipeline treats synthesis as one swappable function, so it blocks nothing before step 6.

Whether to buy a domain. Not required, but the origin is permanent in a way that matters here, so decide before the first install rather than after.
