/**
 * Pure URL resolution for the "Add novel" import sheet.
 *
 * Maps a pasted story URL onto a supported source id + story id using the
 * real-world URL shapes the sources publish:
 * - Literotica: `literotica.com/s/<story-slug>` (see `sources/literotica/parsers.ts`)
 * - NovelFire:  `novelfire.net/book/<story-slug>[/chapter-N]` (see `sources/novelfire/parsers.ts`)
 * - RoyalRoad:  `royalroad.com/fiction/<numeric-id>[/...]` (see `sources/royalroad/parsers.ts`)
 *
 * No network access and no source-manager import: callers verify the resolved
 * source id against `listSourceInfos()` themselves.
 */

export type ResolvedStoryLink =
  | { kind: 'story'; sourceId: string; storyId: string }
  | { kind: 'unsupported' }
  | { kind: 'invalid' };

type SourceShape = {
  sourceId: string;
  hosts: string[];
  storyPath: RegExp;
};

const SOURCE_SHAPES: SourceShape[] = [
  {
    sourceId: 'literotica',
    hosts: ['literotica.com'],
    storyPath: /^\/s\/([a-z0-9-]+)/i,
  },
  {
    sourceId: 'novelfire',
    hosts: ['novelfire.net'],
    storyPath: /^\/book\/([a-z0-9-]+)(?:\/.*)?$/i,
  },
  {
    sourceId: 'royalroad',
    hosts: ['royalroad.com'],
    storyPath: /^\/fiction\/(\d+)(?:\/.*)?$/,
  },
];

export function resolveStoryLink(input: string): ResolvedStoryLink {
  const parsed = parseLink(input);
  if (!parsed) return { kind: 'invalid' };

  const shape = SOURCE_SHAPES.find((source) => source.hosts.includes(parsed.host));
  if (!shape) return { kind: 'unsupported' };

  const match = parsed.path.match(shape.storyPath);
  if (!match?.[1]) return { kind: 'unsupported' };

  return { kind: 'story', sourceId: shape.sourceId, storyId: match[1] };
}

type ParsedLink = { host: string; path: string } | null;

/**
 * Extracts host and path from a pasted link, tolerating missing schemes
 * (`literotica.com/s/...` without `https://`), scheme-prefixed hosts
 * (`//host/path`) and query/hash fragments. Returns `null` when nothing
 * URL-like is present.
 */
export function parseLink(input: string): ParsedLink {
  const text = input.trim();
  if (!text) return null;

  let rest = text;

  const scheme = rest.match(/^[a-z][a-z0-9+.-]*:(?:\/\/)?/i);
  if (scheme) rest = rest.slice(scheme[0].length);
  else if (rest.startsWith('//')) rest = rest.slice(2);

  const cut = rest.search(/[?#]/);
  if (cut >= 0) rest = rest.slice(0, cut);

  const slashIndex = rest.indexOf('/');
  const host = (slashIndex >= 0 ? rest.slice(0, slashIndex) : rest).trim().toLowerCase();
  const path = slashIndex >= 0 ? rest.slice(slashIndex) : '';

  if (!host || !host.includes('.')) return null;

  return { host: normalizeHost(host), path };
}

function normalizeHost(host: string): string {
  return host.replace(/^www\./i, '');
}
