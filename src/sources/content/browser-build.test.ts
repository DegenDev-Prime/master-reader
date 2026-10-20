import { describe, expect, it, vi } from 'vitest';

const SAMPLE = `
  <h2>Chapter One</h2>
  <p>Plain text with <strong>bold</strong>, <em>italic</em> and a <a href="/x">link</a>.</p>
  <blockquote>A quoted line</blockquote>
  <ul><li>First</li><li>Second</li></ul>
  <img src="https://example.com/a.png" alt="cover" />
  <hr />
  <pre><code>const a = 1;</code></pre>
`;

/**
 * Metro bundles the browser build of cheerio (see `metro.config.js`), because
 * the published ESM and CommonJS builds import `node:stream`. Vitest runs on
 * Node, so it gets the CommonJS build. Both have to produce the same blocks,
 * otherwise the reader renders differently in the app and in the tests.
 */
const BROWSER_BUILD = '../../../node_modules/cheerio/dist/browser/index.js';

async function parseWith(cheerio: typeof import('cheerio')): Promise<unknown[]> {
  vi.resetModules();
  vi.doMock('cheerio', () => cheerio);
  const module = await import('./parse');
  return module.parseChapterBlocks(SAMPLE);
}

describe('cheerio builds agree', () => {
  it('parses the same blocks with the browser build as with the Node build', async () => {
    const node = await import('cheerio');
    const browser = (await import(/* @vite-ignore */ BROWSER_BUILD)) as typeof import('cheerio');

    const withBrowser = await parseWith(browser);
    const withNode = await parseWith(node);

    vi.doUnmock('cheerio');
    vi.resetModules();

    expect(withBrowser).toEqual(withNode);
    expect(withBrowser.map((block) => (block as { kind: string }).kind)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'listItem',
      'listItem',
      'image',
      'divider',
      'pre',
    ]);
  });
});
