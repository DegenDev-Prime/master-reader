import { describe, expect, it } from 'vitest';

import { CookieJar } from './cookies';

describe('CookieJar', () => {
  it('stores and replays cookies for a host', () => {
    const jar = new CookieJar();
    jar.setFromResponse('https://literotica.com/api/3/constants', [
      'session=abc123; Path=/; Domain=.literotica.com',
      'theme=dark; Path=/',
    ]);

    expect(jar.size).toBe(2);
    expect(jar.getCookieHeader('https://literotica.com/api/1/top')).toBe(
      'session=abc123; theme=dark',
    );
  });

  it('does not leak cookies to unrelated domains', () => {
    const jar = new CookieJar();
    jar.setFromResponse('https://literotica.com/', ['a=1; Domain=literotica.com']);

    expect(jar.getCookieHeader('https://example.com/')).toBeUndefined();
    expect(jar.getCookieHeader('https://literotica.com/')).toBe('a=1');
  });

  it('drops expired cookies', () => {
    const jar = new CookieJar();
    jar.setFromResponse('https://literotica.com/', ['gone=1; Max-Age=0']);

    expect(jar.getCookieHeader('https://literotica.com/')).toBeUndefined();
  });

  it('ignores malformed set-cookie values', () => {
    const jar = new CookieJar();
    jar.setFromResponse('https://literotica.com/', ['not-a-cookie']);

    expect(jar.size).toBe(0);
  });
});
