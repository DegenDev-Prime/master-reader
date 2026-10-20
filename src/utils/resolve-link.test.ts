import { describe, expect, it } from 'vitest';

import { parseLink, resolveStoryLink } from './resolve-link';

describe('resolveStoryLink', () => {
  it('resolves Literotica story slugs from /s/ paths', () => {
    expect(resolveStoryLink('https://www.literotica.com/s/the-long-road')).toEqual({
      kind: 'story',
      sourceId: 'literotica',
      storyId: 'the-long-road',
    });
  });

  it('accepts Literotica links without a scheme or with queries', () => {
    expect(resolveStoryLink('literotica.com/s/second-story?ref=sidebar')).toEqual({
      kind: 'story',
      sourceId: 'literotica',
      storyId: 'second-story',
    });
  });

  it('still resolves the story from paginated story links', () => {
    // Literotica paginates long stories onto ?page=N of the same story URL.
    expect(resolveStoryLink('https://www.literotica.com/s/the-long-road?page=2')).toEqual({
      kind: 'story',
      sourceId: 'literotica',
      storyId: 'the-long-road',
    });
  });

  it('resolves NovelFire book slugs, stripping chapter tails', () => {
    expect(resolveStoryLink('https://novelfire.net/book/shadow-slave')).toEqual({
      kind: 'story',
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
    });
    expect(resolveStoryLink('https://novelfire.net/book/shadow-slave/chapter-1')).toEqual({
      kind: 'story',
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
    });
    expect(resolveStoryLink('https://novelfire.net/book/shadow-slave/')).toEqual({
      kind: 'story',
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
    });
  });

  it('resolves NovelFire links carrying page queries', () => {
    expect(resolveStoryLink('https://novelfire.net/book/shadow-slave?page=3')).toEqual({
      kind: 'story',
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
    });
    expect(resolveStoryLink('https://novelfire.net/book/shadow-slave/chapter-2?page=5')).toEqual({
      kind: 'story',
      sourceId: 'novelfire',
      storyId: 'shadow-slave',
    });
  });

  it('resolves RoyalRoad numeric fiction ids', () => {
    expect(resolveStoryLink('https://www.royalroad.com/fiction/21220/mother-of-learning')).toEqual({
      kind: 'story',
      sourceId: 'royalroad',
      storyId: '21220',
    });
    expect(resolveStoryLink('https://www.royalroad.com/fiction/21220')).toEqual({
      kind: 'story',
      sourceId: 'royalroad',
      storyId: '21220',
    });
    expect(
      resolveStoryLink('https://www.royalroad.com/fiction/21220/mother-of-learning/chapter/1'),
    ).toEqual({
      kind: 'story',
      sourceId: 'royalroad',
      storyId: '21220',
    });
  });

  it('rejects bare hostnames without a story path', () => {
    expect(resolveStoryLink('literotica.com')).toEqual({ kind: 'unsupported' });
    expect(resolveStoryLink('https://literotica.com/series/dragon-heist')).toEqual({
      kind: 'unsupported',
    });
  });

  it('reports unsupported for unknown hosts', () => {
    expect(resolveStoryLink('https://example.com/story/somewhere')).toEqual({
      kind: 'unsupported',
    });
  });

  it('reports invalid for non-URL input', () => {
    expect(resolveStoryLink('')).toEqual({ kind: 'invalid' });
    expect(resolveStoryLink('   ')).toEqual({ kind: 'invalid' });
    expect(resolveStoryLink('not a link')).toEqual({ kind: 'invalid' });
  });
});

describe('parseLink', () => {
  it('handles scheme-relative hosts', () => {
    expect(parseLink('//royalroad.com/fiction/21220')).toEqual({
      host: 'royalroad.com',
      path: '/fiction/21220',
    });
  });

  it('lowercases and strips www. from hosts', () => {
    expect(parseLink('WWW.NovelFire.NET/Book/Shadow-Slave')).toEqual({
      host: 'novelfire.net',
      path: '/Book/Shadow-Slave',
    });
  });

  it('cuts query and hash fragments', () => {
    expect(parseLink('https://novelfire.net/book/shadow-slave?px=2#top')).toEqual({
      host: 'novelfire.net',
      path: '/book/shadow-slave',
    });
  });

  it('returns host with an empty path for host-only input', () => {
    expect(parseLink('novelfire.net')).toEqual({ host: 'novelfire.net', path: '' });
  });
});
