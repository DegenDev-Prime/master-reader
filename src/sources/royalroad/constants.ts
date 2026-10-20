export const ROYALROAD_SOURCE_ID = 'royalroad';
export const ROYALROAD_BASE_URL = 'https://www.royalroad.com';
export const ROYALROAD_WEB_URL = 'https://www.royalroad.com';
export const ROYALROAD_PAGE_SIZE = 20;

/**
 * Royal Road has no `/fictions/popular` route (its nav never listed one); the
 * all-time ranking the site ships is `/fictions/best-rated`, subtitled "The
 * most popular stories on Royal Road". Confirmed against Royal Road's own nav
 * and current crawl snapshots of www.royalroad.com/fictions/best-rated.
 */
export const ROYALROAD_PATHS = {
  popular: '/fictions/best-rated',
  latest: '/fictions/latest-updates',
  search: '/fictions/search',
} as const;
