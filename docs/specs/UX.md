# Master Reader — UX specification

**Status:** adopted; this document is the implementation source of truth for all UI work.
**Supersedes:** every screen in the pre-rebuild app. The old Library, Browse, Audio,
History and Settings tabs, the series screens and the monolithic reader are replaced.
**Research basis:** `docs/research/2026-novel-reader-ux.md` (43 sources; `[S…]`
citations below resolve to its bibliography).

**Hard constraints**

- Android only, Expo SDK 57, React Native. Edge-to-edge, gesture and 3-button nav.
- 0 radius, no shadows, no gradients, no blur. Hairline borders and surface steps.
- All colours through `useAppTheme()`; all strings through `t()` and `src/i18n/en.json`.
- Touch targets 48dp minimum. Lists virtualised. 200 % font scale must work.
- Predictive back stays **off** for 1.0 (RN stack is not ready; see §5.2 of the research).
- Five tabs: Library · Updates · Browse · Audio · More. Labels always visible.

## 1. Executive decisions

1. **The category has converged on five tabs or fewer.** LNReader: Library / Updates / History / Browse / More `[S8]`. Shosetsu: Library / Updates / Browse / More `[S12]`. Arc Reader uses a library-first shell with a user-selectable "Classic" tab bar `[S2]`.
2. **The library is a cover grid with per-item progress and an unread badge.** Every serious app does this; LNReader shows an unread-count badge per cover and an optional "continue reading" button `[S7][S8]`; Arc Reader prints `CH 0/44` under every cover `[S6]`.
3. **"Continue reading" is a first-class object, not a list item.** Arc Reader dedicates a hero card above the shelf ("PICKING UP WHERE YOU LEFT OFF … Resume reading") `[S6]`; LNReader added _optional_ continue buttons on covers in v2.1.4 `[S9]`; Wattpad pins a "Continue Reading" row to the top of Home `[S20]`.
4. **Chapter lists are the hardest screen in the product.** 1,000–2,300 chapters is normal `[S10][S24]`. LNReader had a hard "1000 chapter limit selection" bug `[S10]` and only fixed >1000-row backups in v2.1.3 `[S9]`. Design for 5,000 rows on day one.
5. **Read/unread state must be a first-class, per-chapter boolean with bulk actions.** LNReader's novel screen has a full multi-select Actionbar: select-all, mark read, mark unread, download, delete `[S8]`.
6. **Reader chrome is a tap-to-toggle overlay, not a persistent bar.** Top bar + bottom bar fade in on centre tap; the bottom bar is 5 actions (prev / top / chapters / display / next) `[S8]`.
7. **Typography is a bottom sheet with segmented chips, not a settings page.** Arc Reader's sheet: Size slider (value 20), Font (4 chips), Theme (Light/Sepia/Dark/Void), Align, Spacing, Line height, Margin `[S6]`. LNReader's sheet has tabs Reader / General / TTS `[S8]`.
8. **Four reader themes are table stakes; AMOLED-black is the differentiator.** Arc Reader ships Light / Sepia / Dark / Void (true black) `[S2]`; LNReader exposes the same light-through-black range `[S8]`; ReadEra goes further with five modes (day, night, sepia, twilight, console) `[S18]`.
9. **Offline is the product, and downloads need a real manager.** Per-range progress, queue, cancel, Wi-Fi-only default, "start reading now" while the rest downloads `[S3][S4][S6]`.
10. **Android 16 removed the edge-to-edge opt-out, and Expo SDK 54+ already targets API 36** — so insets are not optional `[S29][S37][S39]`.
11. **Predictive back is a trap in RN right now.** React Navigation explicitly says it does not yet support it and tells you to set `android:enableOnBackInvokedCallback="false"` `[S43]`; Expo ships it **off by default** as of SDK 54 `[S37]`. Leave it off.
12. **A flat, 0-radius, dark-first theme is a legitimate design position** — it reads as "tool, not toy", matches the LNReader/Legado audience, and removes an entire class of visual bugs (shadow rendering, elevation mismatch, radius tokens). Compensate with hairline borders and surface-lightness steps, not shadows.

---

## 2. UX specification

> **How to read this section.** The ASCII wireframes are structural, not pixel-accurate. Every corner in production is **0 radius**; every divider is a **1px hairline**; no screen uses shadows. Dimensions are in dp. "App bar" means a 56dp bar below the status-bar inset.

### 6.0 Design principles

1. **The reader is the product; every other screen is a launchpad.** If a screen does not help the user reach or resume a chapter, it is secondary.
2. **Resume beats browse.** The most valuable pixel on any screen is the one that returns the user to the exact sentence they left.
3. **Density with air.** A 3-column cover grid, 8dp gutters and 16dp page margins; no decorative cards inside cards.
4. **State is visible.** Unread counts, download progress, last-checked timestamps and offline status are part of the layout, not toast messages.
5. **One accent.** A single primary colour marks the current tab, the primary button and the active chip. Everything else is surface steps and hairlines.
6. **No dead ends.** Every empty state offers the next action; every error offers retry plus an escape.
7. **Touch is generous.** 48dp minimum; primary actions in the bottom third; destructive actions never adjacent to primary ones.
8. **Motion explains, never decorates.** 150–200ms fades and slides; no bounce; respect reduced motion.
9. **Dark first, light equal.** Design the dark palette first, then verify light; AMOLED is a first-class third theme, not an afterthought.
10. **Trust is visible.** No ads, no account, no telemetry, no currency. Say it once; then prove it with export and offline.

### 6.1 App shell and navigation

**Five tabs, labels always visible, no FAB.**

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                         screen content                       │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│   ▣        ◷        ◎        ♪        ⋯                      │
│ Library  Updates   Browse   Audio    More                    │
└──────────────────────────────────────────────────────────────┘
```

| Tab     | Icon (Ionicons)       | Badge                                                         | Re-tap behaviour                     |
| ------- | --------------------- | ------------------------------------------------------------- | ------------------------------------ |
| Library | `library-outline`     | none                                                          | Scroll to top; reset category to All |
| Updates | `sync-outline`        | unread new-chapter count                                      | Scroll to top; refresh if stale      |
| Browse  | `compass-outline`     | source-update count (small dot, not a number)                 | Scroll to top                        |
| Audio   | `headset-outline`     | playing indicator (animated bars, static when reduced motion) | Open full player if playing          |
| More    | `ellipsis-horizontal` | active-download ring                                          | Scroll to top                        |

**Why these five.** Library and Updates are the retention loop; Browse is acquisition; Audio is the existing repo capability and a genuine differentiator; More absorbs History, Downloads, Sources, Settings and About. This is the LNReader/Shosetsu pattern with Audio promoted, and it fixes the current repo's two weakest tabs: **History** (a log, not a destination) and **Settings** (a utility, not a tab) `[repo]`.

**Tab bar spec**

- Height: `56 + insets.bottom`; background `backgroundElement`; top border `border` hairline.
- Label: 12sp/16, medium; active `primary`, inactive `textMuted`; always visible. Do not hide inactive labels (LNReader does; it hurts discoverability) `[S8]`.
- Icon: 24dp; 4dp gap to label; 48dp hit area per item.
- No translucency/blur. The tab bar is opaque so text never shows through.
- The bar must sit above the keyboard or hide when the keyboard opens (search screens are pushed and have no tab bar).

**Root stack**

```
Root Stack (headerShown: false)
├── (tabs)                         fade / no animation
│   ├── index        Library
│   ├── updates      Updates
│   ├── browse       Browse
│   ├── audio        Audio
│   └── more         More
├── search                         slide_from_right
├── story/[sourceId]/[id]          slide_from_right
├── chapters/[sourceId]/[id]       slide_from_right
├── reader/[sourceId]/[id]         fade (existing)
├── downloads                      slide_from_right
├── downloads/series/[seriesId]    slide_from_right
├── history                        slide_from_right
├── sources                        slide_from_right
├── audio/player                   slide_from_bottom (full-screen)
├── settings                       slide_from_right
│   ├── appearance
│   ├── reader
│   ├── downloads
│   ├── updates
│   ├── narration
│   ├── storage
│   ├── backup
│   └── about
├── restore
├── export
└── pronunciation
```

**Bottom sheets are not routes.** Sort, filter, category picker, download range, jump-to-chapter, reader display, voice picker, speed and sleep timer are component state rendered by a root `BottomSheetModalProvider`. Reasons: back closes the sheet without mutating the route stack; sheets survive a tab change if needed; deep links never open a sheet with no context. The only exception is a full-screen search, which is a route because it has its own history entry.

**Persistent download bar.** When any download is active, a 40dp bar sits directly above the tab bar on every tab except the reader:

```
┌──────────────────────────────────────────────────────────────┐
│ ↓ Downloading 312 / 1,203 · 26%          [ pause ]  [ open ] │
└──────────────────────────────────────────────────────────────┘
```

It is dismissible to a small pill on the More tab; the Downloads screen remains the source of truth. It never blocks content and never appears over the reader (the reader gets a one-line status in its top chrome instead).

**Global state rules**

| State         | Where it appears                 | Treatment                                                                                                                              |
| ------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Offline       | All tabs, pushed screens         | 32dp banner below the app bar: `Offline · downloads available`; local screens continue to work; network actions disabled with a reason |
| Syncing       | Updates, Browse, Sources         | Inline progress row, not a modal                                                                                                       |
| Downloading   | Global bar + Downloads           | Progress + pause; never a blocking spinner                                                                                             |
| Source broken | Updates, Browse, Story, Chapters | Per-source error row with `Retry` and `Diagnostics`; cached content remains readable                                                   |
| Empty         | Every collection                 | One sentence + one primary action + one secondary action                                                                               |
| Fatal (DB)    | App start                        | Full-screen `Couldn't open your library` + `Retry` + `Restore backup`                                                                  |

### 6.2 Screen inventory

