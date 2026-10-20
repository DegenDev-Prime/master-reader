import { decodeHtmlEntities } from './html';

/** First capture group of the first match, or null. */
export function firstMatch(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match ? (match[1] ?? match[0]) : null;
}

/** All matches of a global/system-agnostic pattern, cloned to avoid lastIndex leaks. */
export function allMatches(html: string, pattern: RegExp): RegExpExecArray[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const results: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    results.push(match);
    if (match.index === re.lastIndex) re.lastIndex += 1;
  }
  return results;
}

/** Reads an attribute from a single tag string, tolerating unquoted values. */
export function getAttribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (!match) return null;
  return decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? '');
}

/**
 * Extracts the inner HTML of the first element carrying `id="<id>"` using a
 * balanced tag scan, so nested `<div>` blocks inside the element are preserved.
 */
export function extractElementById(html: string, id: string, tag = 'div'): string | null {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRe = new RegExp(
    `<${tag}\\b[^>]*\\bid\\s*=\\s*(?:"${escaped}"|'${escaped}'|${escaped})(?=[\\s>])[^>]*>`,
    'i',
  );
  return sliceBalanced(html, openRe, tag);
}

/**
 * Extracts the inner HTML of the first element whose `class` attribute contains
 * `className`, using a balanced tag scan for nesting safety.
 */
export function extractElementByClass(html: string, className: string, tag = 'div'): string | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRe = new RegExp(
    `<${tag}\\b[^>]*\\bclass\\s*=\\s*(?:"[^"]*${escaped}[^"]*"|'[^']*${escaped}[^']*')[^>]*>`,
    'i',
  );
  return sliceBalanced(html, openRe, tag);
}

function sliceBalanced(html: string, openRe: RegExp, tag: string): string | null {
  const open = openRe.exec(html);
  if (!open) return null;

  const start = open.index + open[0].length;
  const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  tagRe.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    if (match[1] === '/') {
      if (depth === 0) return html.slice(start, match.index);
      depth -= 1;
    } else if (!match[0].endsWith('/>')) {
      depth += 1;
    }
  }
  return html.slice(start);
}

/** Collapses whitespace and decodes entities in a text fragment. */
export function cleanText(input: string): string {
  return decodeHtmlEntities(input.replace(/\s+/g, ' ')).trim();
}

export function stripTags(input: string): string {
  return cleanText(input.replace(/<[^>]+>/g, ' '));
}

/** Runs `worker` over `items` with a bounded number of in-flight promises. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}
