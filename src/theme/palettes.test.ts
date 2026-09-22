import { describe, expect, it } from 'vitest';

import { Palettes } from './palettes';

describe('theme palettes', () => {
  const referenceKeys = Object.keys(Palettes.light).sort();

  it('exposes the same semantic keys in every theme', () => {
    for (const [name, palette] of Object.entries(Palettes)) {
      expect(Object.keys(palette).sort(), `${name} palette keys`).toEqual(referenceKeys);
    }
  });

  it('uses non-empty string values everywhere', () => {
    for (const [name, palette] of Object.entries(Palettes)) {
      for (const [token, value] of Object.entries(palette)) {
        expect(typeof value, `${name}.${token}`).toBe('string');
        expect(value.length, `${name}.${token}`).toBeGreaterThan(0);
      }
    }
  });
});
