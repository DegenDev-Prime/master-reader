import { describe, expect, it } from 'vitest';

import { findTargetInTree, type NavigationNode } from './parent';

type State = {
  routes?: { name?: string; params?: Record<string, string>; key?: string }[];
  index?: number;
};

function node(state: State, parent?: NavigationNode): NavigationNode {
  return {
    getState: () => state,
    getParent: () => parent,
  };
}

const CHAPTERS = '/chapters/[sourceId]/[id]';

describe('findTargetInTree', () => {
  it('finds a route in the root stack', () => {
    const root = node({
      routes: [
        { name: '(tabs)' },
        { name: 'story/[sourceId]/[id]', params: { sourceId: 'a', id: 'b' } },
        { name: 'chapters/[sourceId]/[id]', params: { sourceId: 'a', id: 'b' } },
      ],
      index: 2,
    });

    expect(findTargetInTree(root, { pathname: CHAPTERS, params: { sourceId: 'a', id: 'b' } })).toBe(
      true,
    );
  });

  it('finds a route above the tab navigator', () => {
    // A tab screen only sees the tab navigator; the root stack is its parent.
    const root = node({
      routes: [
        { name: '(tabs)' },
        { name: 'chapters/[sourceId]/[id]', params: { sourceId: 'a', id: 'b' } },
      ],
      index: 1,
    });
    const tabs = node(
      {
        routes: [{ name: 'index' }, { name: 'browse' }],
        index: 0,
      },
      root,
    );

    expect(findTargetInTree(tabs, { pathname: CHAPTERS, params: { sourceId: 'a', id: 'b' } })).toBe(
      true,
    );
    expect(findTargetInTree(root, { pathname: CHAPTERS, params: { sourceId: 'a', id: 'b' } })).toBe(
      true,
    );
  });

  it('does not match a route with different params', () => {
    const root = node({
      routes: [{ name: 'chapters/[sourceId]/[id]', params: { sourceId: 'a', id: 'b' } }],
      index: 0,
    });

    expect(
      findTargetInTree(root, { pathname: CHAPTERS, params: { sourceId: 'a', id: 'other' } }),
    ).toBe(false);
  });

  it('does not match the screen that is showing', () => {
    const root = node({
      routes: [{ name: 'chapters/[sourceId]/[id]', params: { sourceId: 'a', id: 'b' }, key: 'k1' }],
      index: 0,
    });

    expect(findTargetInTree(root, { pathname: CHAPTERS, params: { sourceId: 'a', id: 'b' } })).toBe(
      false,
    );
  });

  it('handles a missing state', () => {
    const empty: NavigationNode = {
      getState: () => undefined,
      getParent: () => undefined,
    };
    expect(findTargetInTree(empty, { pathname: CHAPTERS })).toBe(false);
  });
});