Twelve screens. Each is specified with purpose, structure, states and interactions. Screens 1–5 and 12 are tab roots; the rest are pushed.

---

#### 6.2.1 Library

**Purpose:** the home surface. Resume the current read, see the whole collection, and enter any story in one tap.

**Key elements**

- App bar: title `Library`; actions: search (`⌕`), history (`↺`), overflow (`⋮`: select, sort, filter, update all, import file).
- Continue card (only when a last-read story exists): 56×84 cover, story title, `Chapter 214 · 42%`, 2dp progress bar, `Resume` button. Collapses to a 64dp row after the user scrolls 200dp.
- Category chips: `All`, `Unread 12`, `Downloaded`, then user categories; `+` opens the category sheet (create/rename/reorder/delete). Chips scroll horizontally; no wrap.
- Cover grid: 3 columns at `<600dp`, 4–5 at larger widths. Cover 2:3, title 2 lines, 2dp progress bar, unread count pill at top-right, download check at bottom-right, source dot at bottom-left.
- Sort/filter are in the overflow, not permanent chrome.
- Selection mode: contextual app bar (`3 selected`, select all, mark read, download, categorize, delete).

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ Library                                    ⌕   ↺    ⋮    │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ┌────┐  The Winter King                              │ │
│ │ │cov │  Chapter 214 · 42%                             │ │
│ │ └────┘  ████████████░░░░░░░░░░░░          [Resume]  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ [ All ] [ Unread 12 ] [ Downloaded ] [ RoyalRoad ] [ + ] │
│                                                          │
│   ┌───────┐    ┌───────┐    ┌───────┐                    │
│   │       │    │    ③  │    │       │                    │
│   │ cover │    │ cover │    │ cover │                    │
│   │       │    │       │    │       │                    │
│   └───────┘    └───────┘    └───────┘                    │
│   The Winter   Shadow of    A Pale                       │
│   King         the Moon     Horizon                      │
│   ▓▓▓░ 42%     ▓▓▓▓ 100%    ░░░░ 0%                      │
│                                                          │
│   ┌───────┐    ┌───────┐    ┌───────┐                    │
│   │       │    │       │    │       │                    │
│   └───────┘    └───────┘    └───────┘                    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│   Library     Updates     Browse      Audio       More   │
└──────────────────────────────────────────────────────────┘
```

**States**

| State          | Design                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Loading        | 6 skeleton covers (surface blocks at 8 % opacity) + 2 skeleton text lines; no spinner                                    |
| Empty          | `Your library is empty` / `Add a source to start, or import a file.` / primary `Browse sources`, secondary `Import file` |
| Filtered empty | `No unread stories` / `Clear filter` (primary); category chip remains visible so the user sees why                       |
| Offline        | Banner `Offline · showing what's on this device`; resume works; Browse/Search disabled with reason                       |
| Error          | `Your library couldn't load` / `Retry` / `Restore backup`; logs accessible from the overflow                             |
| Migrating      | Thin progress row `Updating library… 42 / 120` at the top; never a blocking screen                                       |

**Notable interactions**

- Tap cover → Story detail. Tap `Resume` → Reader at the saved scroll offset.
- Long-press cover → selection mode with haptic tick; tap additional covers to extend; `Select all` respects the active category/filter.
- Pull-to-refresh → checks sources for the visible category; failures are summarised in a sheet, not a global error.
- Re-tap the active Library tab → scroll to top, then reset to `All`.
- Category chips: tap to filter, long-press to rename/reorder/delete.

---

#### 6.2.2 Updates

**Purpose:** answer "what's new in my library?" and get the user into the newest unread chapter in one tap.

**Key elements**

- App bar: `Updates`; actions: refresh (`⟳`), overflow (`⋮`: mark all read, update settings).
- Filter chips: `All`, `Unread 14`, `Downloaded`.
- SectionList grouped by day (`Today`, `Yesterday`, `12 Oct`), sticky headers, 32dp.
- Row: 40×56 cover; story title; `Ch. 212–214 · 2h ago`; unread count; download state icon; per-row overflow.
- Footer: `Last checked 08:42 · 2 sources failed` with `Review` link.
- Tab badge: total unread new chapters (cap at `99+`).

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ Updates                                    ⟳      ⋮      │
│ [ All ] [ Unread 14 ] [ Downloaded ]                     │
│                                                          │
│ TODAY                                                    │
│ ┌────┐ The Winter King                          ● 3   ⋮  │
│ │cov │ Ch. 212–214 · 2h ago                     ↓      │
│ └────┘                                                   │
│ ┌────┐ Shadow of the Moon                       ● 1   ⋮  │
│ │cov │ Ch. 88 · 5h ago                          ✓      │
│ └────┘                                                   │
│                                                          │
│ YESTERDAY                                                │
│ ┌────┐ A Pale Horizon                           ● 2   ⋮  │
│ │cov │ Ch. 51–52 · 18h ago                      ↓      │
│ └────┘                                                   │
│                                                          │
│ Last checked 08:42 · 2 sources failed          Review →  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│   Library     Updates     Browse      Audio       More   │
└──────────────────────────────────────────────────────────┘
```

**States**

| State                | Design                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Loading              | 5 skeleton rows with date-header skeleton                                                    |
| Empty                | `You're all caught up` / `Last checked 08:42` / `Check now`                                  |
| Offline              | Banner `Offline · last checked 08:42`; refresh disabled; cached rows remain; no error dialog |
| Partial failure      | Footer `2 sources failed · Review` opens a sheet with source name, error class and `Retry`   |
| All failed           | `Couldn't check for updates` + `Retry` + `Open sources`; cached rows still shown             |
| New since last visit | A single 2dp `primary` line above the first new row, labelled `New since yesterday`          |

**Notable interactions**

- Tap row → Reader at the **first unread chapter of that story**. Per-row overflow offers `Chapter list`, `Mark read`, `Download`, `Mute story`.
- Swipe left → mark read (undo snackbar); swipe right → download (undo cancels). Both are accelerators; the overflow is the discoverable path.
- Pull-to-refresh is explicit; auto-check interval is configurable (default 6h).
- Long-press a row → multi-select with `Mark read`, `Download`, `Mute`.

---

#### 6.2.3 Browse

**Purpose:** discover new stories inside installed sources and find new sources. This is acquisition, not the library.

**Key elements**

- App bar: `Browse`; source selector chip (`NovelUpdates ▾`); overflow (`⋮`: manage sources, add repository, check source updates).
- Search field: `Search in NovelUpdates…`; tapping pushes Search with the source pre-selected (the field is a button, not an inline input, so the keyboard never covers the grid).
- Segmented control: `Popular` / `Latest` (rendered only if the source capability exists; otherwise a single list).
- Category chips from the source (only if `categories` capability exists).
- Results: 3-column cover grid with title and author; infinite scroll; a `Retry` row on page failure.
- Footer: source attribution and `Powered by <source>`; no branding confusion.

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ Browse                     [NovelUpdates ▾]        ⋮      │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Search in NovelUpdates…                          ⌕   │ │
│ └──────────────────────────────────────────────────────┘ │
│ [ Popular ] [ Latest ]                                   │
│ [ All ] [ Action ] [ Romance ] [ Sci-Fi ]                │
│                                                          │
│   ┌───────┐    ┌───────┐    ┌───────┐                    │
│   │       │    │       │    │       │                    │
│   │ cover │    │ cover │    │ cover │                    │
│   └───────┘    └───────┘    └───────┘                    │
│   The Winter   Shadow of    A Pale                       │
│   King         the Moon     Horizon                      │
│   K. Author    M. Vale      J. Doe                       │
│                                                          │
│   ...                                                    │
│                                                          │
│   Source: NovelUpdates · 12,480 stories                  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│   Library     Updates     Browse      Audio       More   │
└──────────────────────────────────────────────────────────┘
```

**States**

| State                   | Design                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Loading                 | 6 skeleton covers + chips; source name visible                                                     |
| Empty                   | `No stories in this category` / `Try another category` / `Clear filters`                           |
| No sources              | `No sources installed` / `Add a repository to browse` / `Add repository` (primary) + `Import file` |
| Offline                 | Banner; cached first page if available; otherwise `Browse needs a connection` + `Open downloads`   |
| Source error            | In-place panel: `NovelUpdates didn't respond` / `Retry` / `Switch source` / `Diagnostics`          |
| Source update available | Small dot on the source chip; `Update` in the source sheet                                         |

**Notable interactions**

- Source chip → bottom sheet listing installed sources with language and status; switching preserves the browse kind/category where possible.
- Tap cover → Story detail.
- Long-press cover → quick `Add to library` without opening detail (with a checkmark state).
- Infinite scroll: prefetch at 50 % viewport; show a 48dp footer spinner; on failure, a `Retry` row.
- Pull-to-refresh resets to page 1.

---

#### 6.2.4 Search

**Purpose:** find a story by title/author in the library or in one source, and add it without a detour.

**Key elements**

