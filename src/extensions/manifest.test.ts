import { describe, expect, it } from 'vitest';

import { ExtensionError, parseManifest, validateExtensionUrl } from './manifest';

const base = {
  id: 'com.example.source',
  name: 'Example',
  version: '1.0.0',
  baseUrl: 'https://example.com',
};

describe('parseManifest', () => {
  it('applies defaults', () => {
    const manifest = parseManifest(base);
    expect(manifest.lang).toBe('en');
    expect(manifest.capabilities).toEqual(['popular', 'latest', 'search']);
  });

  it('keeps provided capabilities', () => {
    expect(parseManifest({ ...base, capabilities: ['search'] }).capabilities).toEqual(['search']);
  });

  it('rejects invalid manifests', () => {
    expect(() => parseManifest({ ...base, name: '' })).toThrow(ExtensionError);
    expect(() => parseManifest({ ...base, id: 'nodots' })).toThrow(ExtensionError);
    expect(() => parseManifest({ ...base, baseUrl: 'not-a-url' })).toThrow(ExtensionError);
    expect(() => parseManifest(null)).toThrow(ExtensionError);
  });
});

describe('validateExtensionUrl', () => {
  it('accepts http and https URLs', () => {
    expect(validateExtensionUrl('https://example.com/source.js')).toBe(
      'https://example.com/source.js',
    );
    expect(validateExtensionUrl('  http://example.com/source.js  ')).toBe(
      'http://example.com/source.js',
    );
  });

  it('rejects other schemes and junk', () => {
    expect(() => validateExtensionUrl('file:///etc/passwd')).toThrow(ExtensionError);
    expect(() => validateExtensionUrl('javascript:alert(1)')).toThrow(ExtensionError);
    expect(() => validateExtensionUrl('nonsense')).toThrow(ExtensionError);
  });
});
