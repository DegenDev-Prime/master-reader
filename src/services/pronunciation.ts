/**
 * Pronunciation rules: "fix a name once, fixed everywhere."
 *
 * Pure text transforms applied after `htmlToPlainText` and before
 * `chunkPages` in the narration pipeline. Rules live in one of two scopes:
 * - `global`              — applied for every story.
 * - `${sourceId}:${storyId}` — applied only where that story is narrated.
 * No storage here: persistence is a plain store concern, and the DB agent
 * owns the eventual table.
 */

/** `global` or `${sourceId}:${storyId}`. Kept as a string so scope keys can be stored as-is. */
export type PronunciationScope = string;

export type PronunciationRule = {
  id: string;
  scope: PronunciationScope;
  find: string;
  replace: string;
};

export const GLOBAL_SCOPE = 'global';
export const PRONUNCIATION_SETTINGS_KEY = 'pronunciation';

/** Returns the rules that apply when narrating the given story. */
export function rulesForStory(
  rules: PronunciationRule[],
  sourceId: string,
  storyId: string,
): PronunciationRule[] {
  const storyScope = `${sourceId}:${storyId}`;
  const applicable = rules.filter(
    (rule) => rule.scope === GLOBAL_SCOPE || rule.scope === storyScope,
  );
  // Longest match wins when rule targets overlap; ties keep insertion order
  // (stable sort) so user expectations are independent of rule age.
  return [...applicable].sort(
    (a, b) => b.find.length - a.find.length || rules.indexOf(a) - rules.indexOf(b),
  );
}

/**
 * Applies the rule pass to a chunk of plain text. One left-to-right scan in
 * which the longest rule target wins at each position: replacement output is
 * never re-matched by later rules, so fixes compose predictably. Matching is
 * literal and case-sensitive — pronunciation fixes are names and terms, where
 * matching exactly beats guessing inflections.
 */
export function applyPronunciation(text: string, rules: readonly PronunciationRule[]): string {
  const applicable = rules.filter((rule) => rule.find.length > 0);
  if (!text || applicable.length === 0) return text;

  const sorted = [...applicable].sort((a, b) => b.find.length - a.find.length);
  const replacements = new Map(sorted.map((rule) => [rule.find, rule.replace]));
  const pattern = new RegExp(sorted.map((rule) => escapeRegExp(rule.find)).join('|'), 'g');
  return text.replace(pattern, (match) => replacements.get(match) ?? match);
}

/**
 * Maps narration text back onto displayed text.
 *
 * Narration chunks index into the pronunciation-applied, whitespace-normalized
 * page text, while the reader displays the untouched plain text. To highlight
 * paragraphs and support tap-to-move, the reader re-runs the same pass while
 * recording, for every narration character, the [start, end) range it came
 * from in the original text. Replacement output therefore maps into the span
 * of the rule target it replaced.
 *
 * Zero-rule sessions (the common case) keep everything identity-mapped, and
 * chunk offsets that would fall inside a collapsed whitespace run resolve to
 * the run's outer bounds. This is exactly the `applyPronunciation` +
 * whitespace-normalize pipeline used before `chunkPages`.
 */
export type MappedNarration = {
  /** Narration-space text: what `SpeechChunk.start`/`end` index into. */
  text: string;
  /** Per narration character: inclusive source start in the original text. */
  starts: Int32Array;
  /** Per narration character: exclusive source end in the original text. */
  ends: Int32Array;
};

export function applyPronunciationMapped(
  text: string,
  rules: readonly PronunciationRule[],
): MappedNarration {
  const { output, sourceStart, sourceEnd } = runRulePass(text, rules);
  return normalizeWithRanges(output, sourceStart, sourceEnd);
}