- Pushed screen; no tab bar; app bar is a single-row search field with back, input, clear.
- Source scope row: `Search in [NovelUpdates ▾]` + `Library` toggle. The library is always searchable offline.
- Idle state: recent searches (max 8, locally stored, individually removable) and a hint of the active source.
- Results: list rows with 40×56 cover, title, author, `1,203 ch · Ongoing`, source label, and a trailing `+` add button (changes to `✓` when in library).
- Result count + per-source failure footer.
- Keyboard: autofocus, `returnKeyType="search"`, `autoCapitalize="none"`, `autoCorrect={false}`.

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ ←  ┌────────────────────────────────────────┐      ✕     │
│    │ the winter                             │            │
│    └────────────────────────────────────────┘            │
│  Search in  [ NovelUpdates ▾ ]        [ Library ]        │
│                                                          │
│  RECENT                                                  │
│  the winter king                                    ✕    │
│  shadow moon                                        ✕    │
│  royal road                                         ✕    │
│                                                          │
│  ── results ──────────────────────────────────────────   │
│  ┌────┐ The Winter King                            [+]   │
│  │cov │ K. Author · 1,203 ch · Ongoing                  │
│  └────┘ NovelUpdates · EN                                │
│  ┌────┐ The Winter Court                           [✓]   │
│  │cov │ L. Hale · 88 ch · Completed                      │
│  └────┘ NovelUpdates · EN                                │
│                                                          │
│  48 results · 1 source failed                  Review →  │
└──────────────────────────────────────────────────────────┘
```

**States**

| State        | Design                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Idle         | Recent searches + `Search all sources` hint; no skeleton                                               |
| Loading      | 4 skeleton rows; keep the query visible                                                                |
| Empty        | `No results for "the winter"` / `Check the spelling, or try another source` / `Search library instead` |
| Offline      | Library results only; source row disabled with `Needs connection`; banner explains                     |
| Source error | Inline row `NovelUpdates didn't respond · Retry`; other sources' results still render                  |
| Rate-limited | `Too many searches · try again in 30s`; disable submit, keep results                                   |

**Notable interactions**

- Debounce 300ms; submit immediately on keyboard search; cancel in-flight requests on query change.
- Tap a result → Story detail. Tap `+` → add to library in place with a snackbar `Added to library · Undo`; no navigation.
- `Library` toggle searches local titles/authors instantly, even offline.
- Long-press a recent search → remove; `Clear all` in the overflow.
- Search history is local-only and excluded in incognito mode.

---

#### 6.2.5 Story detail

**Purpose:** decide whether to read, resume, or manage a story. This is the bridge between discovery and the chapter list.

**Key elements**

- Transparent app bar over the header: back, share, overflow (`Edit`, `Open source`, `Refresh chapters`, `Remove from library`).
- Header: 112×160 cover; title (2–3 lines); author; status (`Ongoing` / `Completed` / `Hiatus`); language; source chip; content tags.
- Progress block: `Chapter 214 of 1,203` + 2dp bar + `18%`; primary `Resume` (or `Start reading`).
- Action row: `Chapters` (opens list), `Download` (opens range sheet), overflow.
- Synopsis: 4 lines, `More`/`Less`; preserve expansion across recomposition.
- `Next up`: current + 2 next chapters with number, title, read state; `All chapters →`.
- If not in library: primary `Add to library`, secondary `Read first chapter`; progress block hidden.

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ ←                                                   ⋮    │
│   ┌────────┐  The Winter King                            │
│   │        │  K. Author                                 │
│   │ cover  │  Ongoing · 1,203 ch · EN                   │
│   │        │  [ NovelUpdates ]                          │
│   └────────┘  Action · Adventure · Drama                 │
│                                                          │
│   Chapter 214 of 1,203                                   │
│   ██████████████░░░░░░░░░░░░░░  18%                      │
│   ┌────────────────────────────────────────────────────┐ │
│   │                  Resume reading                    │ │
│   └────────────────────────────────────────────────────┘ │
│   [ Chapters ]   [ Download ]   [ Mark read ]            │
│                                                          │
│   Synopsis                                               │
│   Three years after the war, a cartographer returns      │
│   to a city that no longer appears on any map…           │
│   More                                                   │
│                                                          │
│   Next up                                                │
│   215  The Long Night                             →      │
│   216  Ashes                                      →      │
│   All chapters →                                         │
└──────────────────────────────────────────────────────────┘
```

**States**

| State                | Design                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Loading              | Cover block + 3 text skeletons + button skeleton; app bar visible                                 |
| Not in library       | `Add to library` primary; `Read first chapter` secondary; no progress block                       |
| Empty chapter list   | `No chapters found` / `The source may have changed` / `Refresh` + `Open source`                   |
| Offline, cached      | Full detail + banner; `Resume` works for downloaded chapters; `Download` disabled                 |
| Offline, not cached  | Title/author/cover from cache if available; `This story isn't available offline` + `Try again`    |
| Source error         | Cached metadata remains; inline `Source unavailable` panel with `Retry`; chapter actions disabled |
| Removed from library | Screen stays open with `Add to library`; back returns to the previous tab                         |

**Notable interactions**

- `Resume` → Reader at the saved offset, not the chapter start. If the chapter is missing locally and the user is offline, offer the nearest downloaded chapter.
- `Download` → range sheet: `Next 10`, `Next 50`, `Unread`, `All`, `Custom range` (number inputs with validation against 1…N). Shows estimated size.
- Long-press a `Next up` row → mark read/unread; tap → Reader.
- Pull-to-refresh → refresh metadata + chapter list; keep scroll position.
- Overflow `Remove from library` → confirm sheet that explains downloads are kept and offers `Delete downloads too`.

---

#### 6.2.6 Chapter list

**Purpose:** navigate a very large chapter list, find a specific chapter, and perform bulk read/download actions.

**Key elements**

- App bar: back, `Chapters`, search (`⌕`), overflow (`⋮`: sort, filter, select, mark all read).
- Summary row: `1,203 chapters · 214 read · 312 downloaded`.
- Filter chips: `All`, `Unread`, `Downloaded`, `Bookmarked`; sort `Asc`/`Desc`.
- Virtualised list, 56dp rows: number (48dp column, tabular numerals), title (1 line, ellipsis), date (optional), read dot, download icon, bookmark icon, per-row overflow.
- Volume/arc headers (if the source provides them) are sticky and collapsible.
- Current chapter is highlighted with a 2dp left border and `backgroundSelected`; auto-scroll to it on open.
- Floating `Jump` button bottom-right (above safe area), 48dp, opens the jump sheet.

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ ←  Chapters                                  ⌕      ⋮    │
│ 1,203 chapters · 214 read · 312 downloaded               │
│ [ Asc ] [ All ] [ Unread ] [ Downloaded ]                │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 212   The Gate                          ✓   ↓    ⋮   │ │
│ │ 213   Salt and Iron                     ✓   ↓    ⋮   │ │
│ │ 214   The Long Night                    ●   ↓    ⋮   │ │  ← current
│ │ 215   Ashes                                 ↓    ⋮   │ │
│ │ 216   The Keeper's Debt                     ↓    ⋮   │ │
│ │ ...                                                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                              ┌─────────┐ │
│                                              │ Jump  ⌗ │ │
│                                              └─────────┘ │
└──────────────────────────────────────────────────────────┘
```

**States**

| State          | Design                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Loading        | 12 skeleton rows; summary row skeleton                                                                               |
| Empty          | `No chapters yet` / `Refresh from source` + `Open source`                                                            |
| Offline        | `Downloaded` filter auto-suggested in a banner; non-downloaded rows remain visible but disabled with a download icon |
| Source error   | Cached list remains; top inline panel `Couldn't refresh · showing cached list`                                       |
| Selection mode | App bar becomes `3 selected` + `Select all` + actions (`Read`, `Unread`, `Download`, `Delete`); rows get checkboxes  |
| 5,000+ rows    | Jump + search are mandatory; do not rely on scroll                                                                   |

**Notable interactions**

- Tap row → Reader. Tap the current row → resume at saved offset.
- Long-press row → selection mode; after the first selection, a `Select range` action appears: tap a second row to select the inclusive range.
- `Jump` sheet: numeric input (`Go to chapter`) + a slider for coarse positioning + `Current` shortcut. Validate 1…N; show the chapter title as you type.
- Sort toggles Asc/Desc and preserves the current chapter position.
- `Mark read up to here` in the row overflow: marks all earlier chapters read after a confirm (`Mark 214 chapters as read?`).
- Volume headers collapse independently; the collapse state is remembered per story.
- The list uses `getItemLayout` with a fixed 56dp row; text scales but the row height grows to a minimum of 56dp, not a fixed height.

---

#### 6.2.7 Reader

**Purpose:** read text without friction. This is the only screen where chrome is an exception, not the rule.

**Key elements**

- Full-screen, edge-to-edge, no tab bar. Background = reader theme.
- Content: optional chapter eyebrow (`CHAPTER 214`), title, paragraphs. Default 18sp/1.6, 20dp side margins, max 68ch measure. Paragraph spacing 0.6em; first-line indent off by default (webnovel convention).
- Top chrome (fades in): back, story/chapter title (ellipsis), bookmark, overflow (`Chapter list`, `Download`, `Share`, `Open source`, `Report`).
- Bottom chrome (fades in): chapter progress bar + `214 / 1,203 · 18%`; 5 actions: `‹ Prev`, `☰ Chapters`, `Aa Display`, `♪ Listen`, `Next ›`.
- Tap zones: paged mode — left 30 % prev, centre 40 % toggle chrome, right 30 % next; scroll mode — any tap toggles chrome. Long-press selects text.
- End-of-chapter card: `Next: Ashes` + `Read next` primary; `Auto-advance` toggle; `Back to chapters`.
- TTS active: a 40dp pill above the bottom chrome: `Listening · 1.0× · 12:04` with pause/stop; tapping opens the full player.

**Wireframe — chrome visible**

```
┌──────────────────────────────────────────────────────────┐
│ ←   The Winter King · Ch. 214                  🔖   ⋮    │
│                                                          │
│                      CHAPTER 214                         │
│                     The Long Night                       │
│                                                          │
│   The gate was still open when she reached it.           │
│   Snow had begun to fall in the hour before dawn,        │
│   soft and deliberate, as if the sky were deciding       │
│   whether to commit.                                     │
│                                                          │
│   "You're late," said the keeper.                        │
│                                                          │
│   She did not answer. The lantern in her hand            │
│   guttered, and the dark beyond the gate seemed          │
│   to lean closer, listening.                             │
│                                                          │
│   ...                                                    │
│                                                          │
│   ████████████████░░░░░░░░░░░░░░░░░░░░                   │
│   214 / 1,203 · 18%                                      │
│    ‹        ☰        Aa        ♪        ›                │
└──────────────────────────────────────────────────────────┘
```

