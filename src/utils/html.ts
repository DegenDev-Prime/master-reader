const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201d',
  ldquo: '\u201c',
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return fromCodePoint(parseInt(entity.slice(2), 16), match);
    }
    if (entity.startsWith('#')) {
      return fromCodePoint(parseInt(entity.slice(1), 10), match);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function fromCodePoint(code: number, fallback: string): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

/**
 * Converts simple HTML (as returned in story page content) into readable plain
 * text: block tags become paragraph breaks, list items get bullets, everything
 * else is stripped and entities are decoded.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html;
  text = text.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  text = text.replace(/<\s*li[^>]*>/gi, '\n\u2022 ');
  text = text.replace(/<\/\s*li\s*>/gi, '');
  text = text.replace(/<\/\s*(p|div|h[1-6]|blockquote)\s*>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, '');
  text = decodeHtmlEntities(text);

  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function estimateWordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}
