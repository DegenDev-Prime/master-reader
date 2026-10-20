# Data model v2 — chapters, downloads, updates, migration

Status: draft after architecture review · 2026-10-19

Companion to `SOURCES.md` (source contract and sync triggers) and `PLAN.md` (phases).

## 1. Principles

- **Identity is `(sourceId, novelId, chapterId)`.** Never a list index. Indexes are
  display order and may change.
- **Metadata and content are written by different methods.** A chapter-list sync must
  never touch `content`.
- **Content is never destroyed by a sync.** Absent chapters are marked orphaned, not
  deleted.
- **SQLite is the source of truth.** Migrations are generated from `src/db/schema.ts`;
  data backfills run in an app-level, idempotent transaction.
- **Legacy data keeps working.** Existing library entries, progress and downloads must
  resolve after the upgrade.

## 2. Schema changes

### 2.1 `stories` (table name kept; domain type becomes `Novel`)

Add columns:

| column               | type        | purpose                                             |
| -------------------- | ----------- | --------------------------------------------------- |
| `status`             | text        | ongoing/completed/hiatus/cancelled/licensed/unknown |
| `genres`             | text (json) | string[] from the provider                          |
| `stats`              | text (json) | provider extras (views, votes, …)                   |
| `chapter_count`      | integer     | last known provider count                           |
| `chapters_synced_at` | integer     | last successful chapter sync                        |
| `updated_at`         | integer     | provider last-update timestamp (unix seconds)       |

Keep `series_id/series_title/series_position` (unused after the Literotica adapter; drop
in a later release).

### 2.2 `chapters` (new; replaces `pages` for all reads/writes)

```sql
CREATE TABLE chapters (
  source_id     TEXT NOT NULL,
  novel_id      TEXT NOT NULL,
  id            TEXT NOT NULL,            -- provider-stable chapter id
  position      INTEGER NOT NULL,         -- display order, recomputed by sync
  number        REAL,
  title         TEXT,
  volume        TEXT,
  volume_index  INTEGER,
  released_at   INTEGER,                  -- unix seconds
  word_count    INTEGER,
  content       TEXT,                     -- sanitized HTML, NULL = not downloaded
  content_hash  TEXT,
  orphaned      INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (source_id, novel_id, id)
);
CREATE INDEX chapters_order_idx ON chapters (source_id, novel_id, orphaned, position);
```

- `pages` stays in the schema as a **deprecated read-only source for the one-time
  migrator**; no new code reads or writes it after migration. Drop it in a later release.
- Metadata queries select every column **except `content`**, plus
  `content IS NOT NULL AS hasContent`.
- Content writes go through `setChapterContent`; metadata writes never include content.

### 2.3 `reading_progress`

Add `chapter_id TEXT`, `paragraph_index INTEGER`, `char_offset INTEGER`. New writes
always set `chapter_id`; `page_index` stays as a fallback for unmigrated rows.
Backfill from `pages`: `chapter_id = chapter_id ?? 'p' || index`.

### 2.4 `history`

Add `chapter_id TEXT`, `paragraph_index INTEGER`; backfill by joining the legacy page
mapping on `(source_id, story_id, page_index)`.

### 2.5 `narration_state` / `narration_bookmarks`

Add `chapter_id TEXT`, `paragraph_index INTEGER`, `char_offset INTEGER`; backfill by
joining `pages` on the old page index. `chunk_index` remains for backward compatibility
but new writes key by chapter + paragraph.

### 2.6 `chapter_downloads` (new)

```sql
CREATE TABLE chapter_downloads (
  source_id   TEXT NOT NULL,
  novel_id    TEXT NOT NULL,
  chapter_id  TEXT NOT NULL,
  status      TEXT NOT NULL,         -- queued|downloading|paused|completed|failed
  error       TEXT,
  bytes       INTEGER,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (source_id, novel_id, chapter_id)
);
CREATE INDEX chapter_downloads_status_idx
  ON chapter_downloads (status, updated_at);
```

The existing `downloads` row remains the **per-novel aggregate** shown in the UI:
`status`, `total_pages` (renamed in UI to chapters), `downloaded_pages`, `size_bytes`,
`error`, timestamps. It is recomputed from `chapter_downloads` + `chapters.content`.

### 2.7 `story_updates` (new)

```sql
CREATE TABLE story_updates (
  id            TEXT PRIMARY KEY,     -- `${sourceId}:${novelId}:${chapterId}`
  source_id     TEXT NOT NULL,
  novel_id      TEXT NOT NULL,
  chapter_id    TEXT NOT NULL,
  chapter_title TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  seen_at       INTEGER
);
CREATE UNIQUE INDEX story_updates_unique_idx
  ON story_updates (source_id, novel_id, chapter_id);
CREATE INDEX story_updates_seen_idx ON story_updates (seen_at, created_at);
```