**Wireframe — display sheet**

```
┌──────────────────────────────────────────────────────────┐
│  Display                                            ✕    │
│                                                          │
│  Theme   [ Light ] [ Sepia ] [ Dark ] [ Black ]          │
│                                                          │
│  Size          −     18     +                            │
│  Font          [ Serif ] [ Sans ] [ OpenDyslexic ]       │
│  Line height   ─────────●────────  1.6                   │
│  Margins       ─────●────────────  20                    │
│  Align         [ Left ] [ Justify ]                      │
│                                                          │
│  Aa  The gate was still open when she reached it.        │
│                                                          │
│  Advanced ›   (hyphenation, custom CSS, paragraph gap)   │
└──────────────────────────────────────────────────────────┘
```

**States**

| State                   | Design                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Loading                 | Reader-theme background, centred 24dp spinner, `Loading chapter…`; if cached text exists, render it immediately and refresh silently |
| Offline, downloaded     | Normal reading; no banner (the absence of network is irrelevant)                                                                     |
| Offline, not downloaded | `This chapter isn't downloaded` / `Download chapter` (primary) / `Back to chapters`; explain that Wi-Fi may be required              |
| Source error            | `Couldn't load this chapter` / `Retry` / `Open in browser` / `Back`; cached text stays if present                                    |
| Empty content           | `This chapter is empty` / `Report source issue`; do not show a blank screen                                                          |
| End of chapter          | End card; `Read next`; auto-advance toggle; `Back to chapters`                                                                       |
| End of story            | `You're caught up` + `Back to library` + `Browse similar`                                                                            |
| TTS active              | Listening pill; sentence highlight in `primary` at 20 % alpha; auto-scroll keeps the spoken sentence at 1/3 height                   |
| Reduced motion          | Chrome snaps instead of fades; no page-turn animation                                                                                |

**Notable interactions**

- Tap centre → toggle chrome with a 150ms fade. Chrome auto-hides after 4s only if the user has not interacted with it.
- Back: close chrome first; second back returns to the chapter list. Never exit the app from the reader.
- Page turn: horizontal swipe or tap zones in paged mode; volume keys if enabled. In scroll mode, vertical scroll only.
- Long-press text → selection with `Highlight` (4 colours), `Note`, `Copy`, `Share`; highlights are stored locally and listed in the notebook (later phase).
- Progress bar drag → scrub within the chapter; release to jump. A chapter-level scrubber must not silently jump to another chapter.
- `Aa` opens the display sheet; changes apply live and persist globally (or per story if `Remember for this story` is on).
- `♪ Listen` starts TTS at the current paragraph; the Audio tab shows the same session.
- Screen keep-awake is on while reading, off when chrome is hidden? Keep on while the reader is focused; respect the system timeout if the user pauses for >5 min.
- Rotation: preserve scroll offset and chrome state; do not reload the chapter.

---

#### 6.2.8 Downloads

**Purpose:** make offline content legible, controllable and trustworthy. The user should be able to answer "what is on my phone, what is happening now, and how do I stop it?" without leaving the screen.

**Key elements**

- App bar: back, `Downloads`, overflow (`⋮`: Wi-Fi-only toggle, download settings, clear completed).
- Storage summary: `1.24 GB used · 34 stories · 8,421 chapters`; a 4dp stacked bar (downloaded vs free) and `Manage storage →`.
- Active section: `DOWNLOADING · 2` with a global pause/resume; per row: 40×56 cover, story, `Ch. 215–300 · 42 / 86`, progress bar, speed/ETA, cancel.
- Waiting section: `Waiting for Wi-Fi` / `Queued · 3` with position.
- Completed section: story rows with chapter count and size; tap → Story detail; overflow → `Delete download`.
- Failed section: reason (`Source unavailable`, `Storage full`, `Network lost`) + `Retry`.
- Delete confirmation explains exactly what is removed: `This deletes 86 chapters (12 MB). The story stays in your library.`

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ ←  Downloads                                       ⋮     │
│  1.24 GB used · 34 stories · 8,421 chapters              │
│  ████████████████████░░░░░░░░░░  62% of 2 GB             │
│                                                          │
│  DOWNLOADING · 2                              [ Pause ]  │
│  ┌────┐ The Winter King                                  │
│  │cov │ Ch. 215–300 · 42 / 86                    ✕       │
│  └────┘ ████████████░░░░░░░░  49% · 1.2 MB/s · 2m       │
│  ┌────┐ Shadow of the Moon                               │
│  │cov │ Ch. 89–120 · 0 / 32                      ✕       │
│  └────┘ Waiting for Wi-Fi                                │
│                                                          │
│  QUEUED · 3                                              │
│  A Pale Horizon · Ch. 1–50 · 12 MB                       │
│                                                          │
│  COMPLETED                                               │
│  The Long Road · 412 ch · 38 MB                  ⋮       │
│  Salt & Iron · 88 ch · 9 MB                      ⋮       │
│                                                          │
│  FAILED · 1                                              │
│  Ashfall · Source unavailable            [ Retry ]       │
└──────────────────────────────────────────────────────────┘
```

**States**

| State                   | Design                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Empty                   | `Nothing downloaded yet` / `Download a story to read without a connection.` / `Browse library`                                 |
| Active                  | Progress rows; global pause; per-item cancel; ETA only when a rate is known                                                    |
| Paused (offline / user) | `Paused · waiting for Wi-Fi` banner; `Resume` enabled only when the constraint is met                                          |
| Completed               | Story rows; `Delete` is destructive and confirmed                                                                              |
| Failed                  | Reason + `Retry`; a failed item never disappears silently                                                                      |
| Low storage             | Top warning `Less than 500 MB free`; block new downloads > free space with a clear message                                     |
| App restart             | Reconcile persisted queue; mark interrupted items `Paused` and resume explicitly (repo already recovers interrupted downloads) |

**Notable interactions**

- Cancel one item → immediate, snackbar `Cancelled · Undo`; cancel all → confirm.
- Delete completed download → confirm sheet; removing a download deletes its pages but **never** deletes a story's downloaded pages during a cache sweep (repo invariant) `[repo]`.
- Reorder the queue: long-press + drag (v1.1); v1 shows queue position only.
- `Wi-Fi only` is a switch in the overflow and in Settings; the default is **on**.
- Tapping the global download bar opens this screen.

---

#### 6.2.9 History

**Purpose:** a local, private log of what was read, and a fast way back into any of it.

**Key elements**

- App bar: back, `History`, search, overflow (`Clear history`).
- SectionList by day (`Today`, `Yesterday`, `12 Oct`), rows: 32×48 cover, story, `Ch. 214 · 18% · 14:32`, trailing `Resume` icon.
- Rows are grouped by story per day; multiple reads of the same story collapse into the latest one with a count (`2 sessions`).
- Incognito sessions are not recorded; the empty state says so.

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ ←  History                              ⌕          ⋮     │
│                                                          │
│ TODAY                                                    │
│ ┌────┐ The Winter King                                   │
│ │cov │ Ch. 214 · 18% · 14:32                      ▶      │
│ └────┘                                                   │
│ ┌────┐ Shadow of the Moon                                │
│ │cov │ Ch. 88 · 100% · 09:10                     ▶      │
│ └────┘                                                   │
│                                                          │
│ YESTERDAY                                                │
│ ┌────┐ A Pale Horizon                                   │
│ │cov │ Ch. 51 · 7% · 22:41                       ▶      │
│ └────┘                                                   │
│                                                          │
│ 42 sessions · stored on this device only                 │
└──────────────────────────────────────────────────────────┘
```

**States**

| State          | Design                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Loading        | 6 skeleton rows                                                                                                              |
| Empty          | `Nothing read yet` / `Stories you open will appear here.` / `Open library`                                                   |
| Incognito-only | `History is off in incognito mode` + `Turn off incognito`                                                                    |
| Offline        | Works fully; no banner                                                                                                       |
| Clear          | Confirm `Clear all history? This can't be undone.`; destructive button; no undo (or a 5s undo if implemented as soft delete) |

**Notable interactions**

- Tap row → Reader at the recorded position.
- Long-press row → `Remove from history`; multi-select for bulk removal.
- Search filters story titles and chapter titles; results update as you type.
- History is capped (default 500 entries) with a Settings control; oldest entries roll off.

---

#### 6.2.10 Settings

**Purpose:** one predictable place for preferences, with no hidden toggles. Every row states its current value.

**Key elements**

