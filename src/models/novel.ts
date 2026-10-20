export type NovelStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'licensed' | 'unknown';

export type Novel = {
  sourceId: string;
  id: string;
  title: string;
  authorId?: string | null;
  authorName?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  status?: NovelStatus | null;
  genres?: string[];
  stats?: Record<string, string | number> | null;
  chapterCount?: number | null;
  wordCount?: number | null;
  rating?: number | null;
  lang?: string | null;
  url?: string | null;
  /** unix seconds */
  fetchedAt?: number | null;
  /** Provider last-update time, unix seconds. */
  updatedAt?: number | null;
  /** unix seconds */
  chaptersSyncedAt?: number | null;
};

export type Chapter = {
  sourceId: string;
  novelId: string;
  id: string;
  position: number;
  title: string;
  number?: number | null;
  volume?: string | null;
  volumeIndex?: number | null;
  /** unix seconds */
  releasedAt?: number | null;
  wordCount?: number | null;
  hasContent: boolean;
  orphaned: boolean;
};

export type ChapterBody = {
  chapterId: string;
  html: string;
  wordCount?: number | null;
};

export type NovelProgress = {
  sourceId: string;
  novelId: string;
  chapterId: string;
  /** Display order fallback for legacy rows that predate chapter ids. */
  chapterIndex: number;
  paragraphIndex?: number | null;
  charOffset?: number | null;
  scrollPct: number;
  /** unix seconds */
  updatedAt: number;
};

export type ChapterReadState = {
  chapterId: string;
  read: boolean;
};

export type ChapterListFilter = 'all' | 'unread' | 'downloaded';
export type ChapterListSort = 'asc' | 'desc';
