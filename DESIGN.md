# DESIGN.md — Arc Reader → Master Reader (StoryVault) translation

> Source studied: https://arcreaders.app/ (home, support, blog), the Google Play listing
> (com.notasimplestudio.arcreaders, incl. "What's new"), and all 8 Play Store screenshots
> (stored locally in `/tmp/arcshots/shot1..8.png` during analysis — re-fetch from the Play
> listing if needed).
>
> Target: **Master Reader** — Expo SDK 57 · React Native 0.86 · React 19 · TypeScript strict
> · expo-router · Android-only · offline-first SQLite · sherpa-onnx TTS · flat 0-radius
> theme-only design system. Reference screens live under `src/app/(tabs)`, `src/app/settings/*`,
> `src/app/story/[sourceId]/[id].tsx`, `src/app/reader/[sourceId]/[id].tsx`,
> `src/app/downloads/*`. UI kit in `src/components/ui/*`.
>
> **Status:** this is the brief the rebuild was written against. The shipped screens have
> moved on since (the reader is at `reader/[sourceId]/[novelId]/[chapterId]`, the extension
> runtime is gone and the sources are built in). Read it for the design rules, not as a
> description of the current tree.
>
> This file is a UI prescription only. It contains **no code**. It is written so two
> frontend implementer agents can work simultaneously without colliding
> (Agent A = "Shelf & Library", Agent B = "Player & Reader"). Each work order lists the
> screens to touch, the component-tree shape (component names only), and the exact
> `src/i18n/en.json` keys to add. Nothing outside `DESIGN.md`, the i18n file, `theme.ts`
> additions explicitly listed here, and pre-existing components/screens is assumed.

---

## 0. Ground rules for every implementer (non-negotiable)

1. **Never hard-code a hex value.** Everything is styled through `useTheme()` /
   `useAppTheme()` and the tokens in `src/constants/theme.ts` (`Spacing`, `Radius`,
   `MinTouchTarget`). `Radius` is all-zero on purpose — **do not round anything**, even
   where Arc Reader's screenshots show rounded cards. Flatness is the house style.
2. **No shadows, no elevation.** Arc uses soft drop shadows; we reject them. Separation is
   done with `theme.border` hairlines and `backgroundElement` fills.
3. **Every user-facing string** goes in `src/i18n/en.json` and is read with `t()` from
   `@/i18n`. Never inline a string in a component.
4. **Accessibility**: every pressable gets a ≥44dp target (`MinTouchTarget`),
   `accessibilityRole`, `accessibilityLabel`, and `accessibilityState` where stateful.
   Progress bars announce via `accessibilityRole="progressbar"` + `accessibilityValue`.
5. **Android only.** No iOS branches, no `Platform.ios`, no web-specific work.
6. **FLOSS**: no proprietary services, no ads, no coins, no paid tiers, no account wall,
   no cloud sync. Alternatives for Arc features that need those are listed in §5.
7. **Additive**: prefer composing existing UI-kit pieces (Screen, Section, Row,
   SegmentedControl, Chip, OptionSheet, Stepper, AppBar, Button, IconButton, TextField,
   EmptyState, ErrorState, TransportControls, ThemedText/View) over new primitives.
   When a new primitive is genuinely needed, follow §4's additions (the only sanctioned ones).
8. **Verify after every task**: `npm run verify` (typecheck, lint, format, test, db). Do not
   finish a screen with it failing.
9. Do not modify `src/db/schema.ts`/migrations as part of UI work. Where a feature needs a
   new table (pronunciation rules), the UI agent stops at the screen and uses the store
   contract declared in its work order; schema work is a separate task.
10. After edits: run `npx expo prebuild --clean`-free — no; simply note in the PR that
    native changes are impossible from this task and the app version in `app.json` is bumped
    only at release time. (UI agents: never touch `app.json`.)

---

## 1. Arc Reader — feature inventory (from site + Play listing + screenshots)

Grouped by the site's own navigation: Import / Reader / Listen / extras.

### 1.1 Import & library ("Any web novel, on your shelf")