- Pushed screen; grouped list with sticky section headers; no tab bar.
- Sections: `Reading`, `Downloads`, `Updates`, `Appearance`, `Privacy`, `Backup`, `About`.
- Row types: navigation (`value ›`), switch, stepper, destructive.
- About block: version, licences, source code link, `18+`, `Unofficial · Not affiliated with any source`.
- A `Search settings` field is optional; with ~30 rows it is unnecessary in v1.

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ ←  Settings                                              │
│                                                          │
│  READING                                                 │
│   Reader defaults                      Serif · 18 ›      │
│   Tap zones & controls                        ›          │
│   Keep screen awake                       [●]            │
│                                                          │
│  DOWNLOADS                                               │
│   Wi-Fi only                              [●]            │
│   Concurrent downloads                    3 ›            │
│   Storage                              1.24 GB ›         │
│                                                          │
│  UPDATES                                                 │
│   Check for new chapters                 6 h ›           │
│   Notify me                               [●]            │
│   Auto-download new chapters              [ ]            │
│                                                          │
│  APPEARANCE                                              │
│   Theme                        Dark (AMOLED) ›           │
│   Use wallpaper colours                   [ ]            │
│   Language                            English ›          │
│                                                          │
│  PRIVACY                                                 │
│   Incognito mode                          [ ]            │
│   Clear cache                                 ›          │
│                                                          │
│  BACKUP                                                  │
│   Backup & restore                            ›          │
│   Export library                              ›          │
│                                                          │
│  ABOUT                                                   │
│   Version 1.0.0 · Licences · Source code                 │
│   18+ · Unofficial · Not affiliated                      │
└──────────────────────────────────────────────────────────┘
```

**States**

| State             | Design                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Default           | Static list; switches apply immediately                                                    |
| Export running    | Inline progress row `Exporting… 42%`; back is allowed; notification on completion          |
| Destructive       | `Clear cache` confirm explains that downloads are untouched; `Clear history` separate      |
| Language change   | Apply via per-app locale; a brief `Applying…` state; no full restart if Android handles it |
| Permission denied | `Notifications are off in Android Settings` + `Open settings` row, not a dead switch       |
| Storage full      | `Storage` row shows warning colour + `Manage`                                              |

**Notable interactions**

- Every switch is also a row label; tapping the row toggles it (not just the switch).
- `Theme` opens a sheet with four visual swatches: System, Light, Dark, Black; selecting previews immediately.
- `Reader defaults` opens a sub-screen with the same controls as the reader sheet, plus `Remember per story`.
- `Tap zones & controls` shows a diagram with three regions and toggles for volume keys and haptics.
- `Backup & restore` exposes local export, import, and (later) WebDAV; never a proprietary cloud.

---

#### 6.2.11 Source manager

**Purpose:** install, update and diagnose the extensions that provide content. This is the most trust-sensitive screen in the app.

**Key elements**

- App bar: back, `Sources`, `+` (add repository), overflow (`Check for updates`, `Developer mode`, `Diagnostics`).
- Summary: `12 installed · 2 updates · 1 broken`.
- Repositories section: URL, last sync, source count, overflow (refresh, remove).
- Installed list: 40dp icon/initial, name, language, version, status chip (`OK`, `Update`, `Broken`), enable switch.
- Add repository sheet: URL input, `Add`, explanation that extensions run in a sandbox and network access is brokered by the app.
- Broken source detail: error class, last successful fetch, `Retry`, `Open logs`, `Remove`.
- Empty state: `No sources yet` / `Add a repository URL to install sources.` / `Add repository`; link to docs.

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ ←  Sources                                    +     ⋮    │
│  12 installed · 2 updates · 1 broken                     │
│                                                          │
│  REPOSITORIES                                            │
│  ┌──────────────────────────────────────────────────────┐│
│  │ github.com/me/extensions                             ││
│  │ Last sync 08:42 · 12 sources                    ⋮    ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  INSTALLED                                               │
│  ┌──────────────────────────────────────────────────────┐│
│  │ [N] NovelUpdates     EN   1.2.0   OK          [●]    ││
│  │ [R] Royal Road       EN   2.0.1   Update      [●]    ││
│  │ [S] Syosetu          JA   0.9.0   Broken      [●]    ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  + Add repository                                        │
└──────────────────────────────────────────────────────────┘
```

**States**

| State            | Design                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| No repositories  | Empty state with `Add repository` + `Import file`; explain that sources are user-supplied         |
| Syncing          | Per-repo spinner + `Checking…`; list remains interactive                                          |
| Repo error       | Inline `Couldn't reach repository` + `Retry` + `Edit URL`                                         |
| Broken source    | Amber status; story screens still show cached content; `Diagnostics` copies a redacted report     |
| Update available | `Update` chip + `Update all` in the overflow; per-source update does not require an app restart   |
| Offline          | Cached repo metadata; add/update disabled with a reason                                           |
| Removing         | Confirm `Remove source? Stories already in your library stay, but new chapters can't be fetched.` |

**Notable interactions**

- Toggle a source off → it disappears from Browse/Search but remains installed; library stories keep their cached chapters.
- Tap a source → source detail: version, capabilities (`search`, `latest`, `categories`), last error, `Open in Browse`.
- Long-press a repo → copy URL, refresh, remove.
- `Developer mode` reveals the raw manifest, network log (redacted) and a `Reload sandbox` action; hidden behind 7 taps on the version row in About.
- The add sheet validates URL shape and fetches the manifest before installing; show the source count and permissions before `Install`.

---

#### 6.2.12 Audio

**Purpose:** listen to the current book, manage the queue, and control TTS without entering the reader.

**Key elements**

- App bar: `Audio`, overflow (`Voice settings`, `Sleep timer`, `Stop`).
- Now Playing card: 96×96 cover, story, chapter, current sentence (2 lines, ellipsis), transport (`prev chapter`, `play/pause`, `next chapter`), progress bar + elapsed/total, speed chip (`1.0×`), sleep-timer chip.
- Up Next: next 3 chapters with estimated duration; tap to jump; swipe to remove.
- Recent: last 3 listened sessions; tap to resume.
- Voice row: `Voice: System English (US) ›`.
- Empty/idle: `Nothing playing` / `Open a chapter and tap Listen, or pick up where you left off.` / `Open library`.

**Wireframe**

```
┌──────────────────────────────────────────────────────────┐
│ Audio                                              ⋮     │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ NOW PLAYING                                          │ │
│ │  ┌──────┐  The Winter King                           │ │
│ │  │cover │  Ch. 214 · The Long Night                  │ │
│ │  └──────┘  "The gate was still open when she…"       │ │
│ │                                                      │ │
│ │       ⏮        ⏸        ⏭        1.0×    ☾ 30m     │ │
│ │       ████████████████░░░░░░░░  14:02 / 22:10       │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│  UP NEXT                                                 │
│   215 · Ashes                                    22 min  │
│   216 · The Keeper's Debt                        19 min  │
│   217 · Salt                                       24 min│
│                                                          │
│  RECENT                                                  │
│   Shadow of the Moon · Ch. 88 · Yesterday                │
│   A Pale Horizon · Ch. 51 · 2 days ago                   │
│                                                          │
│  Voice: System English (US)                          ›   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│   Library     Updates     Browse      Audio       More   │
└──────────────────────────────────────────────────────────┘
```

**States**

| State              | Design                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Idle               | Empty state with `Open library`; no fake player                                                  |
| Playing            | Live progress; notification + lock-screen controls; sentence highlight if the reader is open     |
| Paused             | Same card, `Resume`; position persists across app restarts                                       |
| TTS engine missing | `No text-to-speech engine installed` / `Open Android settings` / `Use system voice` if available |
| Offline            | Local/system voices work; cloud voices disabled with `Needs connection`                          |
| Chapter end        | Auto-advance to the next chapter if enabled; otherwise `Chapter finished` + `Next`               |
| Sleep timer        | Chip shows remaining time; `End of chapter` option; stops cleanly at chapter boundary            |
| Error              | `Playback stopped` + reason + `Retry`; do not drop the queue                                     |

**Notable interactions**

- Play/pause, prev/next chapter, ±15s (in the full player), speed 0.75×–2×, sleep timer 5/15/30/60/end of chapter.
- Full player (pushed modal): large cover, chapter title, scrubber, sentence list, queue, voice picker. Swipe down to dismiss; playback continues.
- TTS starts at the current paragraph in the reader; the Audio tab and reader share one session (no duplicate playback).
- Audio focus: pause on a phone call or another app taking focus; resume only if it was playing before.
- Headset disconnect pauses; does not auto-resume through the speaker.

---

### 6.3 Typography scale

**UI face:** the Android system sans (Roboto) for every non-reader surface. It is free, familiar, has excellent hinting and supports all scripts. Do not bundle a display face for v1; the product's identity comes from layout and restraint, not a logo font.

**Reader faces:** three choices in v1 — **Serif** (Literata or Source Serif 4, both OFL), **Sans** (the system sans), **OpenDyslexic** (OFL). Add **Atkinson Hyperlegible** in v1.1. Bundle the fonts; do not rely on `fontFamily: 'serif'`, which resolves differently per OEM `[repo]`.

| Token        | Size / line height | Weight | Use                                                |
| ------------ | ------------------ | ------ | -------------------------------------------------- |
| `display`    | 48 / 52            | 600    | Age gate, first-run headline only                  |
| `title1`     | 32 / 38            | 600    | Story title on detail; full-player title           |
| `title2`     | 24 / 30            | 600    | Section titles, sheet titles, empty-state headline |
| `title3`     | 20 / 26            | 600    | App-bar title, card headline                       |
| `body`       | 16 / 24            | 400    | Default UI text, synopsis, settings labels         |
| `bodyStrong` | 16 / 24            | 500    | Emphasised body, selected row                      |
| `label`      | 14 / 20            | 500    | Buttons, chips, tabs, form labels                  |
| `caption`    | 12 / 16            | 400    | Metadata, timestamps, helper text                  |
| `eyebrow`    | 12 / 16            | 500    | Section eyebrows, uppercase, tracking 1.2          |
| `reader`     | 12–32 / 1.2–2.0×   | 400    | Chapter text; default **18 / 1.6**                 |

**Rules**

- **Weights: 400, 500, 700 only.** Android synthesises 600 poorly; map `title` tokens to 600 only if the bundled font has it, otherwise 700. For Roboto, use 500 for titles and 700 for strong emphasis.
- **Body is 400, not 500.** The current `ThemedText` default is 500 `[repo]`; that reads as "everything is a label" and flattens hierarchy. Change `default` to 400 and add `bodyStrong` for 500.
- **Numerals:** `fontVariant: ['tabular-nums']` on chapter numbers, progress percentages, timers and storage sizes. This prevents layout jitter during downloads.
- **No italics for long text.** Use weight and colour for emphasis; italics are reserved for titles of works and inline quotes.
- **Max 2 lines** for cover titles, 3 for list titles, 4 for synopsis before `More`.
- **Letter spacing** is 0 except `eyebrow` (+1.2) and `display` (−0.5). Never track body text.
- **Reader measure:** 45–75 characters; target **66–68**. At 18sp this is roughly 20dp margins on a 360dp screen; at tablet widths, cap the text column at 68ch and centre it.
- **Reader paragraph spacing:** 0.6em; first-line indent off. Webnovel chapters are short-paragraph prose; indentation wastes vertical space.
- **Font scaling:** all UI text uses `allowFontScaling` (default true). The reader's size control is an additional multiplier, not a replacement; clamp the combined result to 12–32sp to avoid breaking pagination.
- **Line height:** UI line heights are absolute; reader line height is a multiplier stored in settings (1.2–2.0, default 1.6). Do not store absolute px for the reader.

