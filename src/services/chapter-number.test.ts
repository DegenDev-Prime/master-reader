import { describe, expect, it } from 'vitest';

import { chapterNumberFromRef } from './chapter-number';

describe('chapterNumberFromRef', () => {
  it('reads the number from a "Chapter 6" title', () => {
    expect(chapterNumberFromRef({ id: 'x', index: 5, title: 'Chapter 6 - The Title' })).toBe(6);
  });

  it('reads the number from a "Chapter 6:" title', () => {
    expect(chapterNumberFromRef({ id: 'x', index: 5, title: 'Chapter 6: The Title' })).toBe(6);
  });

  it('reads the number from a "Part 2" title', () => {
    expect(chapterNumberFromRef({ id: 'x', index: 1, title: 'Part 2 - The Title' })).toBe(2);
  });

  it('reads the number from a "Chapter 1 - 1: Title" title', () => {
    expect(chapterNumberFromRef({ id: 'x', index: 0, title: 'Chapter 1 - 1: Nightmare' })).toBe(1);
  });

  it('returns null when the title carries no number', () => {
    expect(chapterNumberFromRef({ id: 'x', index: 3, title: 'A photo update' })).toBeNull();
  });

  it('returns null for an empty title', () => {
    expect(chapterNumberFromRef({ id: 'x', index: 3, title: '' })).toBeNull();
  });

  it('does not read a number from the middle of a title', () => {
    expect(chapterNumberFromRef({ id: 'x', index: 3, title: 'Update for chapter 12' })).toBeNull();
  });
});
