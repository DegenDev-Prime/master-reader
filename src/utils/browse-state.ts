import type { BrowseKind, SearchFilters, SearchSort } from '@/sources';

export type BrowseMode = 'browse' | 'search';

export type BrowseState = {
  /** `search` only ever holds a submitted query; `browse` never does. */
  mode: BrowseMode;
  kind: BrowseKind;
  category: string | null;
  /** Live text field value — never affects results until submitted. */
  term: string;
  /** Last submitted query. `null` means the browse listing is showing. */
  query: string | null;
  sort: SearchSort;
};

export type BrowseAction =
  | { type: 'setTerm'; term: string }
  | { type: 'submit' }
  | { type: 'clear' }
  | { type: 'reset' }
  | { type: 'setKind'; kind: BrowseKind }
  | { type: 'setCategory'; category: string | null }
  | { type: 'setSort'; sort: SearchSort };

export const initialBrowseState: BrowseState = {
  mode: 'browse',
  kind: 'popular',
  category: null,
  term: '',
  query: null,
  sort: 'relevance',
};

/**
 * Mode changes only on an explicit `submit` or `clear`; filters are retained
 * across mode switches so leaving search returns to the same listing.
 */
export function browseReducer(state: BrowseState, action: BrowseAction): BrowseState {
  switch (action.type) {
    case 'setTerm':
      return { ...state, term: action.term };
    case 'submit': {
      const query = state.term.trim();
      if (query.length === 0) return { ...state, mode: 'browse', query: null, term: '' };
      return { ...state, mode: 'search', query };
    }
    case 'clear':
      return { ...state, mode: 'browse', query: null, term: '' };
    case 'reset':
      return initialBrowseState;
    case 'setKind':
      return { ...state, kind: action.kind };
    case 'setCategory':
      return { ...state, category: action.category };
    case 'setSort':
      return { ...state, sort: action.sort };
  }
}

export function isSearchActive(state: BrowseState): boolean {
  return state.mode === 'search';
}

/** True while the text field holds something other than the active query. */
export function isStale(state: BrowseState): boolean {
  return state.term.trim() !== (state.query ?? '');
}

/**
 * `undefined` fields drop out of the react-query key hash exactly like the
 * previous `submitted` object, so searches cached before this refactor stay warm.
 */
export function toSearchFilters(state: BrowseState): SearchFilters | null {
  if (state.mode !== 'search') return null;
  return {
    query: state.query ?? undefined,
    sort: state.sort,
    categories: state.category ? [state.category] : undefined,
  };
}