**Type fixes against the current repo**

| Issue                              | Current                              | Recommendation                            |
| ---------------------------------- | ------------------------------------ | ----------------------------------------- |
| Body too heavy                     | `default` weight 500                 | 400; add `bodyStrong` 500                 |
| Missing 24sp                       | 48/32/20/16/14/12                    | Add `title2` 24/30                        |
| `linkPrimary` hard-codes `#3c87f7` | Bypasses theme, wrong in dark/AMOLED | Use `palette.primary`; delete the literal |
| `subtitle` 32/44                   | Inconsistent with a 32/38 title1     | Unify to 32/38                            |
| Chapter rows                       | Proportional numerals                | Tabular numerals                          |

---

### 6.4 Spacing, layout and shape

**Base unit: 4dp.** Every margin, padding and gap is a multiple of 4; 2dp is allowed only for hairlines and optical nudges.

| Token      | Value | Use                                                   |
| ---------- | ----- | ----------------------------------------------------- |
| `half`     | 2     | Hairline offsets, badge inset                         |
| `one`      | 4     | Icon-to-label gap, tight inset                        |
| `two`      | 8     | Grid gutter, chip gap, compact padding                |
| `twoHalf`  | 12    | List row inner gap, button horizontal padding (small) |
| `three`    | 16    | Screen horizontal padding, card padding, default gap  |
| `four`     | 24    | Section gap, sheet padding, large gap                 |
| `five`     | 32    | Empty-state spacing, hero padding                     |
| `fiveHalf` | 48    | Touch target, app-bar height minus 8                  |
| `six`      | 64    | First-run/hero vertical rhythm                        |

The current scale is 2/4/8/16/24/32/64 `[repo]`; `twoHalf` and `fiveHalf` are additive, non-breaking. A later codemod can rename to numeric tokens, but do not renumber existing names — `Spacing.three` is used across the codebase.

**Layout constants**

| Constant           | Value                      | Notes                                                                     |
| ------------------ | -------------------------- | ------------------------------------------------------------------------- |
| Screen padding     | 16                         | Left/right on all screens                                                 |
| App bar height     | 56                         | Plus top inset                                                            |
| Tab bar height     | 56 + bottom inset          | Replaces the hard-coded 80                                                |
| Touch target       | 48                         | Raise from 44; 44 allowed only in dense icon clusters with 8dp separation |
| Hairline           | `StyleSheet.hairlineWidth` | Borders and dividers                                                      |
| Cover ratio        | 2:3                        | 104×156 at 360dp, 3 columns                                               |
| Grid gutter        | 8                          | Horizontal and vertical                                                   |
| List row height    | 56 min                     | Grows with font scale; never fixed                                        |
| Reader margin      | 20 default                 | Range 8–40                                                                |
| Reader max measure | 68ch                       | Centred on tablets                                                        |
| Content max width  | 800                        | Existing `MaxContentWidth`; use for settings and forms                    |
| Sheet max height   | 90 %                       | Scrollable content; drag handle 32×2                                      |

**Shape**

- **Radius 0 everywhere.** Buttons, cards, chips, covers, sheets, badges, modals. No exceptions for "softness".
- **No shadows.** Android `elevation` also changes z-order and produces OEM-specific shadows. Use `borderWidth: hairline` plus a surface step (`background` → `backgroundElement` → `backgroundSelected`).
- **No gradients.** A flat surface is the identity. If a cover needs a scrim for text, use a solid `overlay` at 60 %.
- **No blur.** Blur is expensive on mid-range GPUs and reads as iOS. The one exception is a modal scrim, which is a solid colour.
- **Progress bars** are 2dp high with square ends; the track is `border`; the fill is `primary`. Download progress uses `primary`; read progress uses `textMuted` so it does not compete with unread badges.
- **Badges** are 16dp squares (not circles) with 10sp tabular numerals; unread counts only. A badge is a count, never a decorative dot.
- **Dividers** are inset 16dp from the start, full-bleed at section boundaries. Never use a divider as the only grouping cue; add 24dp of space.

**Motion**

| Interaction            | Duration | Easing                                            |
| ---------------------- | -------- | ------------------------------------------------- |
| Chrome fade            | 150ms    | `ease-out`                                        |
| Screen push            | 250ms    | `ease-in-out` (platform default)                  |
| Sheet present          | 250ms    | `ease-out`; drag-to-dismiss follows the finger    |
| Selection mode         | 150ms    | `ease-out`; layout shift is instant               |
| Progress updates       | 200ms    | linear; never animate a determinate bar backwards |
| Page turn (paged mode) | 200ms    | `ease-out`; slide only, no curl                   |

Respect `AccessibilityInfo.isReduceMotionEnabled()`: replace fades/slides with instant cuts, disable page-turn animation, and keep progress updates but remove the transition.

---

### 6.5 Component inventory

The repo already has a solid primitive layer (`AppBar`, `Button`, `Chip`, `EmptyState`, `ErrorState`, `IconButton`, `LoadingView`, `OfflineBanner`, `OptionSheet`, `Screen`, `SegmentedControl`, `TextField`) `[repo]`. The table below is the full target set; **bold** items are missing or need a significant rework.

#### Primitives

| Component          | Variants                               | States                               | Notes                                                                    |
| ------------------ | -------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `Screen`           | default, scroll, list                  | —                                    | Owns safe-area insets and background; never nests                        |
| `AppBar`           | root, pushed, contextual, transparent  | default, scrolled                    | 56dp; title 20/26; max 2 actions + overflow                              |
| **`TabBar`**       | 5-item                                 | active, inactive, badge, disabled    | Custom or React Navigation bar; labels always visible                    |
| `IconButton`       | 40, 48                                 | default, pressed, disabled, selected | 48dp hit area; `accessibilityLabel` required                             |
| `Button`           | primary, secondary, ghost, destructive | default, pressed, loading, disabled  | 48dp height; 16dp padding; 0 radius                                      |
| `TextField`        | single-line, multiline, search         | default, focus, error, disabled      | 48dp; `borderStrong` on focus; error text 12sp                           |
| **`SearchField`**  | inline, app-bar                        | idle, focus, filled                  | Back/clear affordances; 300ms debounce                                   |
| `Chip`             | filter, category, input                | default, selected, disabled          | 32dp visual height, 48dp hit area; 12dp padding; checkmark when selected |
| `SegmentedControl` | 2–3 segments                           | selected, disabled                   | 40dp visual, 48dp hit area; equal widths; no sliding pill (0 radius)     |
| `SwitchRow`        | —                                      | on, off, disabled                    | Entire row tappable; 48dp min                                            |
| `ListRow`          | nav, value, switch, destructive        | default, pressed, disabled           | 56dp min; leading/trailing slots                                         |
| `SectionHeader`    | sticky, plain                          | —                                    | 12sp eyebrow + 8dp top padding                                           |
| `Divider`          | inset, full                            | —                                    | Hairline; `border` colour                                                |
| **`Badge`**        | count, status                          | —                                    | 16dp square; tabular numerals; max `99+`                                 |
| **`ProgressBar`**  | determinate, indeterminate             | 0–100                                | 2dp; square ends; `accessibilityValue`                                   |
| `LoadingView`      | screen, inline, skeleton               | —                                    | Skeleton blocks, no shimmer by default                                   |
| `EmptyState`       | screen, section                        | —                                    | Icon/glyph, title, one sentence, 1–2 actions                             |
| `ErrorState`       | screen, inline                         | —                                    | Plain-language cause + retry + escape                                    |
| `OfflineBanner`    | global, inline                         | —                                    | 32dp; `warning` surface at 12 %; no modal                                |
| **`Snackbar`**     | info, undo, error                      | —                                    | Above tab bar; 4s; one action; queue max 1                               |
| **`BottomSheet`**  | standard, full-height                  | open, dragging, closed               | 0 radius; top border; drag handle 32×2; `insets.bottom`                  |
| **`SheetHeader`**  | title, title+action                    | —                                    | 24dp padding; close 48dp                                                 |
| **`Stepper`**      | numeric                                | min, max                             | 48dp buttons; value 16sp tabular                                         |
| **`Slider`**       | continuous, stepped                    | —                                    | 48dp touch area; value label above thumb                                 |
| **`Cover`**        | grid, row, hero                        | loading, loaded, error               | 2:3; `expo-image`; fallback with initials                                |
| **`SourceChip`**   | —                                      | ok, update, broken                   | 24dp; source name + status dot                                           |

#### Domain components

| Component                 | Variants                         | States                                      | Notes                                                  |
| ------------------------- | -------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| **`ContinueCard`**        | full, compact                    | present, hidden                             | Cover, progress, resume; collapses on scroll           |
| **`CategoryChips`**       | —                                | selected, editable                          | Horizontal scroll; long-press reorder                  |
| **`StoryGridItem`**       | —                                | unread, read, downloading                   | Cover + title + progress + badges; one accessible node |
| **`StoryListRow`**        | —                                | unread, read, downloading                   | 40×56 cover; title, author, meta; trailing action      |
| **`ChapterRow`**          | —                                | read, unread, current, downloaded, selected | 56dp; tabular number; 2dp current border               |
| **`DownloadRow`**         | active, queued, failed, complete | —                                           | Progress, ETA, cancel/retry                            |
| **`StorageSummary`**      | —                                | normal, low                                 | Stacked bar + counts                                   |
| **`SourceRow`**           | —                                | ok, update, broken, disabled                | Version, language, toggle                              |
| **`TTSPill`**             | —                                | playing, paused                             | 40dp; speed + time; opens player                       |
| **`PlayerControls`**      | compact, full                    | —                                           | 48dp; prev/play/next; accessible labels                |
| **`ReaderChrome`**        | top, bottom                      | visible, hidden                             | Owns fade + insets; 5 actions                          |
| **`ReaderSettingsSheet`** | —                                | live                                        | Theme, size, font, line height, margins, align         |
| **`JumpSheet`**           | —                                | valid, invalid                              | Number input + slider + current shortcut               |
| **`RangeSheet`**          | —                                | valid, invalid, estimated                   | Presets + custom range + size estimate                 |
| **`SelectionBar`**        | —                                | count, all                                  | Replaces app bar; destructive last                     |
| **`NotebookSheet`**       | —                                | empty, filled                               | Highlights/notes; later phase                          |

