import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

import { isDividerText } from '@/utils/speech-text';

export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  href?: string;
};

type TextBlock = {
  spans: InlineSpan[];
  text: string;
};

export type ChapterBlock =
  | ({ kind: 'heading'; level: number } & TextBlock)
  | ({ kind: 'paragraph' } & TextBlock)
  | ({ kind: 'quote' } & TextBlock)
  | ({ kind: 'listItem'; ordered: boolean; index: number } & TextBlock)
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'divider' }
  | { kind: 'pre'; text: string };

type InlineStyle = Omit<InlineSpan, 'text'>;

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'pre',
  'hr',
  'figure',
  'figcaption',
]);

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function mergeSpans(spans: InlineSpan[]): InlineSpan[] {
  const merged: InlineSpan[] = [];
  for (const span of spans) {
    if (!span.text) continue;
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.bold === span.bold &&
      previous.italic === span.italic &&
      previous.underline === span.underline &&
      previous.strike === span.strike &&
      previous.href === span.href
    ) {
      previous.text += span.text;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

function toTextBlock(spans: InlineSpan[]): TextBlock {
  const merged = mergeSpans(spans);
  if (merged.length > 0) {
    merged[0] = { ...merged[0], text: merged[0].text.replace(/^\s+/, '') };
    const last = merged.length - 1;
    merged[last] = { ...merged[last], text: merged[last].text.replace(/\s+$/, '') };
  }
  const kept = merged.filter((span) => span.text.length > 0);
  return { spans: kept, text: kept.map((span) => span.text).join('') };
}

function inlineSpans(api: CheerioAPI, node: AnyNode, style: InlineStyle = {}): InlineSpan[] {
  if (node.type === 'text') {
    return [{ ...style, text: node.data.replace(/\s+/g, ' ') }];
  }
  if (node.type !== 'tag') return [];

  const element = node as Element;
  const tag = element.name.toLowerCase();

  if (tag === 'br') return [{ ...style, text: '\n' }];
  if (tag === 'script' || tag === 'style') return [];
  if (tag === 'img') {
    const alt = element.attribs.alt ?? '';
    return alt ? [{ ...style, text: alt }] : [];
  }

  const nextStyle: InlineStyle = { ...style };
  if (tag === 'strong' || tag === 'b') nextStyle.bold = true;
  if (tag === 'em' || tag === 'i') nextStyle.italic = true;
  if (tag === 'u') nextStyle.underline = true;
  if (tag === 's' || tag === 'del') nextStyle.strike = true;
  if (tag === 'a' && element.attribs.href) nextStyle.href = element.attribs.href;

  return api(element)
    .contents()
    .toArray()
    .flatMap((child) => inlineSpans(api, child, nextStyle));
}

function textBlock(api: CheerioAPI, node: AnyNode): TextBlock {
  return toTextBlock(inlineSpans(api, node));
}

function pushParagraph(blocks: ChapterBlock[], spans: InlineSpan[]) {
  const block = toTextBlock(spans);
  if (!block.text.trim()) return;
  // "***" and "◇◇◇" separate scenes; showing them as text looks like a typo
  // and reading them out is noise.
  if (isDividerText(block.text)) {
    blocks.push({ kind: 'divider' });
    return;
  }
  blocks.push({ kind: 'paragraph', ...block });
}

function walk(api: CheerioAPI, node: AnyNode, blocks: ChapterBlock[]): void {
  if (node.type === 'text') {
    const paragraphs = node.data.replace(/\r\n/g, '\n').split(/\n{2,}/);
    for (const paragraph of paragraphs) {
      const text = normalizeText(paragraph);
      if (text) pushParagraph(blocks, [{ text }]);
    }
    return;
  }

  if (node.type !== 'tag') return;

  const element = node as Element;
  const tag = element.name.toLowerCase();
  const $node = api(element);

  if (tag === 'script' || tag === 'style') return;

  if (tag === 'p') {
    pushParagraph(blocks, inlineSpans(api, element));
    return;
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
    const block = textBlock(api, element);
    if (block.text) {
      blocks.push({ kind: 'heading', level: Number(tag[1]), ...block });
    }
    return;
  }

  if (tag === 'blockquote') {
    const text = textBlock(api, element);
    if (text.text) blocks.push({ kind: 'quote', ...text });
    return;
  }

  if (tag === 'pre') {
    const text = $node.text().replace(/\r\n/g, '\n').trim();
    if (text) blocks.push({ kind: 'pre', text });
    return;
  }

  if (tag === 'hr') {
    blocks.push({ kind: 'divider' });
    return;
  }

  if (tag === 'img') {
    const src = element.attribs.src;
    if (src) blocks.push({ kind: 'image', src, alt: element.attribs.alt ?? '' });
    return;
  }

  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol';
    $node.children('li').each((index, child) => {
      const block = textBlock(api, child);
      if (block.text) {
        blocks.push({ kind: 'listItem', ordered, index: index + 1, ...block });
      }
    });
    return;
  }

  if (tag === 'figure') {
    const image = $node.find('img').first();
    const src = image.attr('src');
    if (src) blocks.push({ kind: 'image', src, alt: image.attr('alt') ?? '' });
    const caption = normalizeText($node.find('figcaption').text());
    if (caption) pushParagraph(blocks, [{ text: caption }]);
    return;
  }

  const childNodes = $node.contents().toArray();
  if (childNodes.some((child) => child.type === 'tag' && BLOCK_TAGS.has((child as Element).name))) {
    for (const child of childNodes) walk(api, child, blocks);
    return;
  }

  if (tag === 'div' || tag === 'section' || tag === 'article') {
    const spans = inlineSpans(api, element);
    pushParagraph(blocks, spans);
    return;
  }

  if (tag === 'li') {
    const block = textBlock(api, element);
    if (block.text) blocks.push({ kind: 'listItem', ordered: false, index: 1, ...block });
    return;
  }

  const spans = inlineSpans(api, element);
  pushParagraph(blocks, spans);
}

export function parseChapterBlocks(html: string): ChapterBlock[] {
  const api = load(html);
  const blocks: ChapterBlock[] = [];
  const roots = api('body').length
    ? api('body').contents().toArray()
    : api.root().contents().toArray();
  for (const node of roots) {
    walk(api, node, blocks);
  }
  return blocks;
}

export function blockText(block: ChapterBlock): string {
  switch (block.kind) {
    case 'image':
    case 'divider':
      return '';
    case 'pre':
      return block.text;
    default:
      return block.text;
  }
}
