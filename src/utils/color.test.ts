import { describe, expect, it } from 'vitest';

import { withAlpha } from './color';

describe('withAlpha', () => {
  it('converts a six digit hex colour', () => {
    expect(withAlpha('#3C87F7', 0.3)).toBe('rgba(60, 135, 247, 0.3)');
  });

  it('expands shorthand hex colours', () => {
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('passes through non hex colours unchanged', () => {
    expect(withAlpha('red', 0.3)).toBe('red');
  });

  it('rejects malformed hex colours', () => {
    expect(withAlpha('#12', 0.3)).toBe('#12');
    expect(withAlpha('#zzzzzz', 0.3)).toBe('#zzzzzz');
  });
});
