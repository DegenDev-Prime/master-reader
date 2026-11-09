import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';
import { SourceError } from '../transport';
import { ScribbleHubSource } from './index';

const listing = () => loadTextFixture('listing.html', 'scribblehub');
const series = () => loadTextFixture('series.html', 'scribblehub');
const chapters = () => loadTextFixture('chapters.html', 'scribblehub');
const chapter = () => loadTextFixture('chapter.html', 'scribblehub');
const author = () => loadTextFixture('author.html', 'scribblehub');
const challenge = () => loadTextFixture('challenge.html', 'scribblehub');

const SERIES_ID = '664073';

function createSource(
  overrides: {
    html?: (url: string) => string;
    evaluate?: (url: string, expression: string) => Promise<string>;
  } = {},
) {
  const calls: string[] = [];
  const expressions: string[] = [];
  const source = new ScribbleHubSource({
    loadHtml: async (url) => {
      calls.push(url);
      if (overrides.html) return overrides.html(url);
      if (url.includes('/profile/')) return author();
      if (url.includes('/series/')) return series();
      if (url.includes('/read/')) return chapter();
      return listing();
    },
    evaluate: async (url, expression) => {
      calls.push(url);
      expressions.push(expression);
      return overrides.evaluate ? overrides.evaluate(url, expression) : chapters();
    },
  });
  return { source, calls, expressions };
}

describe('ScribbleHubSource', () => {
  it('advertises its capabilities and browser mode', () => {
    const { source } = createSource();
    expect(source.info.id).toBe('scribblehub');
    expect(source.info.capabilities).toContain('popular');
    expect(source.info.capabilities).toContain('authors');
    expect(source.usesBrowser).toBe(true);
    expect(source.isLoggedIn()).toBe(false);
  });

  it('maps a listing', async () => {
    const { source } = createSource();
    const result = await source.getLatest();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].sourceId).toBe('scribblehub');
  });

  it('reads the series metadata without fabricating chapter pages', async () => {
    const { source, expressions } = createSource();
    const story = await source.getStory(SERIES_ID);
    expect(story?.id).toBe(SERIES_ID);
    expect(story?.title).toBe('Rebirth of the Nephilim');
    expect(story?.pages).toBeUndefined();
    expect(expressions).toHaveLength(0);
  });

  it('resolves a slug id to the canonical numeric id', async () => {
    const { source } = createSource();
    const story = await source.getStory('664073-rebirth-of-the-nephilim');
    expect(story?.id).toBe(SERIES_ID);
  });

  it('reads an author page and their series', async () => {
    const { source, calls } = createSource();
    const result = await source.getAuthor('109960');
    expect(result.author.name).toBe('Agdistis');
    expect(result.author.followers).toBe(4321);
    expect(result.author.worksCount).toBe(3);
    expect(result.stories.items).toHaveLength(3);
    expect(result.stories.items[0].id).toBe('664073');
    expect(result.stories.items[0].authorId).toBe('109960');
    expect(result.stories.page).toBe(1);
    expect(result.stories.hasNext).toBe(true);
    expect(calls[0]).toContain('/profile/109960/?sp=1');
  });

  it('supports author series pagination and empty profiles', async () => {
    const { source, calls } = createSource();
    await source.getAuthor('109960', { page: 2 });
    expect(calls[0]).toContain('/profile/109960/?sp=2');

    const empty = createSource({ html: () => '<html><h1>Nobody</h1></html>' }).source;
    const result = await empty.getAuthor('123');
    expect(result.author.name).toBe('Nobody');
    expect(result.stories.items).toEqual([]);
    expect(result.stories.hasNext).toBe(false);
  });

  it('fetches the chapter list through the page session', async () => {
    const { source, expressions } = createSource();
    const list = await source.getChapterList(SERIES_ID);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].index).toBe(0);
    expect(list[0].url).toContain('/read/664073/chapter/');
    expect(list[0].publishedAt).toBeGreaterThan(0);
    expect(expressions[0]).toContain('wi_getreleases_pagination');
    expect(expressions[0]).toContain(SERIES_ID);
  });

  it('rejects an empty chapter list', async () => {
    const { source } = createSource({ evaluate: async () => '' });
    await expect(source.getChapterList(SERIES_ID)).rejects.toBeInstanceOf(SourceError);
  });

  it('reads chapter content', async () => {
    const { source } = createSource();
    const content = await source.getChapterContent(SERIES_ID, '2623040');
    expect(content).toContain('Sorcha asked');
  });

  it('reports a blocked provider', async () => {
    const { source } = createSource({ html: () => challenge() });
    await expect(source.getLatest()).rejects.toBeInstanceOf(SourceError);
  });

  it('searches by title', async () => {
    const { source, calls } = createSource();
    const result = await source.search({ query: 'nephilim' });
    expect(result.items.length).toBeGreaterThan(0);
    expect(calls[0]).toContain('sh=nephilim');
  });

  it('returns nothing for an empty search', async () => {
    const { source } = createSource();
    const result = await source.search({});
    expect(result.items).toHaveLength(0);
  });
});
