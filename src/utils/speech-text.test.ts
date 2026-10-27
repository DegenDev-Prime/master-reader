import { describe, expect, it } from 'vitest';

import { isDividerText, stripDividerLines } from './speech-text';

describe('stripDividerLines', () => {
  it('drops lines made only of symbols', () => {
    expect(stripDividerLines('One.\n***\nTwo.')).toBe('One.\nTwo.');
    expect(stripDividerLines('One.\n——\n◇◇◇\n~*~*~\nTwo.')).toBe('One.\nTwo.');
  });

  it('keeps prose that starts or ends with symbols', () => {
    expect(stripDividerLines('...and then she left.')).toBe('...and then she left.');
    expect(stripDividerLines('"Stop!"')).toBe('"Stop!"');
  });

  it('keeps numbers and non-latin scripts', () => {
    expect(stripDividerLines('2024\n***\n第1章')).toBe('2024\n第1章');
  });

  it('leaves blank lines alone', () => {
    expect(stripDividerLines('One.\n\nTwo.')).toBe('One.\n\nTwo.');
  });

  it('collapses the gap a dropped line leaves behind', () => {
    expect(stripDividerLines('One.\n***\n\nTwo.')).toBe('One.\n\nTwo.');
  });

  it('returns an empty string for nothing but dividers', () => {
    expect(stripDividerLines('***\n——')).toBe('');
  });
});

describe('isDividerText', () => {
  it('recognises a divider block', () => {
    expect(isDividerText('***')).toBe(true);
    expect(isDividerText('  · · ·  ')).toBe(true);
    expect(isDividerText('A line.')).toBe(false);
    expect(isDividerText('')).toBe(false);
  });
});
