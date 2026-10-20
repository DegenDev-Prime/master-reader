import { zipSync, type Zippable } from 'fflate';

import type { Story, StoryPage } from '@/models/story';
import { htmlToPlainText } from '@/utils/html';

/**
 * EPUB builder — a zip assembly problem, nothing more. Produces an EPUB 2
 * OPF + NCX container (readable by every EPUB reader, including EPUB 3 ones).
 * No DRM, no gating, no shell: the caller (export screen) owns file writing
 * and sharing. Pure and Vitest-testable.
 */

const MIMETYPE = 'application/epub+zip';

type BookChapter = {
  id: string;
  filename: string;
  title: string;
  xhtml: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** One chapter per downloaded page; content-less pages fall back to text. */
function toChapters(story: Story, pages: StoryPage[]): BookChapter[] {
  const chapters: BookChapter[] = [];
  const ordered = [...pages].sort((a, b) => a.index - b.index);

  for (const page of ordered) {
    const text = htmlToPlainText(page.content ?? '');
    if (!text) continue;
    const title = page.title?.trim() || story.title;
    const id = `ch${chapters.length + 1}`;
    chapters.push({
      id,
      filename: `OEBPS/chapters/chapter-${chapters.length + 1}.xhtml`,
      title,
      xhtml: chapterXhtml(title, text),
    });
  }

  if (chapters.length === 0) {
    chapters.push({
      id: 'ch1',
      filename: 'OEBPS/chapters/chapter-1.xhtml',
      title: story.title,
      xhtml: chapterXhtml(story.title, story.description ?? ''),
    });
  }
  return chapters;
}

function paragraphXhtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeXml(paragraph.trim())}</p>`)
    .join('\n');
}

function chapterXhtml(title: string, text: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<html xmlns="http://www.w3.org/1999/xhtml">',
    '<head>',
    `    <title>${escapeXml(title)}</title>`,
    '</head>',
    '<body>',
    `    <h1>${escapeXml(title)}</h1>`,
    `    ${paragraphXhtml(text)}`,
    '</body>',
    '</html>',
  ].join('\n');
}

function containerXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '    <rootfiles>',
    '        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
    '    </rootfiles>',
    '</container>',
  ].join('\n');
}

function contentOpf(story: Story, chapters: BookChapter[], bookId: string): string {
  const manifest = [
    ...chapters.map(
      (chapter) =>
        `        <item id="${chapter.id}" href="${chapter.filename.replace('OEBPS/', '')}" media-type="application/xhtml+xml"/>`,
    ),
    '        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
  ].join('\n');
  const spine = chapters.map((chapter) => `        <itemref idref="${chapter.id}"/>`).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="book-id">',
    '    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">',
    `        <dc:identifier id="book-id">${escapeXml(bookId)}</dc:identifier>`,
    `        <dc:title>${escapeXml(story.title)}</dc:title>`,
    `        <dc:language>${escapeXml(story.lang ?? 'en')}</dc:language>`,
    `        <meta name="cover" content="none"/>`,
    ...(story.authorName
      ? [`        <dc:creator>${escapeXml(story.authorName)}</dc:creator>`]
      : []),
    ...(story.description
      ? [`        <dc:description>${escapeXml(story.description)}</dc:description>`]
      : []),
    '    </metadata>',
    '    <manifest>',
    manifest,
    '    </manifest>',
    '    <spine toc="ncx">',
    spine,
    '    </spine>',
    '</package>',
  ].join('\n');
}

function tocNcx(story: Story, chapters: BookChapter[], bookId: string): string {
  const navPoints = chapters
    .map((chapter, index) =>
      [
        `        <navPoint id="nav${index + 1}" playOrder="${index + 1}">`,
        `            <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>`,
        `            <content src="chapters/${chapter.filename.replace('OEBPS/chapters/', '')}"/>`,
        '        </navPoint>',
      ].join('\n'),
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">',
    '    <head>',
    `        <meta name="dtb:uid" content="${escapeXml(bookId)}"/>`,
    '    </head>',
    '    <docTitle>',
    `        <text>${escapeXml(story.title)}</text>`,
    '    </docTitle>',
    '    <navMap>',
    navPoints,
    '    </navMap>',
    '</ncx>',
  ].join('\n');
}

/**
 * Builds the EPUB bytes. The mimetype entry must be first and STORED
 * (uncompressed) per the OCF spec; `zipSync` preserves key insertion order.
 * Throws when a story has no usable text so callers can surface a retry.
 */
export function buildEpubBytes(story: Story, pages: StoryPage[]): Uint8Array {
  const chapters = toChapters(story, pages);
  if (!chapters.some((chapter) => chapter.xhtml.length > 0)) {
    throw new Error('No readable text found.');
  }

  const bookId = `urn:mr:${story.sourceId}:${story.id}`;
  const files: Zippable = {
    mimetype: [new TextEncoder().encode(MIMETYPE), { level: 0 }],
    'META-INF/container.xml': str(containerXml()),
    'OEBPS/content.opf': str(contentOpf(story, chapters, bookId)),
    'OEBPS/toc.ncx': str(tocNcx(story, chapters, bookId)),
  };
  for (const chapter of chapters) {
    files[chapter.filename] = str(chapter.xhtml);
  }
  return zipSync(files);
}

function str(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Wait-free wrapper: the export screen just awaits the pure byte build. */
export function buildEpub(story: Story, pages: StoryPage[]): Promise<Uint8Array> {
  return Promise.resolve(buildEpubBytes(story, pages));
}
