import { describe, expect, it } from 'vitest';

import { decodeHtmlEntities, estimateWordCount, htmlToPlainText } from './html';

describe('decodeHtmlEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeHtmlEntities('a &amp; b &#39;c&#x27;')).toBe("a & b 'c'");
  });

  it('leaves unknown entities untouched', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
  });
});

describe('htmlToPlainText', () => {
  it('converts block tags into paragraph breaks', () => {
    expect(htmlToPlainText('<p>One</p><p>Two</p>')).toBe('One\n\nTwo');
  });

  it('converts <br> into newlines and decodes entities', () => {
    expect(htmlToPlainText('Line 1<br/>Line &amp; 2')).toBe('Line 1\nLine & 2');
  });

  it('renders list items as bullets', () => {
    expect(htmlToPlainText('<ul><li>Alpha</li><li>Beta</li></ul>')).toBe(
      '\u2022 Alpha\n\u2022 Beta',
    );
  });

  it('strips remaining tags and collapses blank lines', () => {
    expect(htmlToPlainText('<div><span>Hi</span></div><div></div><div>There</div>')).toBe(
      'Hi\n\nThere',
    );
  });

  it('handles empty input', () => {
    expect(htmlToPlainText('')).toBe('');
  });
});

describe('estimateWordCount', () => {
  it('counts whitespace-separated words', () => {
    expect(estimateWordCount('one two   three\nfour')).toBe(4);
    expect(estimateWordCount('   ')).toBe(0);
  });
});
