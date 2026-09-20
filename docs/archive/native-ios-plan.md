# Louvre guide technical design

How we build the app. Written 19 September 2026 against the toolchain on this Mac, macOS 26.6.2, Xcode 26.6, Swift 6.3.3.

## Scope

One iOS app, installed on one phone, never published. It ships with every artwork it will ever need already inside it. There is no server, no account, no sync and no download step. A visit consists of opening the app in a gallery, finding the work in front of you, reading, and listening.

Anything that would only matter for an app with other users is out of scope. No analytics, no onboarding, no crash reporting, no localisation beyond the French titles already in the content, no iPad layout.

## Distribution and signing

Install the app on your phone as a development build from Xcode. Two ways to sign it, and the only difference between them is how long a build keeps running.

The free option costs nothing. Sign in to Xcode with your ordinary Apple ID and it creates a Personal Team. Xcode builds and installs straight to a cabled phone, and you trust the certificate once in Settings under General, VPN & Device Management. The catch is that the provisioning profile lasts seven days. On day eight the app refuses to launch and you have to plug into the Mac and rebuild. There is also a cap on how many apps one Personal Team can have installed at a time.

The seven days count from the build, not from the install, and reinstalling over the same bundle ID upgrades in place rather than wiping saved works and playback positions. So rebuilding on the morning you fly out covers a week-long trip, and the free tier is enough for a single visit.

The paid option is the Apple Developer Program at 99 USD a year. Development profiles last a year instead of a week, so the app keeps working with no Mac in sight. Nothing goes through App Review, nothing appears on the App Store.

Build free. Pay the 99 when the seven-day rebuild starts costing more attention than the money does, which happens the moment a trip runs past a week, the app becomes something you carry rather than something you take, or you want it on a second phone. Either way the app itself is identical, so this decision blocks nothing and can be made late.

TestFlight is a third path, and not a good one here. It needs the paid account anyway, it puts an App Store Connect upload between you and the phone, and builds expire after 90 days. A development profile is simpler and lasts longer.

Signing has one more consequence worth naming now. Because the app is only ever a development build, nothing forces us to support old iOS versions. Set the deployment target to iOS 26, matching the phone, and use the current SwiftUI without back-compatibility branches.

## Stack

Swift 6 and SwiftUI, no third-party packages in the app target.

SwiftUI is the right call over UIKit here. The app is lists, a detail page, a search field and a player bar. That is SwiftUI's core competence, and it gets Dynamic Type, dark mode and VoiceOver mostly for free, which matters in a dim gallery.

Audio uses AVFoundation and MediaPlayer from the system frameworks. AVAudioPlayer plays a local file, AVAudioSession in the `.playback` category with `.spokenAudio` mode keeps it going when the screen locks, and MPNowPlayingInfoCenter plus MPRemoteCommandCenter put the artwork title and transport controls on the Lock Screen so the phone can stay in a pocket.

The only place another language enters is the content pipeline, which runs on the Mac and never ships. That is Python 3, already installed, for Markdown parsing, text-to-speech calls and audio assembly.

## Architecture

Three stages, with a hard line between the Mac and the phone.

```
assets/*.md            hand-written content, the source of truth
   |
   |  tools/build_content.py   (runs on the Mac, never on the phone)
   v
Resources/
  content.json         structured text, metadata, audio offsets
  Audio/<id>.m4a       one narration track per artwork
  Images/<id>-*.jpg    artwork photographs
   |
   |  Xcode bundles Resources/ into the app
   v
LouvreGuide.app        reads only from its own bundle
```

The app never parses Markdown and never calls the network. It decodes one JSON file at launch and plays files out of its bundle. Offline is not a feature we implement, it is the absence of anything that could go online.

Total size is small enough to ignore. Twelve artworks at roughly 4 MB of audio and 3 MB of images each land near 90 MB. Even a hundred works stay under a gigabyte, and a development install has no over-the-air size limit to worry about.

## Content pipeline

`tools/build_content.py` does four jobs.

It parses each file in `assets/`. Frontmatter becomes metadata, and the body splits on the `##` headings into the fixed section list already recorded in CLAUDE.md. Paragraphs and bullet lists become separate block types so the app can lay them out properly rather than dumping Markdown into a text view.

It renders narration. Each section becomes its own text-to-speech request, returned as PCM audio.

It assembles one track per artwork. The per-section audio concatenates in order using Python's stdlib `wave` module, which also gives us the exact start offset of every section. Those offsets go into `content.json`. That is what lets the detail screen highlight the section being narrated and lets you tap a heading to jump the audio to it.

It encodes and writes output. `afconvert -f m4af -d aac -b 64000` turns the joined WAV into a mono AAC file. afconvert ships with macOS, so the pipeline needs no ffmpeg and no Homebrew.

The script is idempotent and content-hashed. Re-running it only re-synthesises artworks whose text changed, which keeps the text-to-speech bill near zero while you edit.

### Which voice

Two realistic choices, and the quality gap is wide.

A cloud text-to-speech service produces narration that sounds like a person reading. Running all twelve files is a one-off job of maybe 120,000 characters, which at current per-character rates for the usual providers costs a couple of dollars. Check the live price before the first batch, but this is not a meaningful cost. Nothing about it compromises offline use, because it runs on the Mac at build time and only the finished m4a ships.

