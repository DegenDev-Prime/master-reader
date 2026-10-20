import { describe, expect, it } from 'vitest';

import { buildHref, isTargetOnStack, routeName, type StackRoute } from './parent';

describe('buildHref', () => {
  it('fills a dynamic segment', () => {
    expect(
      buildHref({
        pathname: '/chapters/[sourceId]/[id]',
        params: { sourceId: 'novelfire', id: 'shadow-slave' },
      }),
    ).toBe('/chapters/novelfire/shadow-slave');
  });

  it('leaves a segment alone when the value is missing', () => {
    expect(buildHref({ pathname: '/chapters/[sourceId]/[id]', params: { sourceId: 'a' } })).toBe(
      '/chapters/a/[id]',
    );
  });

  it('escapes values that need it', () => {
    expect(buildHref({ pathname: '/chapters/[sourceId]', params: { sourceId: 'a b/c' } })).toBe(
      '/chapters/a%20b%2Fc',
    );
  });

  it('handles a path with no dynamic segments', () => {
    expect(buildHref({ pathname: '/settings/backup' })).toBe('/settings/backup');
  });
});

describe('routeName', () => {
  it('drops the leading slash', () => {
    expect(routeName('/chapters/[sourceId]/[id]')).toBe('chapters/[sourceId]/[id]');
  });
});

describe('isTargetOnStack', () => {
  const routes: StackRoute[] = [
    { name: '(tabs)' },
    { name: 'story/[sourceId]/[id]', params: { sourceId: 'novelfire', id: 'shadow-slave' } },
    { name: 'chapters/[sourceId]/[id]', params: { sourceId: 'novelfire', id: 'shadow-slave' } },
  ];

  it('finds a route with the same dynamic values', () => {
    expect(
      isTargetOnStack(routes, {
        pathname: '/chapters/[sourceId]/[id]',
        params: { sourceId: 'novelfire', id: 'shadow-slave' },
      }),
    ).toBe(true);
  });

  it('ignores a route with different dynamic values', () => {
    expect(
      isTargetOnStack(routes, {
        pathname: '/chapters/[sourceId]/[id]',
        params: { sourceId: 'novelfire', id: 'other-novel' },
      }),
    ).toBe(false);
  });

  it('ignores a route of a different name', () => {
    expect(isTargetOnStack(routes, { pathname: '/settings' })).toBe(false);
  });

  it('does not count the current screen', () => {
    const currentKey = 'chapter-key';
    const withKey = [
      ...routes,
      {
        key: currentKey,
        name: 'chapters/[sourceId]/[id]',
        params: { sourceId: 'novelfire', id: 'shadow-slave' },
      },
    ];
    expect(
      isTargetOnStack(
        withKey,
        {
          pathname: '/chapters/[sourceId]/[id]',
          params: { sourceId: 'novelfire', id: 'shadow-slave' },
        },
        currentKey,
      ),
    ).toBe(true);
  });

  it('finds a second copy of the same route', () => {
    const duplicated: StackRoute[] = [
      ...routes,
      { name: 'chapters/[sourceId]/[id]', params: { sourceId: 'novelfire', id: 'shadow-slave' } },
    ];
    expect(
      isTargetOnStack(duplicated, {
        pathname: '/chapters/[sourceId]/[id]',
        params: { sourceId: 'novelfire', id: 'shadow-slave' },
      }),
    ).toBe(true);
  });
});
