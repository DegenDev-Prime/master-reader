/**
 * Framework-agnostic domain models. Sources produce these; repositories persist
 * them; UI consumes them. Timestamps are unix seconds.
 */

export type StoryFlags = {
  isNew?: boolean | null;
  isHot?: boolean | null;
  isWritersPick?: boolean | null;
  isContestWinner?: boolean | null;
  commentsEnabled?: boolean | null;
  ratingEnabled?: boolean | null;
};

export type Story = {
  sourceId: string;
  id: string;
  title: string;
  authorId?: string | null;
  authorName?: string | null;
  description?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  lang?: string | null;
  url?: string | null;
  coverUrl?: string | null;
  rating?: number | null;
  votes?: number | null;
  views?: number | null;
  wordCount?: number | null;
  flags: StoryFlags;
  /** unix seconds */
  publishedAt?: number | null;
  /** unix seconds */
  fetchedAt?: number | null;
  tags?: string[];
  /** Series membership, when the story belongs to one. */
  seriesId?: string | null;
  seriesTitle?: string | null;
  seriesPosition?: number | null;
  raw?: unknown;
};

export type StoryPage = {
  sourceId: string;
  storyId: string;
  index: number;
  title?: string | null;
  content?: string | null;
  wordCount?: number | null;
};

export type StorySeriesItem = {
  id: string;
  title: string;
  url?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
};

export type StorySeries = {
  id: string;
  title: string;
  items: StorySeriesItem[];
};

export type LibraryEntry = {
  sourceId: string;
  storyId: string;
  /** unix seconds */
  addedAt: number;
  sortOrder?: number | null;
  lastReadAt?: number | null;
  isUnread: boolean;
};

export type ReadingProgress = {
  sourceId: string;
  storyId: string;
  pageIndex: number;
  pageCount?: number | null;
  scrollPct: number;
  readPages?: number[];
  /** unix seconds */
  updatedAt: number;
};

export type HistoryEntry = {
  id: string;
  sourceId: string;
  storyId: string;
  pageIndex: number;
  durationMs?: number | null;
  /** unix seconds */
  readAt: number;
};

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';

export type Download = {
  sourceId: string;
  storyId: string;
  status: DownloadStatus;
  totalPages?: number | null;
  downloadedPages: number;
  sizeBytes?: number | null;
  path?: string | null;
  error?: string | null;
  /** unix seconds */
  startedAt?: number | null;
  /** unix seconds */
  completedAt?: number | null;
};