Rows are created by `syncChapters` only for novels present in `library_entries`.

### 2.8 `source_health` (new)

```sql
CREATE TABLE source_health (
  source_id       TEXT NOT NULL,
  operation       TEXT NOT NULL,     -- listing|search|novel|chapter-list|chapter-content
  last_ok_at      INTEGER,
  last_error_at   INTEGER,
  last_error_kind TEXT,
  fail_count      INTEGER NOT NULL DEFAULT 0,
  ewma_latency_ms REAL,
  parser_version  TEXT,
  PRIMARY KEY (source_id, operation)
);
```

`ewma_latency_ms = 0.8 * previous + 0.2 * sample`; `fail_count` resets on success.
"Having trouble" = 3 consecutive failures for `novel` or `chapter-list`; never disables
the source automatically.

### 2.9 `chapter_reads` (new)

Read state is device-local, never provider metadata: a chapter-list sync must not clear it.

```sql
CREATE TABLE chapter_reads (
  source_id  TEXT NOT NULL,
  novel_id   TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  read_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (source_id, novel_id, chapter_id)
);
CREATE INDEX chapter_reads_novel_idx ON chapter_reads (source_id, novel_id);
```

Unread counts are `chapters` rows minus `chapter_reads` rows. "Mark read up to here" inserts
every earlier chapter in one statement; undo deletes the inserted rows. Backfill from the
legacy `reading_progress.read_pages` JSON array (page indexes map to chapter ids) and from
`history` rows, preserving explicit read marks.

### 2.10 Removed

- `extensions` table and `src/extensions/**` (runtime plugin system).
- Old `sourceListCache` stays (listing cache) but uses the new cache policy.

## 3. Repository contracts

```ts
chapterRepository.upsertMetadata(list: ChapterMetadata[]): Promise<void>;
// INSERT ... ON CONFLICT (source_id, novel_id, id) DO UPDATE SET
//   position, number, title, volume, volume_index, released_at, word_count, orphaned, updated_at
// never references content.

chapterRepository.setContent(
  sourceId: string,
  novelId: string,
  chapterId: string,
  value: { html: string; wordCount?: number | null; contentHash?: string | null },
): Promise<void>;
// UPDATE only content, content_hash, word_count, updated_at. Throws if the chapter is missing.

chapterRepository.getContent(
  sourceId: string,
  novelId: string,
  chapterId: string,
): Promise<string | null>;

chapterRepository.listMetadata(
  sourceId: string,
  novelId: string,
  options?: { includeOrphaned?: boolean },
): Promise<ChapterMetadata[]>;
// SELECT excludes content; includes hasContent and lastRead info when joined.

chapterRepository.counts(sourceId, novelId): Promise<{
  total: number; downloaded: number; orphaned: number;
}>;

chapterRepository.removeContent(sourceId, novelId, chapterId): Promise<void>;
chapterRepository.markOrphaned(sourceId, novelId, ids: string[]): Promise<void>;
```

`downloadsRepository` gains per-chapter methods delegating to `chapter_downloads` and a
`recomputeAggregate(sourceId, novelId)` called after each chapter completes/fails.

## 4. Migration

### 4.1 Ordering

1. Drizzle migrations create the new tables/columns (generated; reviewed, never
   hand-edited). `pages` remains.
2. `DatabaseGate` runs `migrateLegacyData()` **after** migrations and before any screen
   query.
3. `migrateLegacyData()` is idempotent, guarded by a `settings` key
   (`schema.dataVersion = '2'`).

### 4.2 `migrateLegacyData()`

```ts
async function migrateLegacyData(): Promise<void> {
  if ((await getDataVersion()) >= 2) return;
  await copyDatabaseFileToBackup('pre-v2'); // best-effort, expo-file-system
  await db.transaction(async (tx) => {
    // 1. chapters ← pages (INSERT OR IGNORE)
    //    id = page.chapter_id ?? (novelfire ? String(index+1) : `p${index}`)
    //    position = page.index, number = null, orphaned = 0
    //    content copied verbatim (legacy plain text is allowed)
    // 2. chapter_reads ← reading_progress.read_pages and history page indexes
    //    (INSERT OR IGNORE; read_at = progress/history timestamp)
    // 3. reading_progress.chapter_id ← matching chapters.id
    // 3. history.chapter_id ← matching chapters.id by page_index
    // 4. narration_state/narration_bookmarks.chapter_id ← same mapping
    // 5. downloads: chapter_downloads ← rows for chapters with content
    //    (status 'completed'); aggregate recomputed
    // 6. set dataVersion = 2
  });
}
```

Mapping rules:

- NovelFire/RoyalRoad pages have `chapter_id`; migration uses it verbatim. The ports
  preserve those ids (SOURCES.md §4.1).
- Literotica/eager pages have no `chapter_id`; they get `p<index>`, and the Literotica
  adapter emits the same ids, so a later sync matches instead of duplicating.