function runRulePass(
  text: string,
  rules: readonly PronunciationRule[],
): { output: string; sourceStart: number[]; sourceEnd: number[] } {
  const applicable = rules.filter((rule) => rule.find.length > 0);
  const pieces: string[] = [];
  const sourceStart: number[] = [];
  const sourceEnd: number[] = [];

  const pushIdentity = (from: number, to: number) => {
    for (let index = from; index < to; index += 1) {
      pieces.push(text[index]);
      sourceStart.push(index);
      sourceEnd.push(index + 1);
    }
  };

  if (!text || applicable.length === 0) {
    pushIdentity(0, text.length);
    return { output: pieces.join(''), sourceStart, sourceEnd };
  }

  const sorted = [...applicable].sort((a, b) => b.find.length - a.find.length);
  const replacements = new Map(sorted.map((rule) => [rule.find, rule.replace]));
  const pattern = new RegExp(sorted.map((rule) => escapeRegExp(rule.find)).join('|'), 'g');
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    pushIdentity(cursor, match.index);
    const replacement = replacements.get(match[0]) ?? match[0];
    pieces.push(replacement);
    for (let index = 0; index < replacement.length; index += 1) {
      sourceStart.push(match.index);
      sourceEnd.push(match.index + match[0].length);
    }
    cursor = match.index + match[0].length;
  }
  pushIdentity(cursor, text.length);
  return { output: pieces.join(''), sourceStart, sourceEnd };
}

/** Mirrors chunkPages' whitespace normalization while folding the range maps. */
function normalizeWithRanges(
  output: string,
  sourceStart: number[],
  sourceEnd: number[],
): MappedNarration {
  const length = output.length;
  let from = 0;
  while (from < length && /\s/.test(output[from])) from += 1;
  let to = length;
  while (to > from && /\s/.test(output[to - 1])) to -= 1;

  const pieces: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  while (from < to) {
    if (/\s/.test(output[from])) {
      const runStart = from;
      while (from < to && /\s/.test(output[from])) from += 1;
      pieces.push(' ');
      starts.push(sourceStart[runStart]);
      ends.push(sourceEnd[from - 1]);
      continue;
    }
    pieces.push(output[from]);
    starts.push(sourceStart[from]);
    ends.push(sourceEnd[from]);
    from += 1;
  }
  return {
    text: pieces.join(''),
    starts: Int32Array.from(starts),
    ends: Int32Array.from(ends),
  };
}

/**
 * Translates a narration-space [start, end) range into the original text.
 * Chunk ends often extend one space past the text, so the end offset clamps
 * onto the last mapped character.
 */
export function sourceRangeForNarrationRange(
  mapped: MappedNarration,
  start: number,
  end: number,
): { start: number; end: number } {
  const length = mapped.starts.length;
  if (length === 0) return { start: 0, end: 0 };
  const from = Math.min(Math.max(0, Math.floor(start)), length);
  const to = Math.min(Math.max(0, Math.floor(end)), length);
  const rangeStart = mapped.starts[Math.min(from, length - 1)];
  const lastIndex = Math.max(Math.min(to - 1, length - 1), 0);
  return {
    start: rangeStart,
    end: mapped.ends[lastIndex],
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Rejects empty/broken edits so rows always render a playable rule pair. */
export function normalizeRuleInput(
  find: string,
  replace: string,
): { find: string; replace: string } | null {
  const trimmedFind = find.trim();
  if (!trimmedFind) return null;
  return { find: trimmedFind, replace: replace.trim() };
}

/**
 * Collapses an or-else list of writes into a fresh rule set, dropping any two
 * rules that share the same (scope, find) pair — the last write wins.
 */
export function upsertRule(
  rules: readonly PronunciationRule[],
  rule: PronunciationRule,
): PronunciationRule[] {
  const withoutDuplicateScope = rules.filter(
    (existing) => !(existing.scope === rule.scope && existing.find === rule.find),
  );
  if (!rule.find) return [...rules];
  return [...withoutDuplicateScope, rule];
}

/** Remove a rule by id; no-op when absent. */
export function removeRule(rules: readonly PronunciationRule[], id: string): PronunciationRule[] {
  return rules.filter((rule) => rule.id !== id);
}
