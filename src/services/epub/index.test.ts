import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import type { Story, StoryPage } from '@/models/story';

import { buildEpub, buildEpubBytes } from './index';

const MIMETYPE = 'application/epub+zip';

const story: Story = {
  sourceId: 'royalroad',
  id: '42',
  title: 'Deep Sea Diver',
  authorName: 'A. Pilot',
  lang: 'en',
  description: 'A serial about the cold.',
  flags: {},
};

const page = (index: number, title: string | null, content: string | null): StoryPage => ({
  sourceId: 'royalroad',
  storyId: '42',
  index,
  title,
  content,
});

const decoder = new TextDecoder();

describe('buildEpub', () => {
  it('stores mimetype first and uncompressed per the OCF spec', () => {
    const bytes = buildEpubBytes(story, [
      page(0, 'Chapter One', '<p>Dive in.</p>'),
      page(1, 'Chapter Two', '<p>Dive deeper.</p>'),
    ]);

    // Zip local file header: signature (4 bytes) then name length (offset 26).
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const nameLength = bytes[26] | (bytes[27] << 8);
    const name = decoder.decode(bytes.slice(30, 30 + nameLength));
    expect(name).toBe('mimetype');

    // Compression method lives at header offset 8; 0 = STORED.
    const method = bytes[8] | (bytes[9] << 8);
    expect(method).toBe(0);

    const dataStart = 30 + nameLength + (bytes[28] | (bytes[29] << 8));
    expect(decoder.decode(bytes.slice(dataStart, dataStart + MIMETYPE.length))).toBe(MIMETYPE);
  });

  it('carries the container, package and navigation files', () => {
    const decoded = unzipSync(buildEpubBytes(story, [page(0, 'Chapter One', '<p>Dive in.</p>')]));
    expect(Object.keys(decoded)).toContain('META-INF/container.xml');
    expect(Object.keys(decoded)).toContain('OEBPS/content.opf');
    expect(Object.keys(decoded)).toContain('OEBPS/toc.ncx');
    expect(decoder.decode(decoded['META-INF/container.xml'])).toContain('OEBPS/content.opf');
  });

  it('writes one chapter per content-bearing page', () => {
    const decoded = unzipSync(
      buildEpubBytes(story, [
        page(0, 'Chapter One', '<p>Dive in.</p>'),
        page(1, 'Chapter Two', '<p>Dive deeper.</p>'),
        page(2, null, null),
      ]),
    );
    const chapters = Object.keys(decoded).filter((name) => /OEBPS\/chapters\//.test(name));
    expect(chapters).toHaveLength(2);
    expect(decoder.decode(decoded['OEBPS/content.opf'])).toContain(
      '<dc:title>Deep Sea Diver</dc:title>',
    );
    expect(decoder.decode(decoded[chapters[1]])).toContain('<h1>Chapter Two</h1>');
  });

  it('escapes XML-dangerous text', () => {
    const decoded = unzipSync(
      buildEpubBytes(story, [page(0, 'Fish & Chips <I>', '<p>"2<3" & so on</p>')]),
    );
    const chapterText = decoder.decode(
      decoded['OEBPS/chapters/chapter-1.xhtml'] ?? new Uint8Array(),
    );
    expect(chapterText).toContain('Fish &amp; Chips &lt;I&gt;');
    expect(chapterText).toContain('&quot;2&lt;3&quot; &amp; so on');
    expect(chapterText).not.toContain('<p>"2<3"');
  });

  it('keeps the async signature but stays synchronous underneath', async () => {
    const bytes = await buildEpub(story, [page(0, 'Chapter One', '<p>Dive in.</p>')]);
    expect(unzipSync(bytes)['META-INF/container.xml']).toBeTruthy();
  });
});
