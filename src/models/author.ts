/** A provider author/profile page. Timestamps are unix seconds. */
export type Author = {
  sourceId: string;
  /** Provider id: numeric user/profile id, or a provider slug. */
  id: string;
  name: string;
  url?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  followers?: number | null;
  /** Number of works the provider reports, when it does. */
  worksCount?: number | null;
  wordCount?: number | null;
  /** unix seconds */
  fetchedAt?: number | null;
  raw?: unknown;
};