**Component rules**

- Every interactive component accepts a `testID` and an `accessibilityLabel`; icon-only buttons are not allowed without one.
- Every list row is a single accessibility node with a combined label (`The Winter King, chapter 214 of 1203, 18 percent, 3 unread`).
- Every destructive action uses `destructive` styling and a confirm sheet; every destructive action that can be undone gets a snackbar with `Undo`.
- No component owns its own horizontal margin; screens own padding, components fill.
- Sheets are rendered at the root so they survive navigation; they receive `insets.bottom` explicitly.

---

### 6.6 Colour and contrast

The token architecture is right: semantic names (`background`, `backgroundElement`, `text`, `textSecondary`, `textMuted`, `border`, `primary`, …) consumed through `useAppTheme()` `[repo]`. The values need three fixes and one addition.

#### Current contrast audit

| Pair                                        | Ratio    | Verdict                                          |
| ------------------------------------------- | -------- | ------------------------------------------------ |
| Light `text` `#11181C` on white             | 17.93    | Pass                                             |
| Light `textSecondary` `#5B6169` on white    | 6.25     | Pass                                             |
| Light `textMuted` `#8A9099` on white        | **3.22** | **Fail** for normal text                         |
| Light `primary` `#3C87F7` on white          | **3.50** | **Fail** as text and as a button with white text |
| Light `danger` `#E5484D` on white           | **3.91** | **Fail** for normal text                         |
| Light `success` `#30A46C` on white          | **3.16** | **Fail** for normal text                         |
| Light `warning` `#F5A524` on white          | **2.04** | **Fail** badly                                   |
| Dark `textMuted` `#7C8189` on `#101014`     | 4.84     | Pass (barely)                                    |
| Dark `primary` `#4D9BFF` on `#101014`       | 6.73     | Pass                                             |
| AMOLED `textMuted` `#6E727A` on black       | **4.35** | **Fail**                                         |
| AMOLED `primary` `#4D9BFF` on black         | 7.45     | Pass                                             |
| Reader Sepia `muted` `#7A6E5A` on `#F4ECD8` | **4.24** | **Fail**                                         |
| Reader Light `muted` `#6B6B6B` on white     | 5.33     | Pass                                             |
| Reader Dark `muted` `#9AA0A6` on `#14161A`  | 6.86     | Pass                                             |
| Reader Black `muted` `#8A8F94` on black     | 6.44     | Pass                                             |

#### Recommended token changes

| Token                  | Current   | New                                               | Ratio | Why                                                                 |
| ---------------------- | --------- | ------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| Light `textMuted`      | `#8A9099` | `#6B7280`                                         | 4.83  | Metadata, timestamps, inactive tabs                                 |
| Light `primary`        | `#3C87F7` | `#2563EB`                                         | 5.17  | White text on primary, links, active tab                            |
| Light `danger`         | `#E5484D` | `#C62828`                                         | 5.62  | Error text and destructive buttons                                  |
| Light `success`        | `#30A46C` | `#197A4B`                                         | 5.35  | Success text/icons                                                  |
| Light `warning`        | `#F5A524` | `#8A5A00`                                         | 5.93  | Warning text; use a `#F5A524` fill only with black text and an icon |
| AMOLED `textMuted`     | `#6E727A` | `#80858D`                                         | 5.66  | Metadata on true black                                              |
| Sepia reader `muted`   | `#7A6E5A` | `#6B5F4D`                                         | 5.29  | Chapter metadata in sepia                                           |
| **New** `borderStrong` | —         | light `#80858D`, dark `#646873`, AMOLED `#62666F` | ≥3:1  | Input outlines, focus rings, selected controls                      |

Notes:

