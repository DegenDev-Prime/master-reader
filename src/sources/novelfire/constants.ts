export const NOVELFIRE_SOURCE_ID = 'novelfire';
export const NOVELFIRE_BASE_URL = 'https://novelfire.net';
export const NOVELFIRE_WEB_URL = 'https://novelfire.net';
export const NOVELFIRE_PAGE_SIZE = 24;

/**
 * Novel pages are long-running serials with thousands of chapters. The chapter
 * list is walked page-by-page (100 chapters per page) up to this bound; chapter
 * content is always fetched lazily, never in bulk.
 */
export const NOVELFIRE_MAX_CHAPTER_LIST_PAGES = 200;