- Never fuzzy-match content to a provider chapter by title. Unmatched legacy content
  stays as a normal (or orphaned) chapter and remains readable.

### 4.3 Migration tests

Vitest cannot load expo-sqlite. Add a Node harness:

- devDependency `better-sqlite3` (+ types) or `sql.js`.
- `src/db/__tests__/migrations.test.ts`:
  1. build a legacy schema fixture (SQL dump from the current build);
  2. apply the generated migration SQL in `src/db/migrations/*.sql` in order;
  3. run the pure mapping function (extracted from `migrateLegacyData`) against legacy
     rows;
  4. assert chapter ids, content preservation, progress/history/narration chapter ids,
     download completion, and idempotency (run twice).
- Assert `src/db/migrations/migrations.js` lists every journal entry.
- Add `npm run db:check` to `verify`.

## 5. Chapter sync writes

`services/chapters.ts` (contract in `SOURCES.md` §8) is the only writer of chapter
metadata:

1. Fetch all pages; build the ordered chapter list.
2. If the order equals stored order: `upsertMetadata` in one transaction.
3. Else: in one transaction, shift positions out of the way
   (`position = -position - 1`), then `upsertMetadata` for each chapter at its final
   position, then assign orphan positions after the provider list. Content columns are
   never part of these statements.
4. Insert `story_updates` rows for newly inserted chapters of library novels.
5. Update `stories.chapter_count`, `chapters_synced_at`, `status`, `updated_at`.
6. `recomputeAggregate` for downloads (new chapters may be auto-queued).

The per-novel mutex covers sync, download completion and reindex. Reads are consistent
because each step is a transaction and the reader resolves chapters by id.

## 6. Downloads

Requirements:

- Per-chapter state, resumable across restarts, pause/resume/cancel.
- Download all / next N / chapter only; "download ahead" while reading (setting, default
  2).
- Auto-download new chapters for completed downloads (setting).
- Wi-Fi-only option; pause when the connection is metered/off-Wi-Fi (expo-network).
- The aggregate row is updated live; the Downloads screen shows both aggregate and
  per-chapter failures.
- Pinned tier: any chapter with `chapter_downloads.status = 'completed'` is never
  evicted by cache sweeps, even if the aggregate row is missing.
- Failure keeps already-downloaded chapters and the current position; retry only failed
  ones.
- The queue respects per-source concurrency/interval from the transport policy.

## 7. Updates

- `story_updates` is written during sync for library novels. The Updates screen groups
  by novel, shows unseen counts and latest chapter, and offers Download / Mark read.
- Background check (existing expo-background-task): every N hours, for each library
  novel call `getNovelStatus` if the source implements it (cheap count/updatedAt); only
  run a full `syncChapters` when the count/updatedAt changed. Sources without a status
  method are fully synced at most once per 24 h.
- Local notification (expo-notifications) when new chapters appear and notifications are
  enabled; one summary notification, not one per chapter.
- Never auto-mark updates as seen; only user action or opening the novel from Updates.

## 8. Backup and EPUB

- `BACKUP_VERSION = 2`. Export includes novels, chapter metadata + content, library,
  progress (chapter id + paragraph), downloads state, settings, and narration state.
- Import of a v1 backup maps ids directly (they are preserved) and converts index-keyed
  pages to chapter ids with the same `p<index>` rule.
- Round-trip tests: export → wipe → import → library, progress, downloads and content
  identical.
- EPUB iterates chapters with content ordered by position, converts sanitized HTML to
  XHTML, embeds images, and falls back to plain-text paragraphs for legacy content.

## 9. Cache and size policy

- Listings: 5 min. Novel metadata: 1 h. Chapter content: immutable while present.
  Images: 7 days.
- Chapter metadata queries exclude content; the reader loads content lazily per chapter.
- Cache sweeps may evict content only when: not downloaded, not the current chapter, and
  older than 30 days (setting). Downloads are pinned.
- Target: 3,000-chapter novel opens its chapter list in <300 ms from cache; scrolling is
  virtualized (FlashList); memory stays flat.

## 10. Acceptance criteria

- [ ] Upgrade from the current build keeps library entries, progress, downloads and
      downloaded chapter text; a regression test proves it.
- [ ] Sync after download does not erase content (metadata upsert never writes content).
- [ ] Reading chapter N, syncing a reordered list, and reopening resumes chapter N.
- [ ] Two chapters cannot share an id within a novel (PK).
- [ ] Download all → kill app → reopen resumes the queue; completed chapters stay
      completed.
- [ ] New chapters for a library novel appear in Updates and trigger one notification.
- [ ] Backup round-trip preserves chapters + progress; EPUB opens with content and
      ordering intact.
- [ ] Migration test harness runs in Vitest; `db:check` is part of `verify`.
