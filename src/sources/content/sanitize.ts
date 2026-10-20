import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'em',
  'i',
  'strong',
  'b',
  'u',
  's',
  'del',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'pre',
  'code',
];

function resolveUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

/** Converts provider output to the stored HTML subset; plain text keeps its paragraphs. */
export function prepareChapterHtml(value: string, baseUrl: string): string {
  if (looksLikeHtml(value)) {
    return sanitizeChapterHtml(value, baseUrl);
  }

  const paragraphs = value
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`);

  return sanitizeChapterHtml(paragraphs.join(''), baseUrl);
}

export function sanitizeChapterHtml(html: string, baseUrl: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['http', 'https'],
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ? resolveUrl(attribs.href, baseUrl) : null;
        const next: Record<string, string> = href ? { href } : {};
        return { tagName, attribs: next };
      },
      img: (tagName, attribs) => {
        const src = attribs.src ? resolveUrl(attribs.src, baseUrl) : null;
        const next: Record<string, string> = src ? { src, alt: attribs.alt ?? '' } : {};
        return { tagName, attribs: next };
      },
    },
  });
}
