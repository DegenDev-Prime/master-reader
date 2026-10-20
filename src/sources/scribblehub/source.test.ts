import { describe, expect, it } from 'vitest';

import { loadTextFixture } from '@/test-utils/fixtures';
import { SourceError } from '../transport';
import { ScribbleHubSource } from './index';

const listing = () => loadTextFixture('listing.html', 'scribblehub');
const series = () => loadTextFixture('series.html', 'scribblehub');
const chapters = () => loadTextFixture('chapters.html', 'scribblehub');
const chapter = () => loadTextFixture('chapter.html', 'scribblehub');
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
    expect(source.usesBrowser).toBe(true);
    expect(source.isLoggedIn()).toBe(false);
  });

  it('maps a listing', async () => {
    const { source } = createSource();
    const result = await source.getLatest();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].sourceId).toBe('scribblehub');
  });

  it('reads the series with its chapters', async () => {
    const { source } = createSource();
    const story = await source.getStory(SERIES_ID);
    expect(story?.title).toBe('Rebirth of the Nephilim');
    expect(story?.pages?.length).toBeGreaterThan(0);
  });

  it('fetches the chapter list through the page session', async () => {
    const { source, expressions } = createSource();
    const list = await source.getChapterList(SERIES_ID);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].index).toBe(0);
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
    expect(calls[0]).toContain('search=');
  });

  it('returns nothing for an empty search', async () => {
    const { source } = createSource();
    const result = await source.search({});
    expect(result.items).toHaveLength(0);
  });
});
