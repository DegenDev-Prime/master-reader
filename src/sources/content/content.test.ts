import { describe, expect, it } from 'vitest';

import { parseChapterBlocks } from './parse';
import { sanitizeChapterHtml } from './sanitize';

describe('sanitizeChapterHtml', () => {
  it('drops scripts, handlers and unsafe URLs, and absolutises links and images', () => {
    const html = sanitizeChapterHtml(
      '<p onclick="steal()">Hi<script>alert(1)</script><a href="/chapter/2">next</a>' +
        '<img src="/cover.jpg" onerror="steal()" alt="cover"></p>' +
        '<a href="javascript:alert(1)">bad</a>',
      'https://example.com/book/1/',
    );

    expect(html).not.toContain('script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://example.com/chapter/2"');
    expect(html).toContain('src="https://example.com/cover.jpg"');
  });
});

describe('parseChapterBlocks', () => {
  it('parses headings, paragraphs with inline emphasis, quotes, lists, rules and images', () => {
    const blocks = parseChapterBlocks(
      '<h2>The Gate</h2>' +
        '<p>Snow <strong>fell</strong> and <em>kept</em> <a href="https://x.test/a">falling</a>.</p>' +
        '<blockquote>You are late.</blockquote>' +
        '<ul><li>One</li><li>Two</li></ul>' +
        '<hr>' +
        '<img src="https://x.test/pic.jpg" alt="gate">',
    );

    expect(blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'listItem',
      'listItem',
      'divider',
      'image',
    ]);

    const paragraph = blocks[1];
    expect(paragraph.kind).toBe('paragraph');
    if (paragraph.kind === 'paragraph') {
      expect(paragraph.text).toBe('Snow fell and kept falling.');
      expect(paragraph.spans.some((span) => span.bold && span.text === 'fell')).toBe(true);
      expect(paragraph.spans.some((span) => span.italic && span.text === 'kept')).toBe(true);
      expect(paragraph.spans.some((span) => span.href === 'https://x.test/a')).toBe(true);
    }
  });

  it('splits plain-text legacy content on blank lines', () => {
    const blocks = parseChapterBlocks('First paragraph.\n\nSecond paragraph.\n\n\nThird.');
    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => (block.kind === 'paragraph' ? block.text : ''))).toEqual([
      'First paragraph.',
      'Second paragraph.',
      'Third.',
    ]);
  });

  it('keeps line breaks inside a paragraph as a newline span', () => {
    const blocks = parseChapterBlocks('<p>One<br>Two</p>');
    const paragraph = blocks[0];
    expect(paragraph.kind).toBe('paragraph');
    if (paragraph.kind === 'paragraph') expect(paragraph.text).toBe('One\nTwo');
  });

  it('ignores empty paragraphs and unwraps nested divs', () => {
    const blocks = parseChapterBlocks('<p> </p><div><p>Kept</p></div>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('paragraph');
  });
});

describe('parseChapterBlocks dividers', () => {
  it('turns a punctuation-only paragraph into a divider instead of text', () => {
    const blocks = parseChapterBlocks('<p>One.</p><p>***</p><p>◇◇◇</p><p>Two.</p>');
    expect(blocks.map((block) => block.kind)).toEqual([
      'paragraph',
      'divider',
      'divider',
      'paragraph',
    ]);
  });

  it('keeps a paragraph that merely starts with punctuation', () => {
    const blocks = parseChapterBlocks('<p>...and then she left.</p>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('paragraph');
  });
});