- **Paste-a-link import**: paste a novel URL in a bottom sheet ("Add Novel"), with a
  clipboard-paste button, an accent "Go" button, a hint line ("Paste a novel URL to get
  started"), a divider, and two fallback actions — Browse and Search. (Screenshot 8.)
- **Search across sources**: one query returns results grouped by source; rows show a
  source mark, the result title, and the source domain in small-caps. (Screenshot 3.)
- **In-app browsing of sources** + **share-to-app** import from the system browser.
- **Background download-all**: every chapter fetched in the background, Wi-Fi-only by
  default; download continues with the app closed; "Download ahead" — the next chapters
  prefetch while reading.
- **Same-novel multi-source**: pick whichever mirror is further ahead.
- **Request-a-site** flow from inside the app.
- **Shelf/home**: NOVELS/BOOKS mode pill; "Continue reading" hero resume card (cover,
  chapter chip, title, author, percent, accent Resume button); "YOUR SHELF" small-caps
  section eyebrow; 3-column cover grid with title + "Ch 9/344" progress underneath;
  grid/list view toggle; + (add) and filter icon buttons. (Screenshots 1 & 8.)
- **New-chapter auto-update**: shelf checks for updates, notification fires, new chapters
  optionally download immediately; "Uncategorized" filter; category chosen at add time
  (from Play changelog).
- **Local-file import**: EPUB/PDF/MOBI/TXT/DOCX read on device;(Android build also ships
  a direct APK download.)

### 1.2 Reader ("And when you'd rather read")

- Themes: Light, Sepia, Dark, True Black + custom mixes.
- Pagination: paper **page curl**, slide, or continuous scroll into the next chapter.
- A dozen reading fonts; adjustable size, line height, spacing, margins; left/justify.
- **E-ink mode** for Boox/e-paper (grayscale-friendly, animation-free).
- Volume keys turn pages; two-page spreads on tablets.
- Typographic chapter presentation: small-caps "CHAPTER" eyebrow, large serif chapter
  number/title, drop cap. (Screenshot 5.)
- In-page settings bottom sheet: label rail (SIZE / FONT / THEME / ALIGN / SPACING /
  HEIGHT / MARGIN) each with a live preview ("A 29", Aa tiles) and pill options; selected
  value outlined. (Screenshot 4.)

### 1.3 Listen ("Your novel, now an audiobook")

- On-device neural TTS — 140 voices / 31 languages / 0 internet; system voices also usable.
- Spoken-word highlight gliding along the line ("instead of jumping" — recent changelog);
  **tap any paragraph to move the voice there** (in Pages mode too).
- Lock-screen controls, playback speed 0.75–2×, sleep timer, auto-advance between chapters.
- **Player screen**: "NOW LISTENING" eyebrow top bar, chevron-down, kebab menu; large
  centered cover; "CHAPTER 2" eyebrow; big serif chapter title; story-name subtitle; then
  the spoken text itself with the current words shaded — content-first player. (Screenshot 2.)
- **Voices screen**: title + "2 / 17 installed · 121 MB on device" stat pair; grouped voice
  cards with name, locale chips, size chip, one-line description, radio selection, per-voice
  Download button. (Screenshot 7.)
- **Pronunciation rules**: per-book find→replace rules so names/terms read correctly
  everywhere in that novel ("Fix a name once. Fixed everywhere.").
- **Ambient sound**: rain/fire/piano bed under narration, auto-dips while the voice speaks.

### 1.4 Extras ("Made for long nights and no signal")

- Highlights and notes (four colors), per-book notebook (web) — Play listing adds
  "Highlights and notes in four colors".
- Stats and ranks: finished chapters earn points, weekly leaderboard; reading streaks and
  daily rewards (gamified; tied to coins/ads ecosystem).
- **Save as EPUB** — export anything downloaded, translations included (Pro-gated there).
- Cloud backup + cross-device sync (account-based).
- Home-screen widget (shelf, progress, new chapters).
- Accessibility: TalkBack/VoiceOver reach every screen; RTL support; 12 UI languages.
- Backup/restore of library to a new phone (FAQ "move my library").

### 1.5 Monetization present in Arc (rejected for Master Reader)

Free tier with ads + earnable coins; Pro subscription gating unlimited downloads, all
neural voices, sync, cloud backup, EPUB. **All of this is out of scope** — see §5.

---

## 2. Screen-by-screen structural prescriptions

Each subsection describes what a Master Reader screen **should become**, written as
instructions ("add", "make", "order this way"), referencing real Master Reader files and
`en.json` groups. Component trees are outlines, top to bottom.

### 2.1 Library tab — `src/app/(tabs)/index.tsx`

Reference: screenshots 1 & 8 (shelf + continue-reading hero), Arc home hero concept
("Paste a link. Listen offline.").

Prescription:

1. Keep the existing `Screen` + `AppBar` (title "Library", right actions: Downloads
   IconButton; **add** an "Add novel" IconButton that opens the import sheet of §2.6).
2. **Add a Continue-reading hero block** directly under the AppBar — the single most
   prominent element of the screen:
   - small-caps eyebrow label (new `eyebrow` ThemedText type, §4) with last-read story's
     progress context;
   - a full-width flat block on `backgroundElement` with hairline `border`, padding
     `Spacing.three`, arranged: left column = cover image (`story.coverUrl`, fixed 72×104,
     `expo-image`; letterbox with `backgroundSelected` if missing — flat, **0 radius**),
     right column = chapter-context chip ("CH 2" style → reuse `Chip`), title
     (`titleLarge`-ish `ThemedText`, 2 lines max), author (`textSecondary`),
     a thin progress track (reuse the reader's progress-track pattern: 4dp track, fill
     `theme.primary`) + percent text, and a full-width `Button` variant primary titled
     "Resume reading" that opens either the reader (if text progress > 0 for reading) or
     the Audio tab logic (if the last interaction was narration). Resume target = the
     story's saved reading position (already exists in `services/reading.ts`).
   - If no history: render nothing here (library falls straight to empty state / shelf).
3. **Add a shelf header row**: small-caps eyebrow "Your shelf" on
   the left; on the right a compact **view toggle** (grid/list) — two `IconButton`s in a
   hairline-bordered group (43dp shared, each ≥44dp target) — plus keep it simple: no
   sort menu here.
4. **Content area switches by the toggle**:
   - List = existing `StoryList` unchanged.
   - Grid = new `StoryGridItem` (§4 addition): 3 columns, gap `Spacing.two`, each cell =
     cover (aspect 2:3, `expo-image`, flat hairline border) + title (2 lines, small) +
     one muted meta line (prefer "Ch {{done}}/{{total}}" when library progress exists,
     else author). Unread state = a 8dp `theme.primary` dot next to the title, same
     language as the list row's dot. Rows are `Pressable` with button role + combined
     a11y label (title, author, progress, unread).
5. **New-chapter awareness**: when the library-refresh diff marks stories as updated
   (`story.flags.isNew` or the updater result), add **one dismissible banner** under the
   hero: `OfflineBanner`-styled flat strip, text "New chapters in {{count}} stories",
   trailing action "Review" → navigates to Browse/search or the story detail. Dismiss
   stores a timestamp in the settings store ( Zustand-persisted, no new schema).
6. Pull-to-refresh maps to the existing `libraryStore.refresh()`; surface the
   `library-updater` result through the banner in (5).

i18n keys to add (group `library`):

```
library.continueEyebrow    "Continue"
library.resumeReading      "Resume reading"
library.chapterChip        "CH {{chapter}}"
library.progressPercent    "{{percent}}%"
library.shelfEyebrow       "Your shelf"
library.viewToggleLabel    "View"
library.gridLabel          "Grid"
library.listLabel          "List"
library.rowProgress        "Ch {{done}}/{{total}}"
library.newChapterBanner   "New chapters in {{count}} stories"
library.newChapterAction   "Review"
library.addNovel           "Add novel"
```

### 2.2 Browse/Discover — `src/app/(tabs)/browse.tsx` (mostly stays)

Reference: screenshot 3 (search grouped by source), screenshot 8 bottom sheet.

Prescription:

1. Structure is already Arc-equivalent: source picker, search field, kind
   SegmentedControl, category/sort Chips, `StoryList`. **Keep it.**
2. One Arc-grade addition — **result context**: in search results, the row already shows
   title/stats; the grouped-by-source treatment is out of scope for phone (we have one
   active source). Instead, make the source identity explicit in the AppBar subtitle
   (already done) and add, under the `TextField`, a single hairline row showing the
   active source name in small-caps eyebrow style with a trailing "Change" ghost Button —
   it opens the existing source OptionSheet.
3. Keep flat list rows as prescribed in the existing kit (no card-ification).

i18n keys to add (group `browse`):

```
browse.activeSourceEyebrow "Source"
browse.changeSource        "Change"
```

### 2.3 Story detail — `src/app/story/[sourceId]/[id].tsx`

Reference: Arc's novel-page concept (cover hero + actions + chapter context), screenshot 1
resume card for visual rhythm.

Prescription:

1. **Add a cover hero band** at the top, before the existing button stack: full-bleed
   `View` height 160, letterboxed `expo-image` cover centered with `backgroundElement`
   fill on the sides, hairline bottom border. No text over the cover; title stays in the
   AppBar. If no cover: render a plain `backgroundElement` band with a large book-outline
   icon (`textMuted`) — never empty white.
2. Keep the existing action stack, but **reorder to Arc's hierarchy** — the two primary
   reading actions form a row of equal-weight halves, the rest collapse underneath:
   row 1: Read (`Button` primary, flex 1) + Listen (`Button` secondary, flex 1);
   row 2 (existing): Add/Remove library (secondary, flex) + Download (flex);
   row 3 (existing, only when series): View series + Download all;
   row 4: Open in web (ghost).
3. **Meta panel**: keep `MetaRow` grid; add one more row — "Last read" with the saved
   progress percent when it exists (feeds the resume mental model), and one "Chapters
   read" count when history data is cheap to fetch. Do not add heavy queries here.
4. Tags/description unchanged (chips flat, wrapping).
5. Every button keeps the current press feel; the hero band is decorative
   (`importantForAccessibility="no"` on the image).

i18n keys to add (group `story`):

```
story.lastRead   "Last read"
story.percentRead "{{percent}}% read"
```

### 2.4 Reader + Reading hub — `src/app/reader/[sourceId]/[id].tsx`

Reference: screenshots 4 & 5 (settings sheet, typographic chapter head), Arc e-ink and
theme pitch. The hub already exists with grid cells (Font / Pagination / Pages /
Chapters + progress + narration). Restructure its **content** to Arc's label-rail model
without changing its flatness.

Prescription:

1. Replace the 2×2 grid-cell layout with **full-width label-rail rows** (label on the
   left in small-caps `eyebrow` style, control on the right), one per row, separated by
   hairlines — this is Arc's signature settings treatment and reads better with TalkBack:
   - ROW `Font`: A− / value / A+ (existing Stepper semantics; keep the current buttons
     but re-housed as a `Stepper` with label from the eyebrow rail).
   - ROW `Theme`: four Aa-style theme tiles (reuse `Chip` with role="radio" inside a
     labeled radiogroup; tile label = theme name; **tile background** shows the actual
     reader palette background color via an inline `readerPalettes[...]` lookup — this is
     the one sanctioned exception to "no hex in components", because the palette object
     is the theme source, not a hard-code).
   - ROW `Alignment`: SegmentedControl left/justify (existing settings')){
     vocabulary `settings.alignment.*`).
   - ROW `Page flow`: SegmentedControl pages/scroll (existing keys).
   - ROW `Spacing`: Stepper for `lineHeight` (value shown as ×1.6-style text).
   - ROW `Margins`: Stepper for `marginHorizontal`.
   - ROW `Size`: Slider is **not** in the kit; keep Stepper for `fontSize` (Arc's slider
     is aspirational; Steppers are the house pattern — do **not** add a new slider
     primitive now).
2. Keep the existing progress row + progressbar under the rows (already Arc-like).
3. Keep `NarrationControls` as the bottom block of the sheet.
4. **Typographic chapter head in the page**: when StorySeriesItem context provides a
   chapter/section title (novel-mode stories), render above the first page item:
   small-caps eyebrow "Chapter {{number}}" (if derivable) + chapter title in
   `titleDisplay`-scale serif (`Fonts.serif`), then body text. Drop caps are **out of
   scope** (custom text rendering cost > value). Keep Literotica page-flow unchanged.
5. **E-ink support (additive settings, P2)**: add `reducePageAnimation: boolean` to
   ReaderSettings defaults (false) surfaced as a Row in `settings/reader.tsx`; when true,
   page transitions use none (no slide/parallax), palette unchanged. This is our
   FLOSS-native substitute for Arc's e-ink mode and requires no new palette.
6. Narration tap-to-move (see §2.5) is implemented here, not in the Audio tab, when
   narration is active inside the reader.

i18n keys to add (group `reader`):

```
reader.themeLabel      "Theme"
reader.alignLabel      "Alignment"
reader.spacingLabel    "Spacing"
reader.marginLabel     "Margins"
reader.chapterEyebrow  "Chapter {{number}}"
reader.reduceAnimation "Reduce page animation"
reader.reduceAnimationDescription "Turns off page-turn motion for e-ink screens."
```

(`settings.reader` reuses `settings.reducePageAnimation` alternative naming only if the
existing key style demands; prefer the `reader.*` keys above to keep the hub sheet
self-contained.)

### 2.5 Audio tab / player — `src/app/(tabs)/audio.tsx` + `TransportControls`

Reference: screenshot 2 (content-first "Now listening"), screenshot 7 (voices), Arc's
"tap paragraph to move the voice there", "highlight glides along the line".

Prescription for the **player screen** (when a session exists):

1. Top bar: centered small-caps eyebrow "Now listening", chevron-down left (collapses to
   a compact bar/player state — for v1 it simply navigates back), kebab right opening an
   `OptionSheet` with Sleep timer and Speed entries (both already exist as Narration
   settings; reuse, don't duplicate logic).
2. Hero block: cover image (72×104, letterboxed like §2.1, 0 radius) centered; below it
   an eyebrow "Chapter {{position}}", the chapter/story title set in `Fonts.serif`
   `ThemedText` at display-ish size, the story title in `textSecondary`.
3. **Spoken-context block** (the distinctive Arc move): show the current chunk's text as
   the page body — 2–4 sentences — rendered with the current chunk visually marked
   (background = `withAlpha(theme.primary, 0.18)`-style via the sanctioned alpha helper
   already used in the reader; text = theme text). This is chunk/sentence-level glow,
   not word-level — word-level timing isn't exposed by the sherpa module contract and is
   explicitly deferred (§6).
4. Then `TransportControls`, unchanged in behavior, restyled slightly: eyebrow-ish
   chapter position row above the transport; keep skip/play/chapter actions and the
   options row (children) as-is.
5. Idle/empty state: existing `EmptyState` copy ("Press Listen on any story…") stays;
   **add** a flat "Last position" memory card above it when `narrationRepository.lastPlayed()`
   returns a story (existing Memory logic already renders cards — keep, restyle to the
   §2.1 hero pattern: cover + chapter chip + title + percent + Resume button).

Prescription for **narration-in-reader** (the higher-value half):

1. When narration is active and the reader page renders, map `chunkIndex → pageIndex`
   (existing `progress-sync` helpers) and apply the same alpha-hilite on the current
   chunk's paragraph.
2. **Tap any paragraph to move the voice there**: paragraphs inside the reader get a
   press handler that calls `playFromChunk(pageToChunk(pageIndex))` when narration is
   active. Paragraph rows stay non-interactive when no session exists. A11y: role
   "button", label `player.tapParagraphMoving` only while narrating.
3. Auto-start behavior unchanged (narrate=1 deep link).

i18n keys to add (group `player` — new group):

```
player.nowListening      "Now listening"
player.collapse          "Collapse player"
player.chapterEyebrow    "Chapter {{position}}"
player.tapParagraphHint  "Narrating — tap a paragraph to move the voice there."
player.voiceMoved        "Voice moved to this paragraph"
player.resumedFromMemory "Resume last position"
```

Extend group `narration` with:

```
narration.speedShort     "Speed"
narration.sleepShort     "Sleep timer"
```

### 2.6 Import / "Add novel" flow — new sheet on Library

Reference: screenshot 8 (Add Novel bottom sheet), hero copy "Paste a link."

This is the one **new interaction** worth porting; it collapses three Arc features into
one Master Reader-native flow over our 3 sources.

Prescription:

1. Trigger: the Library AppBar "Add novel" IconButton (§2.1) → `OptionSheet`-family
   modal (or a dedicated full Sheet if the team prefers; OptionSheet is approved scope).
   Tree:
   - Title "Add novel".
   - A `TextField` (placeholder "Paste novel URL…") + an `IconButton` (clipboard icon)
     that pastes from the system clipboard + a compact primary `Button` labeled "Go".
   - A centered hint row: link glyph + "Paste a link to find the story in your sources."
   - Hairline divider with the word "or" centered between two equal halves:
     `Button` secondary "Browse" (routes to `/browse`) and `Button` secondary "Search"
     (routes to `/browse` in search mode).
2. Resolve behavior (UI contract; pure logic goes in a new pure module when implemented —
   the UI agent only needs the outcomes): on Go, the URL host is matched against
   Literotica/NovelFire/RoyalRoad; the app deep-links to `/story/<sourceId>/<id>` and the
   story screen loads. Outcomes: loading (`import.resolving`), no match
   (`import.notFound`), invalid URL (`import.invalid`), success → normal story screen.
   No new provider credentials are involved; the fetch path is the existing transport.
3. Keep "share-to-app" out of scope for this pass (needs a new intent filter; list as P2,
   §6).

i18n keys (new group `import`):

```
import.title        "Add novel"
import.urlField     "Paste novel URL…"
import.paste        "Paste from clipboard"
import.go           "Go"
import.hint         "Paste a link to find the story in your sources."
import.dividerOr    "or"
import.browse       "Browse"
import.search       "Search"
import.resolving    "Looking up the story…"
import.notFound     "No supported source matches this link."
import.invalid      "That doesn't look like a story link."
```

### 2.7 Downloads / offline library — `src/app/downloads/index.tsx` (+ series route)

Reference: screenshot 6 ("Offline library", queue cards, progress math, Cancel/Done).

Prescription:

1. Keep AppBar "Downloads"; **add a header stat pair** directly under it — small-caps
   pair layout: `{{count}} STORIES · {{size}}` (data already exists via
   `downloads.summary` interpolation; restyle as two stat blocks: big number + small-caps
   caption).
2. Sections: keep existing Series/Standalone grouping (already implemented through
   `groupDownloadItems`); render each section with a small-caps eyebrow header.
3. **Active queue cards**: for items whose status is queued/downloading/failed, upgrade
   `DownloadListItem` to a card layout: title (2 lines), thin progress track with fill =
   percent of pages done (`completed`/`totalPages`), a right-aligned percent text, a
   small-caps status line (`download.*` labels), and one trailing action per state:
   Cancel (queued/downloading — queues a pause), Retry (failed). Completed items keep
   the current compact row with the ✓-style trailing chevron.
4. Completed summary line keeps `download.completed` copy.

i18n keys to add (group `download`):

```
download.cancel      "Cancel"
download.activeEyebrow   "Downloading"
download.doneEyebrow     "Downloaded"
```

Extend group `downloads` with:

```
downloads.storiesStat    "Stories"
downloads.sizeStat       "On device"
```

### 2.8 Voices / narration settings — `src/app/settings/narration.tsx`

Reference: screenshot 7 (Voices screen with stat header and voice cards).

Prescription:

1. Under the existing Engine `Section`, for the **neural** branch, add a **stat pair
   header row** styled like §2.7: "X / Y installed" + "Z MB on device" (X/Y from the
   voice-pack registry + `voice-pack-store` installed set; MB from `formatBytes` over
   installed pack sizes — pure computation, no new services).
2. Restyle voice rows into voice **cards**: name (`default` weight 600), trailing locale
   chip (e.g., "en-US") and size chip (e.g., "57 MB") flat hairline `Chip`s, one-line
   description (`textMuted`), right side = radio `Chip` for selection (selected =
   `primary` fill), and per-row actions row: Download (`Button` ghost) or Delete
   (`Button` ghost, `danger`-text) + a **Preview** ghost action that speaks a fixed
   sample sentence with the current engine — this is the Arc "cast your narrator" beat
   and is cheap (one `narration` call).
3. Section captions: "Standard" / "Experimental" small-caps eyebrows using existing
   pack metadata (`experimental` flag) — for system voices keep the single grouped list.
4. Keep existing a11y group labels; Preview button gets `narration.previewVoice`.

i18n keys to add (group `narration`):

```
narration.installedStat   "{{done}} / {{total}} installed"
narration.deviceStat      "{{size}} on device"
narration.sectionStandard "Standard"
narration.sectionExperimental "Experimental"
narration.preview         "Preview"
narration.previewSample   "This is how the chapter will sound."
narration.previewVoice    "Preview voice"
```

### 2.9 Pronunciation rules (Arc's "fix a name once") — new screen

The single most-loved Arc listening feature that is trivially FLOSS-native here: rules
are pure text transforms applied before chunking (`htmlToPlainText` → rule pass →
`chunkPages`).

Prescription:

1. **Scope trail**: rules live per story, stored in app storage via a pure
   `services/pronunciation.ts` module (find → replace pairs keyed by
   `sourceId:storyId`, plus a global bucket). UI reads/writes through that module; the
   DB agent owns persistence (new table is a separate task).
2. **Entry point A — narration settings**: a Section "Pronunciation" with a Row
   "Manage rules" → pushes `/pronunciation` (global rules).
3. **Entry point B — reader hub narration block**: a ghost Button "Rules for this
   story" when narration session exists → pushes the same screen with the story
   preselected (route param).
4. Screen structure (`/pronunciation`):
   - AppBar "Pronunciation".
   - Story scope picker (OptionSheet): "Global" + last-n stories with rules (first run:
     just Global).
   - Rule list rows: match text (1 line, weight 600) → arrow glyph → replacement text
     (muted) + delete `IconButton`. Empty state: `EmptyState` with cookbook copy.
   - "Add rule" Button → inline add form: two TextFields (Looks like / Sounds like
     conceptually: "Written as" / "Reads as") + Save.
   - "Test the voice" ghost Button: speaks the replacement as applied to a sample
     sentence using the current engine.
5. All user copy from i18n; no magic strings in UI for sample sentences.

i18n keys (new group `pronunciation`):

```
pronunciation.title        "Pronunciation"
pronunciation.globalScope  "Global"
pronunciation.storyScope   "{{title}}"
pronunciation.addRule      "Add rule"
pronunciation.save         "Save"
pronunciation.deleteRule   "Delete rule"
pronunciation.writtenAs    "Written as"
pronunciation.readsAs      "Reads as"
pronunciation.test         "Test the voice"
pronunciation.emptyTitle   "No pronunciation rules yet"
pronunciation.emptyMessage "Add rules so names and terms are read the way you want."
pronunciation.appliedIn    "Rules apply wherever this story is narrated."
```

### 2.10 EPUB export (FLOSS alternative to Arc's Pro-gated export) — new screen/actions

`fflate` is already a dependency → EPUB is a zip assembly problem, pure module
(`services/epub/…`, `@/db`-free, Vitest-testable, mirroring `services/backup/format.ts`
discipline). UI is thin.

Prescription:

1. Entry point: story detail — add a ghost option in a secondary actions row:
   "Export EPUB" (only for stories with downloaded content).
2. Flow: build book from pages → write to cache dir via `expo-file-system` → share via
   `expo-sharing` (already present). Show `LoadingView` during build;
   `ErrorState` with retry on failure.
3. No DRM, no Pro gate, nothing cloud.

i18n keys (new group `export`):

```
export.title        "Export"
export.epub         "Export EPUB"
export.epubDescription "Bundles the downloaded chapters into one EPUB file."
export.building     "Building EPUB…"
export.failed       "Couldn't build the EPUB."
export.shared       "Ready to share"
```

### 2.11 Stats (FLOSS version of Arc's stats/ranks — no leaderboard, no rewards)

Keep it honest and offline: the History screen gains a small header block computed from
existing tables (finished chapters from reading progress; listening time from
`narrationRepository`), presented as the §2.7 stat-pair pattern.

Prescription:

1. Under History AppBar: one row of three stat pairs — Chapters read / Chapters
   finished / Time listened this week. Big number + small-caps caption.
2. No streaks, no points, no leaderboard (those are the monetization-motivated layer of
   Arc; omit). "This week" is computed client-side; a "All time" Chip toggles range
   (Chip pair, existing component).

i18n keys (new group `stats`):

```
stats.title        "Reading stats"
stats.thisWeek     "This week"
stats.allTime      "All time"
stats.chaptersRead "Chapters read"
stats.finished     "Finished"
stats.timeListened "Time listened"
stats.hours        "{{count}} h"
stats.minutes      "{{count}} min"
stats.empty        "Read or listen a little and your stats will show up here."
```

### 2.12 Settings hub — `src/app/(tabs)/settings.tsx` (+ subpages)

Prescription:

1. Add rows: Appearance is new per section order below (existing). New rows to add:
   - "Narration" already exists → keep; inside it, the §2.8 additions.
   - New Row "Pronunciation" → `/pronunciation`.
   - New Row "Export stories" → new `/export` landing (cards for EPUB: description +
     "Choose a story" hint pointing at story screens; keep tiny).
2. Section "Library" gains: default view (grid/list) Stepper-or-OptionGroup persisting
   the library view mode used by §2.1.

i18n keys:

```
settings.pronunciation      "Pronunciation"
settings.exportStories      "Export stories"
settings.defaultLibraryView "Default library view"
```

---

## 3. Translation matrix (Arc feature → Master Reader status → change → priority → touchpoints)

Priority legend: **P0** = do first, defines the app's feel, low-risk composition of
existing pieces; **P1** = signature Arc capability, additive screens/services;
**P2** = polish or needs deeper plumbing; do after P0/P1.

| #   | Arc Reader feature                                            | Master Reader today                                 | Proposed concrete change                                                                                                                             | Pri            | Touchpoints                                                                          |
| --- | ------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| 1   | Continue-reading hero w/ cover, chapter chip, percent, Resume | None — flat StoryList only                          | Add hero block to Library (§2.1.2); reuse coverUrl + progress services                                                                               | **P0**         | `(tabs)/index.tsx`, `story-list-item` style language, i18n `library.*`               |
| 2   | Shelf w/ cover grid + view toggle                             | Text rows only                                      | `StoryGridItem` + toggle pair; default persisted via settings (§2.1.3–4, §2.12)                                                                      | **P0**         | new `story-grid-item.tsx`, `(tabs)/index.tsx`, settings store                        |
| 3   | Small-caps eyebrow typography system                          | No eyebrow variant                                  | Add `eyebrow` type to `ThemedText` (§4) and apply on Section titles/hub rows/player                                                                  | **P0**         | `themed-text.tsx`, `section.tsx`, hub, audio, downloads                              |
| 4   | Content-first player ("Now listening" + cover + spoken text)  | Transport-first audio tab                           | Restructure per §2.5; chunk-level alpha highlight                                                                                                    | **P0**         | `(tabs)/audio.tsx`, `transport-controls.tsx` styling only                            |
| 5   | Reader settings sheet w/ label rail + theme tiles             | Grid-cell hub                                       | Rebuild hub rows per §2.4; theme tiles from `readerPalettes`                                                                                         | **P0**         | `reader/[sourceId]/[id].tsx` hub                                                     |
| 6   | Real download queue cards (%, size, cancel)                   | Status labels only                                  | §2.7 cards + stat header                                                                                                                             | **P0**         | `download-list-item.tsx`, `downloads/index.tsx`                                      |
| 7   | Stat-pair header pattern (2/17 · 121 MB)                      | Absent                                              | Sanctioned pattern reused on Downloads, Voices, Stats                                                                                                | P0             | listed screens                                                                       |
| 8   | Paste-a-link import sheet                                     | No direct paste import                              | §2.6 sheet over 3 sources                                                                                                                            | **P1**         | new `import-sheet.tsx`, `(tabs)/index.tsx`, i18n `import.*`                          |
| 9   | Tap paragraph → voice moves there                             | playFromChunk exists; no UI                         | §2.5.2 wire-up inside reader                                                                                                                         | **P1**         | reader page renderer, narration store                                                |
| 10  | Chunk/paragraph narration highlight                           | None                                                | §2.5.1 alpha highlight                                                                                                                               | **P1**         | reader renderer                                                                      |
| 11  | Pronunciation rules                                           | Absent                                              | §2.9 pure module + screen                                                                                                                            | **P1**         | new `services/pronunciation.ts` (pure), new `/pronunciation`, narration settings row |
| 12  | EPUB export (Pro there; free here via pure module)            | Absent (fflate present)                             | §2.10                                                                                                                                                | **P1**         | new `services/epub/*` (pure), story detail action, `/export`                         |
| 13  | Voices screen polish (stat header, cards, preview)            | Grouped search list, no stats/preview               | §2.8                                                                                                                                                 | **P1**         | `settings/narration.tsx`                                                             |
| 14  | New-chapter notification                                      | library-updater refresh exists; no signal surfacing | §2.1.5 banner (P0.5); **local notification** via `expo-notifications` on updater diff (P1, needs dep add — Android-only local notifications, no FCM) | P0/P1          | library store, updater, `(tabs)/index.tsx`                                           |
| 15  | Background download-all                                       | Sequential queue w/ background-task dep present     | Ensure queue runs under `expo-background-task`; Wi-Fi-only default setting Row (P2)                                                                  | **P2**         | `services/downloads.ts`, `tasks/`, settings                                          |
| 16  | Download-ahead (prefetch next chapters)                       | Reads lazily fetch pages                            | Prefetch N next pages/downloads while reading in reader focus effect                                                                                 | **P2**         | reader screen, downloads service                                                     |
| 17  | E-ink mode                                                    | AMOLED only                                         | §2.4.5 `reducePageAnimation` toggle                                                                                                                  | **P2**         | reader, settings reader                                                              |
| 18  | Ambient sound w/ dip                                          | Absent (expo-audio present)                         | Gentle pink-noise/rain loops from bundled OGG assets, duck volume on speech — only if trivially wired through `expo-audio`; otherwise defer          | **P2**         | narration service, new `ambient/` assets, settings row                               |
| 19  | Stats & ranks                                                 | History only                                        | §2.11 stat block (no leaderboard)                                                                                                                    | **P2**         | `(tabs)/history.tsx`, pure stats module                                              |
| 20  | Local-file import (EPUB/TXT own books)                        | Absent                                              | TXT first (pure parse → treat as story), EPUB read after §2.10 exists; PDF/MOBI/DOCX out                                                             | **P2**         | sources dir pure parsers, import sheet                                               |
| 21  | Multi-source same-novel ("further ahead" mirror)              | 3 independent sources                               | Out of scope; closest cheap win = "Open in other source" ghost row on story detail only when IDs align — defer, not prescribed                       | **P2 (defer)** | —                                                                                    |
| 22  | Page-curl page animation                                      | Slide/pager                                         | Reject — FLOSS path keeps simple slide/none; e-ink toggle covers the preference                                                                      | —              | reader                                                                               |
| 23  | Two-page tablet spread                                        | Phone-only app                                      | Out of scope (Android phone form factor)                                                                                                             | —              | —                                                                                    |
| 24  | Volume keys turn pages                                        | `navigateWithVolumeRocker` exists                   | Keep; surface copy in reader settings if not already visible                                                                                         | P2             | settings reader                                                                      |

---

## 4. Design tokens — Arc's visual language vs. Master Reader's flat system

### 4.1 What Arc's language actually is (observed)

- **Canvases**: marketing — deep espresso brown (#2B1E12-ish) with cream paper panels;
  app — near-black warm charcoal, cream "paper" screens for reader/player.
- **Accent**: single burnt-amber/orange; used for primary buttons, selected states,
  slider thumb, progress fills, active chips. **One** accent; gold italic serif is a
  typographic accent, not a second color.
- **Type**: display serif with italic emphasis (marketing), small-caps letter-spaced
  labels everywhere (eyebrows, captions, section headers: "YOUR SHELF", "NOW LISTENING",
  "CHAPTER 2", "DOWNLOADING 2", "DOWNLOAD · READ ANYWHERE"), generous leading on body.
- **Shape**: 12–16px card radius, rounded pills, bottom sheets with rounded tops,
  soft drop shadows.
- **Layout rhythm**: 16px page gutters, 12–16px inter-block gaps, airy stacked
  sections, label-rail settings rows, stat-pair headers (big number + small-caps
  caption), content-first pages (player shows text, not controls).
- **Component DNA**: eyebrow → title → meta line → progress track → one primary action,
  repeated across hero cards, voice cards, queue cards.

### 4.2 Mapping onto the flat, 0-radius, theme-only system

**Change (adopt the structure, not the skin):**

1. **Small-caps eyebrows** become a first-class part of the type system: new
   `ThemedText` variant `eyebrow` — fontSize 12, lineHeight 16, letterSpacing ≈1.2,
   uppercase via the string (i18n supplies plain case; component uppercases with
   `textTransform: 'uppercase'`), color `textSecondary`. Used for: section eyebrows,
   hub row labels, player top bar, stat captions, badge-adjacent labels.
   _(Sanctioned kit addition #1.)_
2. **Label-rail rows** replace hub grid cells: `eyebrow` label left, control right,
   hairline separators. Composition of existing `Row` + `eyebrow` — no new component.
3. **Stat-pair header** (big value + eyebrow caption) — composition of existing pieces;
   pattern documented in §2.7/§2.8.
4. **Hero card pattern** — flat block on `backgroundElement`, hairline border, 0 radius:
   eyebrow → cover/thumb → chapter chip → title → meta → progress track → primary
   action. Applied to library continue-reading, player memory card, voice cards,
   queue cards.
5. **Progress tracks** everywhere use the existing 4dp-track/`primary`-fill recipe with
   `accessibilityRole="progressbar"`.
6. **Serif emphasis for listening/reading titles**: chapter titles in player hero and
   reader chapter head use `Fonts.serif` (platform serif; Android → `serif`). This is
   the tasteful residue of Arc's "type made for reading" without bundling fonts.
7. **Content-first ordering**: every Arc-derived screen puts the _content_ (what are you
   reading/listening to, where are you) above its controls.

**Stay (do not port):**

- ❌ **Radius**: everything stays 0. Arc's 12–16px rounding, pill buttons, rounded
  sheets are explicitly rejected. Chips/segments keep their current flat silhouette.
- ❌ **Shadows/elevation**: none. Separation = hairline borders + surface fills.
- ❌ **Arc's warm cream/espresso palette**: not ported. Color continues to come only
  from `palettes.ts`. The one sanctioned color exception is **reader-theme tiles**,
  which sample `readerPalettes[theme].background` (theme data routed through theme —
  not a hard-code).
- ❌ **Orange accent**: Arc's single-accent discipline is _behaviorally_ adopted (one
  accent role, already true: `primary`), but its hue is not. `primary` stays
  blue-family per `palettes.ts`.
- ❌ **Ads/coins/Pro gates, cloud anything**: absent, by policy (§5).
- ❌ **Page-curl animation, tablet spreads, iOS scaffolding**: rejected/skipped.

**Spacing & type specifics (keep house scale):**

- Page gutters: `Spacing.three` (16) — matches Arc's 16 rhythm; keep.
- Inter-block gaps: `Spacing.three` (16) with `Spacing.four` (24) before new sections.
- Card padding: `Spacing.three` (16); card internal gaps: `Spacing.two` (8).
- Type usage: `title` (20/26) for card titles; serif headings only where §2.4/§2.5
  prescribe; body remains 16/24 or 14/20 styles from `themed-text.tsx`; eyebrows 12/16.
- Touch targets: unchanged 44dp minimum; view toggle pair and hub controls must respect
  it even when they _look_ compact.

---

## 5. Explicit out-of-scope (never implement)

| Arc feature                                                  | Reason                                                                              | FLOSS-native stance                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Cloud sync / account / "sync across devices"                 | proprietary service, account wall                                                   | device-local; SAF backup (exists) + export/import story backups covers migration                      |
| Automatic cloud backup                                       | same                                                                                | SAF auto-backup already exists                                                                        |
| Ads, coins, daily rewards, ad-free unlock, Pro tier          | monetization rejected outright                                                      | everything free, gates-free                                                                           |
| Premium cloud voices / "neural servers"                      | proprietary, per-minute costs, network dependency                                   | sherpa-onnx voice packs already ship on-device (Piper/Kokoro)                                         |
| AI paragraph translation, dictionary, flashcards             | requires bring-your-own proprietary AI keys; large scope; not core to FLOSS reading | out; a future pure-module translation hook could use local models, not prescribed here — do not build |
| Home-screen widget                                           | Android widgets are feasible but out of this design's scope                         | future FLOSS-friendly candidate; not now                                                              |
| Leaderboard / reading points / streaks / daily login rewards | monetization-motivated engagement loops                                             | replaced by honest local stats (§2.11)                                                                |
| Share-to-app import via browser intent filter                | needs manifest-level plumbing beyond UI agents                                      | listed as follow-up, not in this file's work orders                                                   |
| PDF / MOBI / DOCX import                                     | heavy parsers, marginal use                                                         | out; TXT/EPUB only (P2)                                                                               |
| Vendor "request a site" flow with remote endpoint            | networked service                                                                   | 3-source reality documented in Browse instead                                                         |
| "Uncategorized"/category picker at import                    | library schema work                                                                 | handled implicitly by existing library entries; revisit later                                         |

---

## 6. Known data dependencies to flag to the orchestrator (not UI work)

1. **Pronunciation persistence**: needs a new table + repository + pure rules module in
   `services/pronunciation.ts` (find/replace application belongs right after
   `htmlToPlainText`, before `chunkPages`, inside the narration pipeline). UI is
   buildable against a store contract first.
2. **Stats**: listening-time aggregation may need an index or a small aggregate query;
   keep it a pure module over existing tables if possible.
3. **Local notifications** (P1 #14): needs `expo-notifications` dependency add + Android
   channel setup; stays local-only (no FCM), FLOSS-clean.
4. **Ambient sound** (P2 #18): needs 1–3 small CC0 OGG assets bundled + a ducking hook;
   drop without ceremony if it balloons.
5. **Word-level spoken highlight** (Arc's "glides along the line"): sherpa-onnx exposes
   chunk completion, not word timings; we build chunk/paragraph-level highlighting
   (§2.5) and revisit if the native module later exposes timestamps.

---

## 7. Implementation order for the two frontend agents

Split so files never collide. Each step ends with `npm run verify` green.

### Agent A — "Shelf & Library" (structural fields)

1. `ThemedText` `eyebrow` variant + `Section` eyebrow adoption (`section.tsx`).
   _(Shared kit step — do first, nothing else belongs to A until it lands, since B
   consumes it.)_
2. §2.1 hero block in `(tabs)/index.tsx` + `library.*` i18n keys.
3. §2.1 `StoryGridItem` + grid/list toggle + `settings.defaultLibraryView`.
4. §2.6 import sheet + `import.*` keys (OptionSheet-based; the URL-resolution contract:
   pure helper `utils/resolve-link.ts` later — UI may stub outcomes through the story
   route when a source matches).
5. §2.7 downloads stat header + active-queue cards + `download.*` additions.
6. §2.2 browse `activeSourceEyebrow` row.
7. §2.3 story-detail hero band + reorder + `story.*` additions.

### Agent B — "Listen & Read" (narration + hub fields)

1. §2.5 audio player restructure + `player.*` keys (depends on Agent A step 1 having
   landed the `eyebrow` type).
2. §2.4 hub label-rail rebuild + theme tiles + `reader.*` keys.
3. §2.5.1/2 chunk highlight + tap-to-move-voice inside reader.
4. §2.8 voices stat header + voice cards + preview + `narration.*` additions.
5. §2.9 pronunciation screen + `pronunciation.*` keys (UI against store contract).
6. §2.10 export actions + `/export` + `export.*` keys (against pure-module contract).
7. §2.11 history stats block + `stats.*` keys.
8. §2.12 settings hub rows + `settings.*` additions.

**Sequencing rule:** Step 1 of Agent A is a hard prerequisite for everything using
eyebrows; it should be a tiny standalone commit first. After that, A and B run in
parallel with zero file overlap.

---

## 8. Quick reference — new i18n groups/keys at a glance

- `library.*` — eyebrow/resume/hero/shelf/view toggle/new-chapter banner (§2.1)
- `browse.*` — +2 keys (§2.2)
- `story.*` — +2 keys (§2.3)
- `reader.*` — theme/align/spacing/margin labels, chapter eyebrow, reduce animation (§2.4)
- `player.*` — new group (§2.5)
- `import.*` — new group (§2.6)
- `download.*` / `downloads.*` — +5 keys (§2.7)
- `narration.*` — +7 keys (§2.8, §2.5)
- `pronunciation.*` — new group (§2.9)
- `export.*` — new group (§2.10)
- `stats.*` — new group (§2.11)
- `settings.*` — +3 keys (§2.12)

Exact key names live in the matching section above; if a key exists already, reuse it
rather than adding a near-duplicate.

— End of DESIGN.md —