- `border` stays a low-contrast decorative divider (1.2–1.4:1). That is correct for _dividers_; it is not sufficient for an input boundary. Add `borderStrong` and use it on text fields, focused controls and selection outlines.
- Do not use `warning #F5A524` as a text colour on white. Use `#8A5A00` for text and reserve the bright amber for fills with `#11181C` text.
- `primaryText` is white in light (5.17 with the new primary) and `#04121F` in dark/AMOLED (6.70/6.70) — both pass.
- The light palette's `backgroundElement #F0F0F3` vs white is 1.12:1. It is a surface step, not a boundary; pair it with 16dp padding and a `borderStrong` outline where the component needs to be identified (inputs).
- **AMOLED is a global theme, not a reader-only theme.** The entire app switches to true black; the reader uses the Black palette. Do not mix `#101014` chrome with `#000000` content (Royal Road's mistake) `[S27]`.

#### Reader palettes

| Theme | Background | Text      | Muted     | Note                                  |
| ----- | ---------- | --------- | --------- | ------------------------------------- |
| Light | `#FFFFFF`  | `#1A1A1A` | `#6B6B6B` | Pure white; good for LCD              |
| Sepia | `#F4ECD8`  | `#3B3226` | `#6B5F4D` | Warm, low blue light                  |
| Dark  | `#14161A`  | `#E6E6E6` | `#9AA0A6` | Not pure black; reduces smear on OLED |
| Black | `#000000`  | `#EDEDED` | `#8A8F94` | AMOLED; true black                    |

- Do not apply `primary` to body text. Highlight tint: `primary` at 20 % alpha; underlined links use `primary` with an underline, not colour alone.
- Reader chrome uses the reader palette, not the app palette; the status bar icon style follows the reader theme.
- The `muted` token is for chapter metadata only (chapter number, reading time); body text never uses it.

---

### 6.7 Cross-screen state matrix

Every screen must implement these four states before it is considered done. This is the QA checklist.

| Screen       | Loading                | Empty                   | Error                       | Offline                    |
| ------------ | ---------------------- | ----------------------- | --------------------------- | -------------------------- |
| Library      | Skeleton grid          | Add source / import     | Retry + restore             | Banner + local content     |
| Updates      | Skeleton rows          | All caught up           | Partial/all failed + retry  | Last-checked banner        |
| Browse       | Skeleton covers        | No stories / no sources | Inline source panel         | Cached or needs connection |
| Search       | Skeleton rows          | No results + suggestion | Per-source retry            | Library-only               |
| Story detail | Skeleton header        | No chapters             | Source unavailable + cached | Cached + disabled actions  |
| Chapter list | Skeleton rows          | No chapters + refresh   | Cached list + banner        | Downloaded filter          |
| Reader       | Spinner or cached text | Empty chapter + report  | Retry / browser / back      | Missing-chapter CTA        |
| Downloads    | —                      | Nothing downloaded      | Failed + retry              | Paused + waiting for Wi-Fi |
| History      | Skeleton rows          | Nothing read yet        | —                           | Works fully                |
| Settings     | —                      | —                       | Permission denied row       | Works fully                |
| Sources      | Per-repo spinner       | No repositories         | Repo error + retry          | Cached metadata            |
| Audio        | —                      | Nothing playing         | Playback error + retry      | Local voices only          |

A dash means the state **cannot occur** because the screen renders only local state (for example, Settings has no remote fetch and therefore no loading or error state); it is not an omission. Audio's idle state is its empty state.

**State rules**

- **Loading is never a full-screen spinner** unless the screen has no cached data. Prefer skeletons that match the final layout.
- **Empty is not an error.** Empty states are calm and instructive; errors are explicit and offer retry.
- **Offline is not an error either.** It is a mode. Local screens (Library, History, Downloads, Settings) work silently; only network-dependent surfaces show a banner.
- **Partial failure is the norm.** A single broken source must not blank the screen. Show what succeeded, summarise what failed, and offer per-source retry.
- **Every destructive action is reversible or confirmed.** Prefer undo; use a confirm sheet when data cannot be restored.
- **Every timestamp is absolute + relative.** `Today 08:42` and `2h ago`; never a bare `2h ago` that becomes wrong after a day.

---

### 6.8 Handoff plan and phasing

**Phase 0 — foundations (1–2 weeks)**

- Add `title2`, `bodyStrong`; change body weight to 400; remove the hard-coded `linkPrimary` colour.
- Add `twoHalf` and `fiveHalf` spacing; raise `MinTouchTarget` to 48; derive tab-bar height from insets.
- Fix the seven contrast tokens; add `borderStrong`; audit all semantic colour usages.
- Build `BottomSheet`, `Snackbar`, `Badge`, `ProgressBar`, `Stepper`, `Slider`, `Cover`; document in a Storybook-like gallery route (dev only).

**Phase 1 — shell and library (2–3 weeks)**

- Replace the current 5 tabs with Library / Updates / Browse / Audio / More; move History and Settings to root routes.
- Build Library (continue card, category chips, grid, selection), Updates (sections, filters, retry), and the global download bar.
- Implement the state matrix for Library/Updates.

**Phase 2 — story and chapters (2–3 weeks)**

- Story detail with progress, actions, synopsis, next-up.
- Chapter list with virtualisation, jump sheet, filters, multi-select and range select.
- Downloads screen with queue, pause/resume, storage, delete confirm.

**Phase 3 — reader (3–4 weeks)**

- Reader chrome, tap zones, display sheet, progress, bookmarks, end-of-chapter.
- Scroll and paged modes; persist position per chapter; 200 % font-scale tests.
- TTS integration with the Audio tab; sleep timer; sentence highlight.

**Phase 4 — sources, settings, audio (2–3 weeks)**

- Source manager (repos, updates, broken states, diagnostics).
- Settings (all sections, per-app language, backup/export).
- Audio tab and full player; notification channels.

**Phase 5 — polish and accessibility (1–2 weeks)**

- TalkBack pass, 200 % font pass, contrast pass, reduced-motion pass.
- Gesture-nav and 3-button-nav pass; tablet/foldable pass.
- Performance: 1,000-chapter list, 500-book library, cold start, reader scroll.

**Definition of done for every screen**

- [ ] All four states implemented (loading / empty / error / offline).
- [ ] 48dp targets; TalkBack labels; reading order; 200 % font scale.
- [ ] Works with gesture and 3-button navigation; correct insets.
- [ ] No hard-coded colours or strings; `useAppTheme()` and `t()` only.
- [ ] Dark, light and AMOLED verified; reader themes verified separately.
- [ ] No shadow, no radius, no gradient, no blur.
- [ ] Loading does not shift layout; lists virtualised; images sized.
- [ ] Destructive actions confirmed or undoable.
- [ ] Analytics: none. Crash reporting: none by default (FLOSS constraint).

---

## 3. Implementation mapping (Master Reader)

This section binds the UX spec to the repository. If a screen and this table disagree,
fix one of them in the same change.

### 3.1 Route tree (expo-router)

```
src/app/_layout.tsx                     root stack, providers, age gate, lazy BrowserHost
src/app/(tabs)/_layout.tsx              five-tab bar (labels always visible)
src/app/(tabs)/index.tsx                Library
src/app/(tabs)/updates.tsx              Updates            (new)
src/app/(tabs)/browse.tsx               Browse
src/app/(tabs)/audio.tsx                Audio
src/app/(tabs)/more.tsx                 More               (new; replaces Settings tab)
src/app/search.tsx                      Search
src/app/story/[sourceId]/[id].tsx       Story detail
src/app/chapters/[sourceId]/[id].tsx    Chapter list
src/app/reader/[sourceId]/[novelId]/[chapterId].tsx   Reader
src/app/downloads/index.tsx             Downloads
src/app/downloads/[sourceId]/[novelId].tsx            Per-novel download detail
src/app/history.tsx                     History
src/app/sources.tsx                     Source manager
src/app/settings/index.tsx              Settings
src/app/settings/{appearance,reader,downloads,updates,narration,storage,backup,about}.tsx
src/app/audio/player.tsx                Full player
```

Deleted in the rebuild: `(tabs)/history.tsx`, `(tabs)/settings.tsx`,
`series/[sourceId]/[id].tsx`, `downloads/series/[seriesId].tsx`. History and Settings
move to root routes; series was a Literotica-only concept.

Sheets (sort, filter, category, download range, jump, display, voice, speed, sleep)
are component state rendered by a root sheet provider. They are not routes. Search is
the one full-screen exception because it owns a history entry.

The reader route takes the chapter id in the path so back/forward and deep links are
deterministic. `sourceId`, `novelId` and `chapterId` are opaque URL-safe ids; encode each
segment with `encodeURIComponent` when building a route and validate on entry.

### 3.2 Screen → data

All reads go through repositories; screens never call a source directly. All network
calls go through `catalog`/`chapter-sync`, never from a component.

| Screen       | Primary data                                             | Remote work                                      |
| ------------ | -------------------------------------------------------- | ------------------------------------------------ |
| Library      | `library_entries` ⋈ `stories` + progress + unread counts | none on open; manual refresh allowed             |
| Updates      | `story_updates` ⋈ library/stories + `source_health`      | update check on open if stale, per-novel refresh |
| Browse       | source registry + listing cache + filters                | `getListing` / `search`                          |
| Search       | current source or enabled sources                        | `search` with debounce, per-source results       |
| Story detail | `stories` + `chapters` + progress + library state        | detail refresh, chapter sync                     |
| Chapter list | `chapters` + read state + download state                 | chapter-list sync, range download                |
| Reader       | `chapters.content` + progress + narration state          | fetch chapter if absent, silent refresh          |
| Downloads    | `chapter_downloads` + aggregate `downloads`              | queue/pause/resume/retry/delete                  |
| History      | `history` ⋈ stories/chapters                             | none                                             |
| Settings     | settings repo                                            | backup/export, storage, permissions              |
| Sources      | source registry + `source_health`                        | diagnostics, test fetch                          |
| Audio        | narration store + voices + chapter text                  | voice packs, network voices only                 |

Unread counts are `chapters` rows without a matching read state, not a cached counter.
Download badges are `chapter_downloads.status = 'completed'` counts. Broken-source
state comes from `source_health`, not from a failed render.

### 3.3 Reader pipeline

The reader is **native React Native**, not a chapter WebView. The WebView remains only
inside the lazy Cloudflare `BrowserHost`; it is never mounted for reading.

1. `chapters.content` holds sanitized HTML produced once at ingest.
2. A pure decoder (`src/sources/content/parse.ts`) turns that HTML into
   `ChapterBlock[]` — `heading | paragraph | image | blockquote | divider | pre`.
   It never emits raw HTML and never uses `htmlToPlainText`.
3. `ChapterRenderer` is a virtualised `FlatList` of blocks with stable keys and a
   56dp minimum row height. Links open in the in-app browser, not the reader.
4. TTS chunks are derived from blocks and carry `{blockIndex, spanStart, spanEnd}`.
   The narration service/engines stay; only the span adapter changes. Sentence
   highlight is a styled `Text` span, not a re-render of the chapter.
5. Progress writes `chapter_id`, `paragraph_index` (block index), `char_offset` and
   `scroll_pct`; writes are throttled and flushed on blur. Restore uses
   `scrollToIndex` with a cached chapter, so an offline reopen is instant.
6. Prev/next, chapter list, and jump all navigate by chapter id. There is no 25-chapter
   cap and no index-as-identity anywhere.
7. Reader display settings: four themes (light/sepia/dark/black), size 14–32 default 18,
   line height 1.3–2.0 default 1.6, margins 8–40 default 20, serif/sans/OpenDyslexic,
   left/justify. Global by default; per-novel override stored on the story row.
8. Paged mode is phase 5. Ship scroll mode first (correct, accessible, fast); add
   measured page splitting only after the scroll reader passes device QA. Do not fake
   paging with fixed-height slices.

### 3.4 Tokens and primitives

- `src/theme/palettes.ts`: apply the seven contrast fixes, add `borderStrong`, add the
  AMOLED global palette. `src/theme/index.tsx`: add `title2` (24/30), `bodyStrong`
  (16/24), set body weight 400; add `Spacing.twoHalf = 12` and `Spacing.fiveHalf = 48`;
  raise `MinTouchTarget` to 48. Keep existing token names.
- `src/theme/reader.ts`: four reader palettes exactly as §6.6; chrome follows the
  reader palette, status bar style follows the reader theme.
- New primitives in `src/components/ui/`: `tab-bar`, `search-field`, `badge`,
  `progress-bar`, `snackbar`, `bottom-sheet`, `sheet-header`, `slider`, `cover`,
  `source-chip`. Rework `button`, `chip`, `text-field`, `app-bar` for 0 radius and
  48dp targets. Existing `Screen`, `EmptyState`, `ErrorState`, `LoadingView`,
  `OfflineBanner`, `SegmentedControl`, `OptionSheet` are kept and restyled.
- New domain components in `src/components/novel/`: `ContinueCard`, `StoryGridItem`
  (rework), `StoryListRow` (rework), `ChapterRow`, `DownloadRow`, `StorageSummary`,
  `SourceRow`, `TTSPill`, `PlayerControls`, `ReaderChrome`, `ReaderSettingsSheet`,
  `JumpSheet`, `RangeSheet`, `SelectionBar`.
- No component owns horizontal margins; screens own the 16dp padding. Every icon-only
  control has an `accessibilityLabel`; every row is one accessibility node.

### 3.5 State, strings and QA hooks

- The four-state matrix in §6.7 is the acceptance checklist per screen. Cached content
  renders before any spinner. Partial source failure never blanks a screen.
- Every user-facing string goes to `src/i18n/en.json`; plural forms use the existing
  translator helpers. No literal English in components.
- Every interactive element gets a stable `testID` (`library.continue`, `reader.next`,
  `chapter.jump`, …) so device tests can drive it.
- Offline is a mode, not an error. Local screens stay silent; network surfaces show the
  32dp banner with a reason.
- Analytics and crash reporting stay absent (FLOSS constraint).

### 3.6 Deviations from the research report

| Report                          | Implementation                   | Why                                                                                                |
| ------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Chapter body in a WebView       | Native block renderer            | TTS spans, TalkBack, offline restore and scroll performance; the WebView stays only for Cloudflare |
| `downloads/series/[seriesId]`   | `downloads/[sourceId]/[novelId]` | Novels, not Literotica series                                                                      |
| Settings has top-level sections | `settings/index` + subroutes     | Preserves existing deep links and the pure backup flow                                             |
| Search route may be a sheet     | Full-screen route                | It owns a history entry and is reachable from two tabs                                             |
| Predictive back                 | Off for 1.0                      | RN/Expo stack not ready; documented risk                                                           |
| Paged reader                    | Phase 5 after scroll reader      | Quality gate: no fake pagination                                                                   |

## 4. Research provenance

The full research report — Arc Reader teardown, LNReader/Shosetsu/Legado/Moon+/ReadEra
comparison, Android 16 contracts, contrast calculations, 43 sources and explicit
unknowns — is at `docs/research/2026-novel-reader-ux.md`. It is background, not
normative; this document is normative.
