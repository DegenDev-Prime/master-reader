import { describe, expect, it } from 'vitest';

import {
  browseReducer,
  initialBrowseState,
  isSearchActive,
  isStale,
  toSearchFilters,
  type BrowseState,
} from './browse-state';

function state(patch: Partial<BrowseState> = {}): BrowseState {
  return { ...initialBrowseState, ...patch };
}

describe('browseReducer', () => {
  it('starts in browse mode with no submitted query', () => {
    expect(initialBrowseState.mode).toBe('browse');
    expect(initialBrowseState.query).toBeNull();
    expect(isSearchActive(initialBrowseState)).toBe(false);
  });

  it('trims the term and enters search mode on submit', () => {
    const next = browseReducer(state({ term: '  vampires  ' }), { type: 'submit' });
    expect(next.mode).toBe('search');
    expect(next.query).toBe('vampires');
    expect(next.term).toBe('  vampires  ');
    expect(isSearchActive(next)).toBe(true);
  });

  it('leaves search when submitting an empty term', () => {
    const seeded = state({ mode: 'search', query: 'vampires', term: '   ' });
    const next = browseReducer(seeded, { type: 'submit' });
    expect(next.mode).toBe('browse');
    expect(next.query).toBeNull();
    expect(next.term).toBe('');
  });

  it('clears the term and the query but keeps every filter', () => {
    const seeded = state({
      mode: 'search',
      query: 'vampires',
      term: 'vampires',
      kind: 'latest',
      category: '31',
      sort: 'rating',
    });
    const next = browseReducer(seeded, { type: 'clear' });
    expect(next.mode).toBe('browse');
    expect(next.query).toBeNull();
    expect(next.term).toBe('');
    expect(next.kind).toBe('latest');
    expect(next.category).toBe('31');
    expect(next.sort).toBe('rating');
  });

  it('never changes mode while typing', () => {
    const seeded = state({ mode: 'search', query: 'vampires', term: 'vampires' });
    expect(browseReducer(seeded, { type: 'setTerm', term: 'vampire' })).toMatchObject({
      mode: 'search',
      query: 'vampires',
      term: 'vampire',
    });
    expect(browseReducer(state(), { type: 'setTerm', term: 'draft' })).toMatchObject({
      mode: 'browse',
      query: null,
      term: 'draft',
    });
  });

  it('applies filter actions without touching the mode', () => {
    const seeded = state({ mode: 'search', query: 'dragons' });
    expect(browseReducer(seeded, { type: 'setKind', kind: 'latest' })).toMatchObject({
      mode: 'search',
      kind: 'latest',
    });
    expect(browseReducer(seeded, { type: 'setCategory', category: '15' })).toMatchObject({
      mode: 'search',
      category: '15',
    });
    expect(browseReducer(seeded, { type: 'setSort', sort: 'newest' })).toMatchObject({
      mode: 'search',
      sort: 'newest',
    });
  });

  it('resets to the initial state (used when the provider changes)', () => {
    const seeded = state({ mode: 'search', query: 'dragons', kind: 'latest', category: '15' });
    expect(browseReducer(seeded, { type: 'reset' })).toEqual(initialBrowseState);
  });
});

describe('isStale', () => {
  it('ignores an untouched browse field', () => {
    expect(isStale(state())).toBe(false);
    expect(isStale(state({ term: '   ' }))).toBe(false);
  });

  it('reports an edited search field', () => {
    const submitted = state({ mode: 'search', query: 'vampires', term: 'vampires' });
    expect(isStale(submitted)).toBe(false);
    expect(isStale({ ...submitted, term: '  vampires  ' })).toBe(false);
    expect(isStale({ ...submitted, term: 'vampire diaries' })).toBe(true);
    expect(isStale({ ...submitted, term: '' })).toBe(true);
  });

  it('reports a drafted browse query', () => {
    expect(isStale(state({ term: 'dragons' }))).toBe(true);
  });
});

describe('toSearchFilters', () => {
  it('returns null outside search mode', () => {
    expect(toSearchFilters(state())).toBeNull();
    expect(toSearchFilters(state({ term: 'dragons' }))).toBeNull();
  });

  it('carries query, sort and category into the search filters', () => {
    expect(
      toSearchFilters(state({ mode: 'search', query: 'dragons', sort: 'newest', category: '15' })),
    ).toEqual({
      query: 'dragons',
      sort: 'newest',
      categories: ['15'],
    });
  });

  it('omits categories when no category is selected', () => {
    const filters = toSearchFilters(state({ mode: 'search', query: 'dragons' }));
    expect(filters).toEqual({ query: 'dragons', sort: 'relevance' });
    expect(filters?.categories).toBeUndefined();
  });

  it('serialises exactly like the previous submitted object', () => {
    const legacy = { query: 'dragons', sort: 'relevance', categories: undefined };
    const next = toSearchFilters(state({ mode: 'search', query: 'dragons' }));
    expect(JSON.parse(JSON.stringify(next))).toEqual(JSON.parse(JSON.stringify(legacy)));
  });

  it('keeps the browse listing independent of the sort', () => {
    expect(toSearchFilters(state({ sort: 'comments' }))).toBeNull();
  });
});
