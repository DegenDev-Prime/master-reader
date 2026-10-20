# Mobile Novel-Reader UX — State of the Art (2025–2026)

**Purpose:** research input for a ground-up UX spec for an Android-first, offline-first novel reader built with Expo SDK 57 / React Native / expo-router.
**Date:** October 2026.
**Rule applied throughout:** every claim is attributed; anything I could not verify is marked **unknown**. Nothing below is invented.

Sources are numbered `[S1]…[S43]` and listed in full at the end. The marker `[repo]` refers to the current Master Reader repository (this project), not to an external source.

**Contents**

- [0. Executive summary — the 12 things that actually matter](#0-executive-summary--the-12-things-that-actually-matter)
- [1. Identifying "Arc Reader"](#1-identifying-arc-reader)
- [2. LNReader — the closest open-source peer](#2-lnreader--the-closest-open-source-peer)
- [3. The specialist readers — Shosetsu, Legado, Moon+ Reader, ReadEra, Librera](#3-the-specialist-readers--shosetsu-legado-moon-reader-readera-librera)
- [4. Commercial benchmarks — Wattpad, Webnovel, Royal Road](#4-commercial-benchmarks--wattpad-webnovel-royal-road)
- [5. Android-native feel (2025–2026)](#5-android-native-feel-20252026)
- [6. Deliverable — UX specification](#6-deliverable--ux-specification)
- [7. Sources](#7-sources)
- [8. What remains unknown](#8-what-remains-unknown)

---

## 0. Executive summary — the 12 things that actually matter

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

## 1. Identifying "Arc Reader"

### 1.1 It is a real, specific app — and I found it

The project owner is almost certainly referring to **Arc Reader / ArcReader**, published by **Not A Simple Studio**:

| Field                     | Value                                                                           | Source |
| ------------------------- | ------------------------------------------------------------------------------- | ------ |
| Website                   | `https://arcreaders.app/`                                                       | `[S1]` |
| Google Play               | `com.notasimplestudio.arcreaders` — "ArcReader: Web Novel Reader"               | `[S2]` |
| App Store                 | id6762717697 — "ArcReader: Web Novel Offline"                                   | `[S1]` |
| Positioning               | "offline-first web novel reader … Paste any novel link, download every chapter" | `[S2]` |
| Status at time of writing | v1.0-era, updated 13 Oct 2026, 5K+ installs, 4.8★/264 reviews                   | `[S2]` |

**Disambiguation — there are at least three unrelated "ARC" reading apps.** Do not conflate them:

- **ARC / `arcreader.co`** — interactive branching fiction ("shape the story", "Shorts") `[S1 search results]`. Different product, different company (ARC Interactive, Inc.).
- **ARC Library / `arc-library.com`** — a tracker for Advance Reader Copies (book-review management) `[S1 search results]`.
- **Novel Arc** — an App Store novel app `[S1 search results]`.

The referent here is unambiguous: the project is a web-novel reader, and ArcReader (`arcreaders.app`) markets itself explicitly as an **LNReader alternative** — "Loved by readers switching from Wattpad, WebNovel, and light novel reader apps like LNReader" `[S2]`.

### 1.2 What Arc Reader actually ships (feature inventory)

From the marketing site `[S1]`, the Play listing `[S2]`, the support site `[S5]` and the product blog `[S3][S4]`:

**Import**

- Paste a novel URL; or share a page from Chrome to the app; or use the in-app browser; or search across sources `[S1][S3]`.
- Resolves title, author, cover, and the full chapter list "in under a second"; then asks **which range to download** — "All", "Latest 50", or a custom slice `[S3]`.
- Import EPUB / PDF / MOBI / TXT / DOCX as first-class "books" `[S1]`.
- "Request a source" from inside the app `[S1]`.

**Library**

- Two content types behind a segmented control: **NOVELS | BOOKS** `[S6]`.
- Categories, user-orderable, swipeable shelf "Drag your categories into your own order, or swipe the shelf to switch" `[S2 reviews]`. An "Uncategorized" filter exists `[S2 changelog]`.
- Hero resume card + cover grid with `CH n/total` per cover `[S6]`.

**Reader**

- Themes: Light, Sepia, Dark, **Void** (true black) `[S6]`; marketing copy says "Light, sepia, dark, true black, or colours you mix yourself" `[S1]`.
- Fonts: at least Newreader, Lora, Quicksand, Merriweather — "a dozen reading fonts" `[S1][S6]`.
- Controls: size slider (shows numeric value), font, theme, alignment (Left/Justify), spacing (Tight/Normal/Loose), line height (Tight/Normal/Airy), margin (Narrow/Normal/Wide) `[S6]`.
- Page-turn modes: "Paper page curl, slide, or one long scroll into the next chapter" `[S1]`; volume keys turn pages; two-page spreads on tablets `[S1]`.
- E-ink mode for Boox `[S1]`.
- Autoscroll (mentioned in a review) `[S2]`.

**Listen (TTS)**

- Full-screen "NOW LISTENING" player: collapse chevron, overflow menu, cover art, chapter eyebrow + title + book title, chapter text with the **currently spoken sentence highlighted** `[S6]`.
- On-device neural voices, 140 voices / 31 languages; voice manager screen with install state (`2 / 17 installed`, `121 MB on device`) and per-voice size + description `[S1][S6]`.
- Speed 0.75×–2×, sleep timer, lock-screen controls, auto-advance `[S2]`.
- Pronunciation rules per novel `[S1]`.
- Paragraph tap moves the voice there; "the spoken-word highlight glides along the line" `[S2 changelog]`.

**Downloads**

- "Offline library" screen: totals (`30 CHAPTERS`, `1 NOVELS`), a `DOWNLOADING · 2` section with per-range rows (`CH 1-30 · 10 / 30`, `33` remaining, `downloading`), progress bars, per-item **Cancel**; a queued section (`Queued — starting soon`); a completed section with chapter counts `[S6]`.
- Wi-Fi-only by default, cellular toggle in settings; downloads continue with the app closed `[S3][S4]`.
- When ~10 % of a batch is in, a "Start now" prompt appears so you can read while the rest downloads `[S4]`.
- Storage guidance: 30–80 KB per chapter, ~30–50 MB for 700 chapters `[S4]`.

**Updates**

- Shelf polls for new chapters, notifies, and can auto-download new chapters `[S1]`.

**Settings (observed structure)**

- `Settings → Tab bar` offers **Classic** vs a newer style `[S2 changelog]`.
- `Settings → About`, `Settings → Subscription → Restore`, `Settings → Send feedback` (attaches diagnostics) `[S5]`.
- `Settings →` downloads (Wi-Fi only), language (`12 languages`, follows the phone) `[S1]`.

**Other surfaces**

- Highlights & notes in 4 colours; per-book notebook `[S1][S2]`.
- Reading stats, streaks, points, weekly leaderboard `[S1][S2]`.
- Translation with your own AI key + bilingual layout + dictionary/flashcards `[S1]`.
- Home-screen widget (`shelf, progress and new chapters at a glance`) `[S1]`.
- Cloud backup + cross-device sync `[S1]`.

### 1.3 What users praise (verbatim, from Play reviews)

- "App made by a novel reader for novel readers. The dev is super receptive… Everything is free thanks to ads and the ads aren't even much. I kinda get surprised every time I see them because I'll listen to so many chapters and only then get an ad." `[S2]`
- "It's so easy to find books from places like Wattpad and Novel Updates and listen to them here." `[S2]`
- "Amazing reader, minimum ads and nice autoscroll feature, can even download chapters… Even has a catalogue of famous websites you can read from and you can add your own pretty easily." `[S2]`
- App Store: "Was looking for this type of app having all novel sites on one app like tachiyomi now i can finally read my novel with offline too" `[S1]`
- Changelog-driven praise signals: the team ships weekly-ish and takes feature requests (`Leaderboard`, `Uncategorized filter`, `Classic tab bar` all shipped in one release) `[S2]`.

**What this tells us:** the praise is about (a) _breadth of sources_, (b) _real offline_, (c) _TTS that doesn't sound robotic_, (d) _low ad load_, (e) _a responsive solo/small-team dev_. Not about visual novelty. The bar for "beautiful" is lower than the bar for "trustworthy and fast".

### 1.4 What I could NOT verify about Arc Reader

- The **exact tab set** of the shipping app. The marketing screenshots show a Library screen and an Add Novel sheet, and Settings exposes a "Tab bar" style choice, but no screenshot shows the full tab bar. **unknown.**
- The **novel detail screen** layout (cover, metadata, action row, chapter preview). It is implied by the flow ("You see the title, author, cover, full chapter list… pick a range") `[S3]` but never shown. **unknown.**
- The **full chapter-list screen** (filters, multi-select). **unknown.**
- Whether the chapter list groups by **volume/arc**. **unknown.**
- Exact **tap-zone map** in the reader. **unknown.**
- Whether downloads use a foreground service, WorkManager, or a JS timer. **unknown.**

> **Benchmarking consequence:** for the screens Arc Reader doesn't document, benchmark against LNReader (which I could read the source of) and the commercial apps. Do not attribute invented layouts to Arc Reader.

---

## 2. LNReader — the closest open-source peer

Repo: `github.com/LNReader/lnreader` (MIT, ~2.9k★, Android 7+) `[S7]`. v2.1.4 released 26 Sep 2026 `[S9]`. This is the single most useful reference because **the source is readable**, so the IA below is fact, not inference.

### 2.1 Navigation shell

From `src/navigators/BottomNavigator.tsx` `[S8]`:

```
Library | Updates | History | Browse | More      ← bottom tab navigator
```

- `Updates` and `History` are **optional tabs**, toggled in settings (`showUpdatesTab`, `showHistoryTab`).
- Tab labels are **hidden by default** (`showLabelsInNav = false`) — the README screenshot confirms: only the active tab shows its label `[S7][S8]`.
- Icons: `bookmark-box-multiple`, `alert-decagram-outline`, `history`, `compass-outline`, `dots-horizontal`.
- The **Browse tab carries a numeric badge** = number of installed plugins with an available update.
- Tab transition is `fade`, screens are `lazy`.

### 2.2 Library

`src/screens/library/LibraryScreen.tsx` + `LibraryBottomSheet.tsx` `[S8]`:

- Cover **grid** (3-up in the screenshot) or list; each cover has a **blue unread-count badge** top-left `[S7]`.
- Category tabs across the top; per-category sort/filter memory.
- Search bar in the header. When a query has no local hits, it offers **"search globally"** as a row.
- Header overflow menu: `Update library`, `Update category`, `Import EPUB`, `Open random`.
- Filter sheet: **Downloaded / Unread / Started / Completed**.
- Sort: Alphabetical, Last read, Last updated, Download count, Total chapters, Unread count, Date added — each with ASC/DESC.
- Display: grid/list, **download badges**, **unread badges**, "show number of items", display mode.
- Multi-select toolbar: set category, **mark all read**, **mark all unread**, delete.
- Empty state: "empty category" + a **Browse** button.
- FAB: **Resume** (jumps straight back into the last-read chapter).
- v2.1.4 added **optional continue-reading buttons on covers and list rows** `[S9]`.

The README screenshot shows the visual language plainly: dark surface, search field, dense 3-column covers, tiny unread pill, title below, 5-icon bottom bar `[S7]`.

### 2.3 Browse

- Two tabs: **Sources** and **Plugins** (`PluginsTab.tsx`, `SourcesTab.tsx`).
- Sources list = pinned section + all sources; each row is `icon · name · language · [Browse] · pin`.
- Header actions: search sources, sort, settings.
- Also ships **Discover** rails (AniList top novels, MAL top novels), **Global search**, and **Migration** (move a library between sources) `[S8]`.
- Per-source **settings screen** driven by a schema (`PluginSettingField.tsx`).

### 2.4 Novel detail

`src/screens/novel/` `[S8]`:

- `NovelInfoHeader` (cover, title, author, status, genres, summary), `ReadButton`, `NovelScreenButtonGroup`.
- Chapter list with `NovelChapterGroup` (grouping exists), `ChapterItem`, per-chapter `ChapterDownloadButtons`.
- `JumpToChapterModal`, `DownloadCustomChapterModal` (range picker), `ExportEpubModal`.
- `NovelDrawer` for chapter filtering; `NovelFloatingActions`; `PagePaginationControl`.
- Multi-select: `useChapterSelection` + `Actionbar` with select-all / mark read / mark unread / download / delete.
- Tracker integration (MangaUpdates etc.) via `TrackSheet`.

### 2.5 Reader

`src/screens/reader/` `[S8]`:

- `ReaderScreen` → `WebViewReader` (the chapter body is HTML in a WebView; custom CSS/JS is a feature).
- `ReaderAppbar`: back, title + subtitle, **search-in-chapter**, **bookmark**, overflow menu (`Refresh`, `Open in WebView`, `Open in browser`, `Share`).
- `ReaderFooter`: **5 buttons** — `PREV`, `scroll to start`, `chapter drawer`, `reader settings`, `NEXT`.
- `ChapterDrawer`: slide-in chapter list with a persistent border (a known cosmetic bug: "Chapter Drawer border remains visible while collapsed" `[S10]`).
- `ReaderBottomSheet`: three tabs — **Reader**, **General**, **TTS**.
  - Reader tab: theme swatches, line height, padding, font.
  - General tab: fullscreen, show battery+time, show progress %, vertical seekbar, remove extra spacing, **bionic reading**, keep screen on, autoscroll, swipe gestures, volume buttons, page-reader mode, tap-to-scroll, invert volume buttons, disable page transitions.
  - TTS tab.
- `KeepScreenAwake`, `SkeletonLines` for loading, `sanitizeChapterText` before render.

**Reader theme presets** (`src/utils/constants/readerConstants.ts`) — note the exact hex values, they are a good starting palette:

| Preset     | Background | Text                     |
| ---------- | ---------- | ------------------------ |
| Light      | `#f5f5fa`  | `#111111`                |
| **Sepia**  | `#F7DFC6`  | `#593100`                |
| Green-grey | `#dce5e2`  | `#000000`                |
| Dark       | `#292832`  | `#CCCCCC`                |
| **Black**  | `#000000`  | `#FFFFFFB3` (70 % white) |

Plus user-saved custom themes (bg + text colour).

**Fonts bundled:** Original, Lora, Nunito, Noto Sans, Open Sans, Arbutus Slab, Domine, Lato, PT Serif, **OpenDyslexic**.

**Reader behaviour flags:** `useVolumeButtons`, `volumeButtonsOffset`, `verticalSeekbar`, `swipeGestures`, `pageReader`, `pageReaderInvertVolumeButtons`, `pageReaderDisableAnimation`, `autoScroll`, `autoScrollInterval`, `autoScrollOffset`, `tapToScroll`.

Text size was raised from a max of **20 → 50** in v2.1.3 `[S9]` — plan for very large text.

### 2.6 Updates / History / Downloads / More

- **Updates**: `SectionList` grouped by date, per-novel row with new-chapter count, search, "update library" action, `RefreshControl`, and a "last updated at" footer `[S8]`.
- **History**: `SectionList` grouped by day, each row = novel + chapter + timestamp, search, "clear history" dialog, empty state "nothing read recently" `[S8]`.
- **More**: Downloaded-only mode toggle, Incognito mode toggle, **Task Queue**, **Downloads**, **Categories**, **Stats**, **Settings**, **About** `[S8]`.
- **Downloads**: grouped by novel → chapters, with remove dialogs.
- **Task Queue**: per-task cancel (added v2.1.4) `[S9]`.

### 2.7 What LNReader users complain about

From the open issue list (Aug 2026) `[S10]` and release notes `[S9]`:

| Complaint                                       | Evidence                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Library wiped / not loading after an update** | #1966 "Library completely empty after updating from an old version (2.1.1/latest did not recover data, 2.02 GB app data still exists)"; v2.1.1 hotfix "Restored missing library entries, chapter counters, download badges, unread badges" |
| **New novels don't appear after adding**        | #1963                                                                                                                                                                                                                                      |
| **1000-chapter ceiling**                        | #1960 "1000 chapter limit selection"; v2.1.3 fix "Include all chapters beyond the 1000-row UI limit in backups"                                                                                                                            |
| **Lag opening big novels**                      | #1950 "Heavy Lag upon opening new novels"; #1951 "Error upon novel opening"; v2.1.3 "Fix novel screen scroll lag"                                                                                                                          |
| **Reader toolbar not rearrangable**             | #1957 "Novel Reader Tool Bar rearrange"                                                                                                                                                                                                    |
| **Update tab doesn't show chapter names**       | #1952                                                                                                                                                                                                                                      |
| **Update-tab download action broken**           | #1962                                                                                                                                                                                                                                      |
| **Chapter drawer border artifact**              | #1965                                                                                                                                                                                                                                      |
| **Source breakage is constant**                 | README/community; `lnreader-sources` is a separate repo `[S11]`                                                                                                                                                                            |
| **TTS regressions**                             | Reddit: "TTS no longer one click" after 2.0.0 `[S10 search]`                                                                                                                                                                               |
| **Backup format churn**                         | 2.0.0 moved `.json` → `.zip`; older backups don't include downloads/progress `[S9][S10]`                                                                                                                                                   |

**Transferable lessons:** migrations are a UX surface, not a backend detail; a 1,000-row cap in a selector is unacceptable; the toolbar _will_ be asked to be customisable; and users notice a 1-pixel border artifact in the reader drawer.

---

## 3. The specialist readers — Shosetsu, Legado, Moon+ Reader, ReadEra, Librera

These five are the "power user" reference set. None is a commercial platform; all optimise for control over the text. They are useful precisely because they have already explored the parameter space of reader settings, and because their users are the same people who will judge this app.

| App               | Model                                      | Why it matters here                                                         |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| **Shosetsu**      | Open-source, extension-based, Material You | The closest design cousin after LNReader; proves a four-tab shell is viable |
| **Legado (阅读)** | Open-source, user-authored source rules    | The high-water mark for source-rule flexibility and per-book overrides      |
| **Moon+ Reader**  | Proprietary, local files + network         | The high-water mark for gesture/tap customisation and auto-scroll           |
| **ReadEra**       | Proprietary, local files                   | The high-water mark for zero-config onboarding and reading-status shelves   |
| **Librera**       | Proprietary, local files                   | The high-water mark for per-format modes and RSVP                           |

### 3.1 Shosetsu — the four-tab proof

Shosetsu is an open-source Android light-novel reader distributed via GitLab, F-Droid and Uptodown, with a Material You–aware UI `[S13][S14]`.

**Shell.** Four bottom tabs: **Library / Updates / Browse / More** `[S13]`. There is no History tab; History lives inside **More**, alongside Downloads, Categories and Settings `[S13]`. This is the single strongest piece of evidence that the five-tab norm is a ceiling, not a floor — and that History does not deserve permanent navigation real estate in a reader whose primary loop is _library → chapter → next chapter_.

**Library.** Cover grid with categories and unread state. The important pattern is that **the library is the only "collection" surface** — there is no separate "My stuff" hub.

**Reader.** Reader configuration is unusually deep: F-Droid markets a "fully customisable reader" `[S14]`, and themes follow Material You, so the reader can inherit the system wallpaper palette `[S14]`. That is a genuine differentiator on Android and is available to us through `@expo/ui`'s Material Colors `[S33]`.

**Extensions.** Sources are installed from repositories, exactly like LNReader `[S13]`. The extension list is a first-class screen with enable/disable and update state.

**What to steal**

- Four tabs: Library, Updates, Browse, More. History belongs in the Library app bar and More.
- An advanced escape hatch (custom CSS or equivalent) hidden behind "Advanced" in the typography sheet — never a primary control.
- Material You as an optional theme source, not the default identity.

**What to reject**

- CSS injection as the only path to real typographic control. It is unapproachable for 95 % of users; presets must be excellent first.

### 3.2 Legado (阅读) — the source-rule engine

Legado is a Chinese open-source reader whose defining feature is a **user-editable rule engine**: a book source is a data document describing search, detail, chapter-list and content rules, and users import/export these documents freely `[S15]`. It is the most flexible reader in this survey by a wide margin.

> **Status note (October 2026).** Legado's upstream GitHub repository has been reduced to a legal notice about copyright liability and removed content `[S15]`; the feature description below is drawn from its pre-removal README and documentation `[S15]`. The lesson is not only technical: **a reader that ships only a rule engine is still legally exposed.** Our extension model must remain user-supplied and unbundled, and the app must never ship source rules or credentials.

**Library.** List or grid shelf, user-defined groups, cover/title/author/unread; local files (TXT/EPUB) sit alongside network books `[S15]`.

**Reader.** Page modes: **cover (page-turn), simulation, slide, scroll** `[S15]`. This is a superset of what most apps offer and maps cleanly onto a single `pagination` enum. Also: TTS, text-replacement rules (regex), custom fonts, and importable/exportable reader configurations `[S15]`.

**Sync/backup.** WebDAV backup and restore, so the library and progress survive device loss without a vendor account `[S15]`. For a FLOSS app with no cloud, WebDAV is the honest answer to "how do I move my library?"

**What to steal**

- **Per-book overrides.** A book should be able to pin its own font size, theme and page mode without changing global defaults. This is the correct resolution of the "global vs per-book" tension; Legado's portable `readConfig` object is the model `[S15]`.
- **Replacement rules** (regex find/replace applied at render time) as a power-user feature for scraping artefacts.
- **WebDAV backup** as the sync story, with local export as the baseline.
- Page modes as a small enum, not four separate reader implementations.

**What to reject**

- The rule editor as a user-facing primary flow. It is a developer tool. Our extension manifest (`src/extensions/manifest.ts`) is the right layer; do not expose raw selectors in the app UI.
- Configuration density without defaults. Legado's settings tree is a maze; every advanced control must sit behind a sensible default.

### 3.3 Moon+ Reader — the gesture laboratory

Moon+ Reader is the benchmark for configurability of input. Its Play listing advertises **10+ themes**, **24 operations mapped across 15 gesture/event types**, **5 auto-scroll modes**, **left-edge brightness control**, and **5 page-flip animations** `[S16]`. The shelf is organised into Favorites / Downloads / Authors / Tags `[S16]`. Format coverage is equally broad — txt, html, epub, pdf, djvu, mobi, azw/azw3, fb2, docx, odt, rtf, cbr, cbz, markdown and OPDS catalogues — which is why it is the default comparator for local-file reading `[S17]`.

**What to steal**

- **Left-edge vertical drag = brightness.** It is one-handed, requires no chrome, and does not conflict with horizontal page turns. This is the single best reader gesture in the category.
- **Auto-scroll with a speed control.** It is the killer feature for long web-novel chapters and is repeatedly praised in Arc Reader reviews `[S2]`.
- **Per-book settings memory.** Moon+ documents backup and sync of reading positions, bookmarks and notes `[S16]`; extend that persistence to display settings. Users expect a 700-chapter novel to reopen exactly as they left it, including theme and size if they chose "remember for this book".
- **Shelf facets by author/tag.** A cheap, useful alternative to a separate "Authors" screen.

**What to reject**

- **24 × 15 mapping.** A settings matrix that large is a support burden and an accessibility hazard. Ship a fixed, documented tap-zone map plus one optional "volume keys turn pages" toggle.
- **Skeuomorphic page curls.** They cost frames, look dated on a 120 Hz OLED, and fight the flat/0-radius identity. Offer slide and scroll; that is enough.

### 3.4 ReadEra — the zero-config benchmark

ReadEra's onboarding is its product: it **auto-detects books already on the device** and presents them as a library without an import wizard `[S18]`. It splits the shelf into **Favorites / To Read / Have Read**, supports collections, and claims a 500,000-book library test `[S18]`. Reader themes: **day, night, sepia, twilight, console** `[S18]`. It also ships quotes, bookmarks, translation and a kids mode `[S18]`. Format support spans EPUB, MOBI/AZW3, FB2, PDF, DjVu, DOC/DOCX/RTF, ODT, TXT and CBR/CBZ, including books inside zip and rar archives `[S19]`.

**What to steal**

- **Zero-config first run.** Our equivalent is "scan for local EPUB/TXT on first launch" plus "add a source repository". Do not open on an empty grid with a single "Add" button.
- **Reading-status shelves** (To read / Reading / Finished) as built-in smart filters, not a separate tagging system.
- **"Console" high-contrast theme.** A pure-black/high-contrast option is an accessibility feature, not a gimmick; it maps to our AMOLED theme.
- **Quote capture** with a share sheet. Highlights are already in Arc Reader; make export trivial.

**What to reject**

- **File-manager DNA.** ReadEra's IA assumes the user thinks in folders. A source-based reader should think in _stories_, with local files as one source among many.
- **Kids mode.** The app is 18+; an age gate already exists. Do not add a second, conflicting age surface.

### 3.5 Librera — the mode collector

Librera's differentiator is **mode plurality**. It documents vertical-scroll lock, page- or screen-wise navigation, and a **Musician's mode** that auto-scrolls at a configurable speed; it also offers configurable Day and Night modes, a **customisable tap-zone map**, **RSVP** speed reading, custom CSS, and volume-key remapping `[S21][S22]`.

**What to steal**

- **Per-mode presets.** Librera treats Day and Night as separately configurable modes `[S22]`; extend that idea to per-format presets. A web-novel chapter and an EPUB with footnotes want different margins, hyphenation and page modes. Store presets keyed by content type, not one global blob.
- **Tap-zone editor with a diagram.** If zones are customisable, show a picture of the screen divided into regions; do not describe them in prose.
- **Chapter tick marks on the progress bar (our extension).** Neither source documents chapter ticks on Librera's progress indicator, so treat this as our addition rather than a copy: a persistent, low-chrome indicator of chapter boundaries is better than a hidden bookmark list and costs almost nothing to draw.
- **RSVP as an optional mode.** It is niche, but it is cheap to add later and it is a genuine differentiator for speed readers.

**What to reject**

- **Mode sprawl as IA.** Multiple overlapping viewing modes plus a tap-zone matrix is too many nouns. We should ship one scroll mode and one paged mode, and make the choice a single segmented control in the reader sheet.

### 3.6 Cross-app synthesis

| Dimension      | Category norm           | Best-in-class                   | Our position                                  |
| -------------- | ----------------------- | ------------------------------- | --------------------------------------------- |
| Bottom tabs    | 4–5                     | Shosetsu 4, LNReader 5          | **5**: Library, Updates, Browse, Audio, More  |
| Library layout | Grid, 3-up              | LNReader cover grid + badges    | Grid default, list toggle, per-cover progress |
| Read state     | Per-chapter boolean     | LNReader multi-select Actionbar | Per-chapter + bulk range actions              |
| Reader chrome  | Tap-to-toggle overlay   | LNReader 5-button bar           | 5-button bar + scrubber                       |
| Themes         | 3–5                     | Arc Reader 4, ReadEra 5         | 4: Light, Sepia, Dark, Black                  |
| Typography     | Sheet with presets      | Arc Reader sheet                | Sheet, 2 tabs max, live preview               |
| Input          | Tap zones + volume keys | Moon+ left-edge brightness      | Fixed zones, volume keys opt-in               |
| Downloads      | Per-chapter, queue      | Arc Reader range + progress     | Ranges, queue, pause/resume, Wi-Fi-only       |
| Sync           | Vendor cloud            | Legado WebDAV                   | Local export + WebDAV (later)                 |
| Onboarding     | Empty state or scan     | ReadEra auto-scan               | Scan local files + add repo                   |

**Six conclusions that drive §6:**

1. **Five tabs is the ceiling, and one of them should be More.** In this survey, the apps that stayed at four or five pushed configuration and history out of the tab bar (Shosetsu, LNReader).
2. **The library must show progress without opening the book.** A cover, a title, a hairline progress bar and an unread count are the minimum.
3. **The chapter list is a data-grid problem.** Search, sort, jump-to-number, range selection and virtualisation are not optional at 1,000+ rows.
4. **Reader settings belong in a sheet with a live preview.** Never navigate away from the text to change the text.
5. **Input customisation should be small and legible.** One documented tap map + volume-key opt-in beats a 24 × 15 matrix.
6. **Offline is a first-class state, not an error state.** Every screen needs a designed offline variant; the reader should be the _best_ place to be offline.

---

## 4. Commercial benchmarks — Wattpad, Webnovel, Royal Road

The commercial apps are not design role models in the whole; they are role models **per surface**. Their business model shapes their UX: every screen is a funnel toward retention or payment. We should take the craft and refuse the funnel.

### 4.1 Wattpad — the social reading loop

**Shell.** Five tabs: **Home / Search / Library / Write / Updates** `[S20]`. The tab bar mixes reading and authoring; "Write" is a permanent invitation to produce, not just consume.

**What works**

- **"Continue Reading" is pinned to the top of Home** `[S20]`; user reports disagree on whether it can be dismissed (see §8). It is the most direct expression of the product's core loop. The lesson is not "copy the un-dismissability"; it is that _resume_ deserves more prominence than any promotional module.
- **Inline paragraph comments.** Wattpad's signature interaction is commenting on a specific paragraph, which turns reading into a social act. It is also a moderation and performance cost. We should not ship it in v1, but the pattern argues for **anchored highlights/notes** rather than a global chapter comment thread.
- **Reading settings are separate from dark mode** `[S20]`. Wattpad exposes theme and typography inside the reader, distinct from the app's global appearance. This is correct: a user may want a light app and a sepia reader.

**What fails**

- **The library/update loop is slow.** Users report new chapters taking **5–10 minutes** to appear after publication `[S20]`. In an offline-first reader, the equivalent failure is a stale Updates tab with no "last checked" timestamp. Show the timestamp; make refresh explicit.
- **Un-dismissable modules crowd the reading loop.** A pinned row is useful once; after that it is furniture. Our continue card should disappear when there is nothing to resume, and collapse to a compact row once the user has scrolled.
- **Monetisation interrupts.** Ads and coin-gated chapters break immersion at exactly the moment the reader is most engaged. Wattpad documents offline downloads and a coin balance for Paid Stories; the reading loop is otherwise ad-supported `[S23]`. This is the anti-pattern our FLOSS positioning exists to reject.

### 4.2 Webnovel — the monetisation funnel

**Shell.** Bottom navigation plus a dense Home of rankings, genres and "hot" lists; the reader is reachable from every card but is not the centre of the IA.

**What works**

- **Chapter-end recommendation.** At the end of a chapter, Webnovel offers the next chapter and a related title. The _placement_ is right: the end of a chapter is the highest-intent moment in the product. We should use it for "Next chapter" and, secondarily, "More from this source".
- **Update schedules on the story page.** Serial readers plan around release days; showing "Updates Mon/Fri" is useful metadata that most readers omit.
- **Ranking surfaces.** "Top this week" is a cheap discovery primitive that does not require a recommendation model.

**What fails**

- **Chapter locking.** Chapters are locked behind coins and **fast-pass** timers; the price per chapter varies by title and is often not legible until the unlock sheet `[S24]`. The reader cannot answer "how much will this book cost me?" before investing. Webnovel's own help pages explain coins and fast-passes separately, which is itself evidence that the model needs a tutorial `[S25]`.
- **Privilege tiers.** A subscription tier grants early access and discounts, layering a second currency and a second status system on top of coins `[S24]`.
- **Cost opacity.** Variable pricing plus multiple currencies plus time-limited unlocks produces a screen where the user must do arithmetic to read the next chapter. This is a dark pattern, whether or not it is intentional.
- **Ad interruptions in the reading flow.** Reviews repeatedly cite ads between chapters `[S24]`.

**The transferable warning:** every additional currency, timer and tier makes the _next chapter_ harder to reach. Our advantage is a one-tap next chapter, forever.

### 4.3 Royal Road — the reader-first app

**Shell.** The Royal Road app launched with a reading-first brief: dictionary lookup, **free push notifications**, premium offline downloads, and TTS with **auto-next** and a **sleep timer** `[S26]`.

**What works**

- **Dictionary on long-press.** A built-in lookup is a genuine reading aid and costs one sheet, not a browser hand-off. This is a strong candidate for v1.1.
- **Push is free; offline is premium** `[S26]`. Whatever one thinks of the split, it is clearly communicated. Our equivalent is simpler: everything is free, and the only cost is storage.
- **TTS with auto-next + sleep timer** `[S26]`. These two controls turn TTS from a novelty into a bedtime mode. They are mandatory, not nice-to-have.
- **Chapter-end flow.** Royal Road's web reader has a compact "next chapter" affordance and a chapter-progress indicator; the app inherits that rhythm `[S26]`.

**What fails**

- **Premium offline in an app whose brand is "read anywhere".** Users perceive it as a bait-and-switch. Offline must be free in our product; it is the reason the app exists.
- **OLED black only inside the reader.** Reviewers note that the app's dark mode is not true black while the reader is `[S27]`. Theme inconsistency between chrome and content is jarring on OLED. Our AMOLED theme must be global, not reader-only.
- **Nav-bar layout bugs.** Play reviews call out the library tab being off-centre `[S27]`. With a 5-item bar, equal-width slots and label-safe sizing are table stakes; this is a real QA item, not a nitpick.

### 4.4 Monetisation mechanics and their UX cost

| Mechanic             | Where seen        | UX cost                                                    | Our alternative                           |
| -------------------- | ----------------- | ---------------------------------------------------------- | ----------------------------------------- |
| Coins per chapter    | Webnovel          | Price arithmetic before every chapter; fear of running out | No currency; chapters are free            |
| Fast-pass timer      | Webnovel          | Artificial waiting; breaks binge reading                   | No timers                                 |
| Privilege tiers      | Webnovel          | Second status system; confusing discounts                  | No tiers                                  |
| Ads between chapters | Wattpad, Webnovel | Immersion break at peak intent                             | No ads, ever                              |
| Premium offline      | Royal Road        | Paywall on the core promise                                | Offline free                              |
| Paid early access    | Multiple          | Spoiler asymmetry; pressure to pay                         | Not applicable                            |
| Algorithmic feed     | Wattpad           | Discovery becomes slot machine                             | Source browsing + search, user-controlled |

### 4.5 Trust as a design material

A FLOSS, 18+, no-monetisation reader competes on **trust**, and trust is visible in the interface:

1. **Say it on first run, once.** "No account. No ads. No tracking. Your library stays on your device." — one screen, one Continue button, never a modal again.
2. **Show where content comes from.** Every story row carries a small source label; the detail screen names the source and its language. Never imply that content is ours.
3. **Make export obvious.** Settings › Backup & restore, plus a visible "Export library" action in More. A user who can leave at any time trusts the product more, not less.
4. **No fake urgency.** No streaks, no "you're missing out", no red badges for anything except unread chapters the user actually has.
5. **No hidden network.** The only background work is update checks and downloads; both are listed in Settings with intervals and a "last run" timestamp.
6. **Keep the age gate and the disclaimer.** The app is 18+ and unofficial; both facts belong in About and in the first-run copy, not buried.

**Design consequence:** the commercial apps' best ideas are _reading-loop_ ideas (resume, chapter-end next, TTS sleep timer, dictionary). Their worst ideas are _business-model_ ideas (currency, timers, ads, tiers). §6 takes the former and explicitly excludes the latter.

---

## 5. Android-native feel (2025–2026)

Android-native is not a visual style; it is a set of contracts about system bars, back, permissions, text scaling and frame time. Get these wrong and the app feels foreign no matter how good the typography is.

### 5.1 Edge-to-edge is now mandatory

| Android version     | Contract                                                                                            | Consequence                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Android 15 (API 35) | Edge-to-edge enforced for apps targeting 35; the `windowOptOutEdgeToEdgeEnforcement` opt-out exists | Drawing under system bars is the default                      |
| Android 16 (API 36) | The opt-out is **ignored** for apps targeting 36 `[S29][S39]`                                       | Insets are not optional; there is no full-screen escape hatch |
| Expo SDK 54+        | Targets API 36 `[S37]`                                                                              | The app is already in the mandatory-edge-to-edge regime       |

**What this means in practice**

- Every screen must consume insets. Use `useSafeAreaInsets()` from `react-native-safe-area-context`; never hard-code status-bar height or a bottom tab height.
- The current `BottomTabInset = 80` constant `[repo]` is a smell. It should be derived from `insets.bottom + tabBarHeight`, because gesture navigation, 3-button navigation and display cutouts produce different values.
- The tab bar background must extend under the navigation bar, with its content padded above it. A tab bar that stops short of the screen edge looks broken on gesture-nav devices.
- The reader should go further: hide the system bars for immersive reading, and restore them on exit. Use `expo-navigation-bar` with overlay-swipe behaviour so a swipe from the edge still reveals them.
- Modal sheets need bottom insets too. A sheet whose last row sits under the gesture bar is the most common edge-to-edge bug in RN apps.
- The keyboard is an inset. Set `android.softwareKeyboardLayoutMode: "resize"` and test the search field and the chapter jump sheet with the keyboard open.

**Do not** use `SafeAreaView` from `react-native` (it is iOS-only in practice); use the `safe-area-context` primitives.

### 5.2 Back behaviour — define it before you need it

Android 16 enables **predictive back system animations by default for apps targeting API 36**, while still offering a manifest opt-out `[S38][S39]`. But the React Native stack is not ready:

- React Navigation's documentation still states that predictive back is **not supported** and instructs apps to set `android:enableOnBackInvokedCallback="false"` `[S43]`.
- Expo SDK 57 writes that opt-out through `android.predictiveBackGestureEnabled: false`, which remains the default `[S37][S40]`.

**Recommendation: keep predictive back off for 1.0.** A half-working predictive animation (preview shows the wrong screen, or the app exits while the preview shows a sheet) is worse than a clean, instant back. Revisit when React Navigation ships `OnBackInvokedCallback` support.

Because the system will not preview our back stack, the in-app semantics must be impeccable:

| Context                                  | Back action                                                       |
| ---------------------------------------- | ----------------------------------------------------------------- |
| Reader, chrome visible                   | Close chrome, stay in chapter                                     |
| Reader, chrome hidden, at top of chapter | Return to chapter list, preserving scroll                         |
| Reader, mid-chapter                      | Return to chapter list (do not rewind scroll)                     |
| Chapter list, selection active           | Exit selection mode                                               |
| Any screen with an open bottom sheet     | Close the sheet                                                   |
| Story detail                             | Return to the tab that opened it                                  |
| Root tab                                 | Exit the app (standard Android behaviour)                         |
| Download in progress                     | **Do not** block exit; downloads continue via the background task |

The reader is the only screen that needs a custom `BackHandler`. Register it only while the reader is focused, and remove it on blur; a leaked handler that swallows back is a classic RN bug.

### 5.3 Navigation structure and adaptive layouts

Material 3 guidance: a **navigation bar** holds **3–5 destinations**; a **navigation rail** holds **3–7** and is the recommended pattern for medium and expanded windows `[S34]`. Our five tabs sit exactly at the bar's ceiling.

Android 16 also **ignores orientation and resizability restrictions on displays ≥600dp** `[S39]`. A phone-only layout that locks to portrait will be letterboxed or stretched on a tablet, a foldable or a desktop-windowed device. The app is Android-only, but "Android" now includes large screens.

**Layout tiers**

| Width       | Navigation                             | Content                                           |
| ----------- | -------------------------------------- | ------------------------------------------------- |
| `< 600dp`   | Bottom bar, 5 items                    | 3-column library, full-width reader               |
| `600–839dp` | Navigation rail                        | 4–5-column library, reader max-width 68ch         |
| `≥ 840dp`   | Navigation rail + optional list-detail | Two-pane: library + detail, chapter list + reader |

Use `useWindowDimensions()` rather than `Dimensions.get()` so rotation and folding re-render correctly. For the reader, cap measure at **68 characters** and centre it; do not let text run the full width of a tablet.

**Deep links and route names.** The existing routes encode both `sourceId` and `id` (`story/[sourceId]/[id]`, `reader/[sourceId]/[id]`) `[repo]`. Keep the composite key for correctness, but never show it to the user. Route params should be opaque; the UI speaks in titles and chapter numbers.

### 5.4 Notifications, background work and downloads

- **Notification permission (Android 13+).** `POST_NOTIFICATIONS` is a runtime permission; request it **in context**, when the user enables "Notify me about new chapters" or starts a large download — never on first launch `[S31]`.
- **Channels.** Create separate channels: `new-chapters` (default importance), `downloads` (low, silent progress), `tts` (low, ongoing playback). Users can mute one without killing the others; Android settings expose these channels automatically.
- **Android 15 `dataSync` cap.** Foreground services of type `dataSync` are limited to **6 hours per 24-hour period** `[S28]`. A 5,000-chapter download cannot assume an unbounded foreground service. Use a resumable queue (WorkManager / `expo-background-task`) and persist progress so a killed worker resumes rather than restarts.
- **Android 16 progress-centric notifications.** For long downloads, use a live-update notification with a progress bar and a cancel action `[S31]`. This is also the correct place to surface "downloading 312 / 1,203"; do not make the user keep the app open.
- **Update checks.** Use `expo-background-task` (WorkManager under the hood), minimum interval 15 minutes; default to 6 hours. Show "Last checked" in Updates and More. Never wake the network on every app foreground.
- **Battery.** Set `android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` only if the user explicitly opts into "download in background"; otherwise respect Doze and let WorkManager schedule.
- **Wi-Fi-only.** Read connectivity via `expo-network`; treat "unmetered" separately from "Wi-Fi" (VPNs, hotspots). If a download is queued on cellular, show a "Waiting for Wi-Fi" state, not a spinner.

### 5.5 Per-app language, dynamic colour, system integration

**Per-app language.** Android 13+ supports per-app languages through a `localeConfig` `[S42]`. Expo's `expo-localization` config plugin generates it from `supportedLocales` `[S32]`. Requirements:

- Ship at least English; add languages as translation files, not hard-coded strings (the repo already enforces `t()` via `src/i18n`).
- Declare the locales in `app.json` so Android Settings › Apps › [App] › Language shows the app.
- Test **RTL** (Arabic, Hebrew) even if not shipping: `I18nManager.forceRTL` and logical properties (`marginStart`, not `marginLeft`). A 0-radius, border-based layout survives RTL better than a shadow-based one.
- Format dates and numbers with `Intl`, not string concatenation. Hermes supports `Intl` on Android.

**Dynamic colour (Material You).** Android 12+ exposes a system palette derived from the wallpaper. Expo's `@expo/ui` exposes Material 3 colour roles on Android `[S33]`. Offer it as an **appearance option** ("Use wallpaper colours"), never as the only theme:

- Dynamic colour can produce low-contrast primaries; clamp or fall back to the brand palette if contrast against the surface fails 4.5:1.
- The reader should **not** follow dynamic colour. Reading themes are content surfaces, not chrome; a wallpaper-derived sepia is a bug.
- Keep the four reader themes fixed; let dynamic colour tint the app chrome only.

**Other system contracts**

- **System dark mode.** Offer `System / Light / Dark / Black` in Appearance. `useColorScheme()` for the system option; the manual choice must win.
- **Font scale.** Android 14+ applies **non-linear font scaling up to 200 %** `[S30]`. Do not disable it (`allowFontScaling={false}`) except for icons or the reader's numeric badge. Test every screen at 200 %.
- **Display cutouts.** Use `WindowInsets`/safe-area top; do not assume a rectangular status bar. The reader's top chrome must sit below the cutout.
- **Haptics.** Use `expo-haptics` for selection and chapter-boundary feedback; provide a Settings toggle. Never haptic on every page turn.
- **Share sheet.** Story and chapter share actions should use the Android sharesheet with a canonical URL, not a custom modal.

### 5.6 Accessibility

Android's accessibility contract is stricter than most RN apps assume `[S41]`.

| Requirement          | Implementation                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Touch targets ≥ 48dp | Material guidance; WCAG 2.5.5 asks 44px `[S35]`. Raise `MinTouchTarget` from 44 to **48**, and allow 44 only in dense icon clusters with ≥8dp separation |
| Screen-reader labels | `accessibilityLabel` on every icon-only button; `accessibilityRole="button"`; `accessibilityState={{ selected }}` on tabs and chips                      |
| Reading order        | Group cover + title + progress into one accessible node in library rows; do not make the user swipe through five decorative views                        |
| Contrast             | 4.5:1 for body text, 3:1 for large text and UI boundaries. Current palettes **fail** in three places (see §6.6)                                          |
| Font scaling         | 200 % without clipping; no fixed-height rows; `maxFontSizeMultiplier` only on decorative eyebrows                                                        |
| Reduced motion       | `AccessibilityInfo.isReduceMotionEnabled()`; disable page-turn animations and chrome fades when true                                                     |
| Colour independence  | Unread state must not rely on the blue dot alone; pair it with a count or a bold title                                                                   |
| Focus                | Visible focus ring for keyboard/switch access; 2dp `primary` outline offset 2dp                                                                          |
| Captions for audio   | TTS is generated from text, so the text is the transcript; still label the player controls and expose chapter position                                   |

**Reader-specific:** provide **OpenDyslexic** and **Atkinson Hyperlegible** as font choices; both are OFL and already partially wired (`readerFontFamilies` includes OpenDyslexic) `[repo]`. Do not ship a reader that only offers a serif.

### 5.7 Performance and jank budget

At 60 Hz a frame is **16.67 ms**; at 120 Hz it is **8.3 ms** `[S36]`. The reader is a text surface, so it should be the cheapest screen in the app — but a naive `FlatList` of paragraphs with dynamic height will jank on a 2,000-paragraph chapter.

**Rules**

1. **Paginate or virtualise, never render the whole chapter.** The existing reader paginates into `ReaderItem` pages `[repo]`; keep that. If scroll mode is added, use `FlashList`/`FlatList` with `getItemLayout` only if paragraph heights are estimated; otherwise use a paged `ScrollView` with `removeClippedSubviews`.
2. **No JS-thread animations.** Chrome fades, sheet springs and page transitions run on the UI thread via `react-native-reanimated`; never `Animated` with `useNativeDriver: false`.
3. **Images.** Use `expo-image` with `cachePolicy="memory-disk"`, explicit width/height, and a low-quality placeholder. Covers are the main memory risk in a 500-book grid.
4. **Lists.** `initialNumToRender={12}`, `maxToRenderPerBatch={12}`, `windowSize={7}`, `updateCellsBatchingPeriod={50}` for the library. For the chapter list, fixed row height + `getItemLayout` is the single biggest win.
5. **Avoid layout thrash.** Do not measure text on every render; compute chapter pagination once per settings change and cache it.
6. **Startup.** Keep the JS bundle small; lazy-load the reader, TTS and extension host. The age gate and library should paint before the extension WebView mounts.
7. **Background work.** Never run update checks or downloads on the JS thread while the reader is open; schedule them through WorkManager.
8. **Instrument.** Use `react-native-performance` / Flipper/Perfetto on a mid-range device (not a flagship). Target: **< 1 % dropped frames** while scrolling the library and **< 16 ms** input-to-chrome-toggle.

### 5.8 Expo/RN gotchas checklist

- [ ] `android.edgeToEdgeEnabled` is moot on SDK 54+; still verify every screen with gesture **and** 3-button navigation.
- [ ] `predictiveBackGestureEnabled: false` is the SDK 57 default; do not flip it on without testing `OnBackInvokedCallback`.
- [ ] `expo-navigation-bar` `setVisibilityAsync('hidden')` in the reader; restore in a cleanup function, or the bars stay hidden after a crash.
- [ ] `StatusBar` style must follow the **reader** theme, not the app theme, while reading.
- [ ] Bottom sheets: `KeyboardAvoidingView` + `insets.bottom`; test with a hardware keyboard.
- [ ] `FlatList` inside `ScrollView` is still a bug; use `ListHeaderComponent`.
- [ ] `Pressable` `android_ripple` is rectangular by default; with 0 radius that is fine, but set `borderless={false}` and a ripple colour with 12 % alpha.
- [ ] `elevation` on Android draws a shadow **and** changes z-order; with a 0-radius system, use `borderWidth: StyleSheet.hairlineWidth` instead.
- [ ] `fontFamily: 'serif'` resolves differently per OEM; bundle the reader fonts rather than relying on system serif.
- [ ] `expo-localization` `getLocales()` can return an empty array on first boot; guard it.
- [ ] Back handler must be removed on blur, or it will steal back from the tab screen.

---

## 6. Deliverable — UX specification

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

## 7. Sources

> All URLs accessed October 2026. Where a claim came from a store listing, the listing is cited rather than the app's marketing copy. "unknown" in the body means I could not verify the claim from a primary source.

**[S1]** ArcReader official site — `https://arcreaders.app/` (features, import, TTS, highlights, widget, sync, languages; site search results used for the ARC-name disambiguation in §1.1).

**[S2]** ArcReader on Google Play — `https://play.google.com/store/apps/details?id=com.notasimplestudio.arcreaders` (description, screenshots, reviews, changelog, install count, rating).

**[S3]** ArcReader blog — importing and chapter-range download flow — `https://arcreaders.app/blog/best-royal-road-reader-app/` (URL/share import; title, author, cover and chapter list; All / Latest 50 / custom range).

**[S4]** ArcReader blog — offline downloads, storage sizing and "start now" — `https://arcreaders.app/blog/how-to-read-web-novels-offline/` (background downloads after closing the app; Wi-Fi-only; 30–80 KB/chapter, 30–50 MB/700 chapters; start-now prompt at 10 %).

**[S5]** ArcReader support — `https://arcreaders.app/support` (Settings structure, feedback diagnostics, subscription restore).

**[S6]** ArcReader Play Store screenshot set — `https://play.google.com/store/apps/details?id=com.notasimplestudio.arcreaders` (Library, reader, display sheet, downloads, TTS player; captured as `arc-a.png`/`arc-b.png` in this folder).

**[S7]** LNReader GitHub repository and README — `https://github.com/LNReader/lnreader` (MIT licence, screenshots, feature list, Android support).

**[S8]** LNReader source (v2.1.x) — `https://github.com/LNReader/lnreader/tree/master/src` (BottomNavigator, LibraryScreen, UpdatesScreen, HistoryScreen, reader components, settings tabs; local copies in `lnr/`).

**[S9]** LNReader releases — `https://github.com/LNReader/lnreader/releases` (v2.1.3/v2.1.4 notes: 1000-row backup fix, continue-reading buttons, task cancel, novel-screen lag).

**[S10]** LNReader issues — `https://github.com/LNReader/lnreader/issues` (library wiped, missing novels, 1000-chapter limit, lag, toolbar rearrangement, update-tab bugs, drawer border).

**[S11]** LNReader plugins repository — `https://github.com/lnreader/lnreader-plugins` (external source plugins; source breakage is expected).

**[S12]** Shosetsu — `https://shosetsu.app/` (official site, download channels, feature summary).

**[S13]** Shosetsu GitLab repository — `https://gitlab.com/shosetsuorg/shosetsu` (source; `BottomNavigationBar.kt` and `Destination.kt` define the four primary tabs and put History/Settings under More).

**[S14]** Shosetsu on F-Droid — `https://f-droid.org/packages/app.shosetsu.android.fdroid/` (GPL-3.0-only, Android 5.1+, fully customisable reader, Material You, extension repositories).

**[S15]** Legado — `https://github.com/gedoor/legado` (current upstream legal notice) and archived pre-2026 README/documentation (source-rule engine, list/grid shelf, page modes, TTS, replacement rules, WebDAV, local TXT/EPUB). The upstream code was removed in 2026; the feature description is historical.

**[S16]** Moon+ Reader on Google Play — `https://play.google.com/store/apps/details?id=com.flyersoft.moonreader` (themes, 24 operations × 15 events, 5 auto-scroll modes, left-edge brightness, 5 page-flip animations, shelf tabs).

**[S17]** Moon+ Reader official site — `https://www.moondownload.com/` (feature list and supported formats).

**[S18]** ReadEra on Google Play — `https://play.google.com/store/apps/details?id=org.readera` and `https://readera.org/` (auto-detect library, Favorites/To Read/Have Read, collections, 500k-book test, day/night/sepia/twilight/console themes, quotes, kids mode).

**[S19]** ReadEra official site — `https://readera.org/` (feature descriptions and format support).

**[S20]** Wattpad — Google Play listing and Help Center — `https://play.google.com/store/apps/details?id=wp.wattpad` and `https://support.wattpad.com/` (Home "Continue Reading" row, tab set, refresh lag, reader settings separated from dark mode).

**[S21]** Librera on Google Play — `https://play.google.com/store/apps/details?id=com.foobnix.pdf.reader` (vertical scroll, Musician's mode, configurable tap zones, RSVP, custom CSS, day/night themes, configurable volume keys).

**[S22]** Librera official site — `https://librera.mobi/` (mode descriptions and feature list).

**[S23]** Wattpad Help Center — `https://support.wattpad.com/` (offline downloads and the coin balance used by Paid Stories; ad-supported free tier).

**[S24]** Webnovel on Google Play and Webnovel — `https://play.google.com/store/apps/details?id=com.qidian.Int.reader` and `https://www.webnovel.com/` (coins, fast-pass, privilege tiers, variable chapter pricing, rankings, ads).

**[S25]** Webnovel help/pricing — `https://www.webnovel.com/` (coin and fast-pass explanations; cost opacity).

**[S26]** Royal Road app announcement and knowledge base — `https://www.royalroad.com/blog/60/the-day-has-finally-arrived-weve-launched-the` and `https://www.royalroad.com/support/knowledgebase/109` (dictionary, free push, premium offline, TTS auto-next and sleep timer).

**[S27]** Royal Road on Google Play — `https://play.google.com/store/apps/details?id=com.NotYetMedia.RoyalRoad` (reviews: off-centre library tab, OLED dark only in reader).

**[S28]** Android 15 behavior changes — `https://developer.android.com/about/versions/15/behavior-changes-15` (foreground-service `dataSync` 6-hour cap; edge-to-edge enforcement).

**[S29]** Android edge-to-edge guidance — `https://developer.android.com/develop/ui/views/layout/edge-to-edge` (mandatory edge-to-edge, insets, opt-out removal).

**[S30]** Android 14 behavior changes — `https://developer.android.com/about/versions/14/behavior-changes-14` (non-linear font scaling to 200 %).

**[S31]** Android notifications — `https://developer.android.com/develop/ui/views/notifications` and `https://developer.android.com/about/versions/16/behavior-changes-16` (channels, POST_NOTIFICATIONS, progress-centric notifications).

**[S32]** Expo Localization — `https://docs.expo.dev/versions/v57.0.0/sdk/localization/` (per-app language `supportedLocales`, locale config, RTL).

**[S33]** Expo UI — Material Colors — `https://docs.expo.dev/versions/v57.0.0/sdk/ui/jetpack-compose/colors.md` (Material 3 colour roles and wallpaper-derived dynamic colour on Android 12+).

**[S34]** Material 3 navigation bar — `https://m3.material.io/components/navigation-bar/guidelines` (3–5 destinations; rail 3–7 for larger windows).

**[S35]** Material 3 accessibility — `https://m3.material.io/foundations/accessible-design/overview` (48dp touch targets, contrast, scaling).

**[S36]** React Native performance — `https://reactnative.dev/docs/performance` (frame budget, list virtualisation, JS thread, animations).

**[S37]** Expo SDK 54 changelog — `https://expo.dev/changelog/sdk-54` (API 36 target, edge-to-edge always enabled, predictive-back default off).

**[S38]** Android 16 predictive back — `https://developer.android.com/about/versions/16/behavior-changes-16#predictive-back` (enabled by default for target 36; opt-out attribute).

**[S39]** Android 16 behavior changes — `https://developer.android.com/about/versions/16/behavior-changes-16` (edge-to-edge opt-out ignored; orientation/resizability restrictions ignored at ≥600dp; predictive back).

**[S40]** Expo SDK 57 docs — `https://docs.expo.dev/versions/v57.0.0/` and `https://docs.expo.dev/versions/v57.0.0/config/app/` (`android.predictiveBackGestureEnabled` defaults to false, navigation bar, splash, fonts).

**[S41]** Android accessibility — `https://developer.android.com/guide/topics/ui/accessibility/apps` (labels, focus, touch targets, scaling, reduced motion).

**[S42]** Android per-app languages — `https://developer.android.com/guide/topics/resources/app-languages` (`localeConfig`, Android 13+).

**[S43]** React Navigation 8 — predictive back limitation — `https://reactnavigation.org/docs/8.x/getting-started/` ("React Navigation doesn't yet support Android's predictive back gesture"; set `android:enableOnBackInvokedCallback="false"`).

---

## 8. What remains unknown

These are the questions this report cannot answer from public text sources. They should be resolved with device testing or user research, not guessed:

- Arc Reader's exact tab set, story-detail layout, chapter-list layout, tap-zone map and download mechanism (no public screenshots or docs) `[S1]–[S6]`.
- Shosetsu's current reader control set and whether its CSS customisation is per-book or global (repository docs are sparse) `[S13]`.
- Legado's exact default page mode and whether per-book overrides cover typography as well as theme `[S15]`.
- Wattpad's current tab labels and whether the "Continue Reading" row can be dismissed in the latest build (reports conflict) `[S20]`.
- Webnovel's per-chapter price ranges by region; the model is documented, the numbers are not stable `[S24]`.
- Whether Android 16's predictive-back opt-out will remain in Android 17; plan for support, not for the opt-out.
- The performance ceiling of the existing extension WebView bridge on low-end devices; measure with 10+ installed sources before promising instant search.

**Recommendation:** treat this document as the design contract for v1, and schedule a one-week device-testing spike (mid-range Android, 3-button and gesture nav, 200 % font scale, 1,000-chapter story, 500-book library) before locking the reader implementation.
