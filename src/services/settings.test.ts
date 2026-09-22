import { describe, expect, it } from 'vitest';

import { defaultSettings, mergeSettings } from './settings';

describe('mergeSettings', () => {
  it('returns defaults for empty input', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings);
    expect(mergeSettings({})).toEqual(defaultSettings);
  });

  it('overrides known scalar keys', () => {
    const merged = mergeSettings({ theme: 'amoled', offlineMode: true });
    expect(merged.theme).toBe('amoled');
    expect(merged.offlineMode).toBe(true);
  });

  it('deep-merges nested groups without dropping defaults', () => {
    const merged = mergeSettings({ reader: { fontSize: 24 } });
    expect(merged.reader.fontSize).toBe(24);
    expect(merged.reader.fontFamily).toBe(defaultSettings.reader.fontFamily);
    expect(merged.reader.textAlign).toBe(defaultSettings.reader.textAlign);
  });

  it('ignores unknown keys', () => {
    const merged = mergeSettings({ notARealSetting: 1 });
    expect('notARealSetting' in merged).toBe(false);
  });

  it('does not mutate the shared defaults', () => {
    mergeSettings({ reader: { fontSize: 24 } });
    expect(defaultSettings.reader.fontSize).toBe(18);
  });
});
