import { describe, expect, it } from 'vitest';

import {
  allMatches,
  cleanText,
  extractElementById,
  firstMatch,
  getAttribute,
  mapWithConcurrency,
  stripTags,
} from './html-parse';

describe('firstMatch', () => {
  it('returns the first capture group', () => {
    expect(firstMatch('<a href="/x">', /href="([^"]+)"/)).toBe('/x');
  });

  it('returns null when absent', () => {
    expect(firstMatch('nothing', /href="([^"]+)"/)).toBeNull();
  });
});

describe('allMatches', () => {
  it('collects every match without leaking lastIndex', () => {
    const re = /id="(\d+)"/g;
    const first = allMatches('<i id="1"><i id="2">', re);
    const second = allMatches('<i id="1"><i id="2">', re);
    expect(first.map((m) => m[1])).toEqual(['1', '2']);
    expect(second.map((m) => m[1])).toEqual(['1', '2']);
  });
});

describe('getAttribute', () => {
  it('reads double, single and unquoted attributes', () => {
    expect(getAttribute('<img src="a.jpg">', 'src')).toBe('a.jpg');
    expect(getAttribute("<img src='b.jpg'>", 'src')).toBe('b.jpg');
    expect(getAttribute('<img src=c.jpg>', 'src')).toBe('c.jpg');
  });

  it('decodes entities', () => {
    expect(getAttribute('<a title="Tom &amp; Jerry">', 'title')).toBe('Tom & Jerry');
  });

  it('returns null when missing', () => {
    expect(getAttribute('<img>', 'src')).toBeNull();
  });
});

describe('extractElementById', () => {
  it('returns the inner HTML preserving nested elements', () => {
    const html =
      '<div id="content"><p>one</p><div class="x"><p>two</p></div></div><div>after</div>';
    expect(extractElementById(html, 'content')).toBe('<p>one</p><div class="x"><p>two</p></div>');
  });

  it('matches single-quoted ids', () => {
    expect(extractElementById("<div id='body'>hi</div>", 'body')).toBe('hi');
  });

  it('returns null when the id is absent', () => {
    expect(extractElementById('<div id="other">x</div>', 'content')).toBeNull();
  });
});

describe('cleanText and stripTags', () => {
  it('collapses whitespace and decodes entities', () => {
    expect(cleanText('  a\n  b &amp; c ')).toBe('a b & c');
  });

  it('strips markup', () => {
    expect(stripTags('<strong>Shadow</strong> Slave')).toBe('Shadow Slave');
  });
});

describe('mapWithConcurrency', () => {
  it('preserves order and respects the concurrency bound', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('handles an empty list', async () => {
    await expect(mapWithConcurrency([], 3, async () => 1)).resolves.toEqual([]);
  });
});
