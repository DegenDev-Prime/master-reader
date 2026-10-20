import { describe, expect, it } from 'vitest';

import { chapterDisplayTitle } from './chapter-title';

describe('chapterDisplayTitle', () => {
  it('removes repeated chapter numbers from provider titles', () => {
    expect(chapterDisplayTitle('Chapter 6 - 6: Confronting the Tyrant')).toBe(
      'Confronting the Tyrant',
    );
    expect(chapterDisplayTitle('Chapter 1: Nightmare Begins')).toBe('Nightmare Begins');
    expect(chapterDisplayTitle('12. The Road')).toBe('The Road');
  });

  it('keeps titles that only contain the chapter number', () => {
    expect(chapterDisplayTitle('Chapter 6')).toBe('Chapter 6');
  });

  it('leaves ordinary titles untouched', () => {
    expect(chapterDisplayTitle('The Strings of Fate')).toBe('The Strings of Fate');
    expect(chapterDisplayTitle(null)).toBe('');
  });
});
