const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Drops lines that carry no words, such as `***`, `——` or `◇◇◇`. They are
 * chapter dividers, not prose: a voice should not read them and a reader has
 * nothing to show for them.
 */
export function stripDividerLines(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => line.trim() === '' || LETTER_OR_DIGIT.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Whether a block of text is only a divider, and so not worth speaking. */
export function isDividerText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && !LETTER_OR_DIGIT.test(trimmed);
}