macOS `say` is the free fallback and needs no account. Download an enhanced or premium voice in System Settings under Accessibility, Spoken Content, then `say -v <voice> -o out.aiff --data-format=LEF32@22050`. It is intelligible and flat. For text this good, in a room you queued to stand in, flat is a real loss.

Go cloud. Keep the `say` path in the script behind a flag so the pipeline still runs with no network and no key.

Do not use AVSpeechSynthesizer live on the phone. It would save the build step and cost nothing, but you would be handing the best writing in the project to the weakest voice available, with no chance to fix a mispronounced name.

### Images

Source photographs from collections.louvre.fr, which carries the works in `assets/` with their inventory numbers. The paintings themselves are centuries out of copyright. Individual photographs can still carry their own terms, which for a private app on one phone is not a practical concern, but do not redistribute the bundle.

Store a main image per artwork plus a few detail crops keyed to the `Look for` bullets, so the app can show the thing the text is pointing at. Downscale to roughly 2000 px on the long edge and save as JPEG. Larger is wasted on a phone screen and slows the zoom view down.

## Data model

`content.json` decodes into these, all `Codable`.

```swift
struct Artwork: Codable, Identifiable, Hashable {
    let id: String              // matches the filename in assets/
    let title: String
    let titleFR: String?
    let artist: String
    let artistDates: String?
    let date: String
    let medium: String
    let dimensions: String
    let inventory: String
    let location: Location
    let tags: [String]
    let timeNeeded: String
    let crowd: Crowd            // .low, .medium, .extreme
    let sections: [Section]
    let images: [ImageRef]
    let audioDuration: TimeInterval
}

struct Location: Codable, Hashable {
    let department: String
    let wing: String            // "Denon"
    let level: Int
    let room: String            // "711", kept as a string, rooms are not numbers
    let gallery: String?        // "Salle des États"
}

struct Section: Codable, Hashable, Identifiable {
    enum Kind: String, Codable {
        case inOneLine, whatYouAreLookingAt, story, lookFor, facts, practical, talkingPoint
    }
    let id: String
    let kind: Kind
    let heading: String
    let blocks: [Block]
    let audioStart: TimeInterval
}

enum Block: Codable, Hashable {
    case paragraph(String)
    case bullets([String])
}
```

Content is immutable and read-only, so it needs no database. One decode at launch into an `@Observable` store holds the whole library in memory without effort at this scale.

Visit state is the only thing that changes, and it is tiny. Saved works, works you have already heard, and the last playback position per track. Persist it as a `Codable` struct written to Application Support. SwiftData would also work and would be more machinery than this earns.

## App structure

```
LouvreGuideApp.swift
Models/      Artwork.swift, ContentStore.swift, VisitState.swift
Audio/       AudioPlayer.swift, NowPlaying.swift
Views/       RootView.swift, RoomsView.swift, ArtworkListView.swift,
             ArtworkDetailView.swift, SectionView.swift,
             ImageViewer.swift, PlayerBar.swift
Resources/   content.json, Audio/, Images/
```

Four tabs. Rooms lists wings, then rooms, then the works in each, which is how you actually move through the building. All Works is the flat searchable list, matching on title, French title and artist, because the wall label next to you gives you a title and nothing else. Saved holds what you marked before the trip. Now Playing is the current track with its section list.

The detail screen is the app. Hero image, then the locator line, then the sections in their fixed order, with a play button pinned at the top that starts the narration and a mini player that stays docked at the bottom while you scroll or navigate away. As audio plays, the active section highlights, and tapping any heading seeks to that section's offset. `Look for` renders as a checklist against its detail crops. Metadata like medium, dimensions and inventory number sits collapsed at the bottom, since it is reference rather than reading.

Two details worth building in from the start. Give the reading view a generous type size and a true dark mode, because galleries are dim and you read standing up. Wire `MagnificationGesture` into the image viewer for pinch-zoom on the details the text calls out, since SwiftUI's `Image` gives you nothing for that by itself.

## Build order

1. Xcode project, iOS 26 target, signed and installed on the phone. Prove the loop before writing features.
2. `build_content.py` through to `content.json`, text only, no audio yet.
3. Models, content store, browse and detail screens reading real text.
4. Images in the pipeline and the detail view, including the zoom viewer.
5. Audio in the pipeline, then the player, background playback and Lock Screen controls.
6. Section offsets wired to highlighting and tap-to-seek.
7. Visit state, saved works and resume position.
8. Rebuild to refresh the profile before the trip, or move to a paid account if the rebuild cadence is annoying by then.

## Open decisions

Which text-to-speech provider, once you have looked at current voices and prices. The pipeline treats it as one swappable function, so this does not block anything before step 5.

Whether the library grows past the Denon wing. Twelve works is one good afternoon. The design holds at a hundred without changes, but the browse hierarchy will want a department level above wing if it gets there.

## Later, not now

Recognising a painting through the camera with Vision and a small Core ML classifier would be the most satisfying way to select an item, and with a fixed library of a few dozen works it is genuinely achievable on device. It is also a separate project from getting the guide working. Ship the guide first.
