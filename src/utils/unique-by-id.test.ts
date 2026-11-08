import { describe, expect, it } from 'vitest';

import { uniqueById } from './unique-by-id';

describe('uniqueById', () => {
  it('keeps the first card for a repeated source/id pair', () => {
    const items = [
      { sourceId: 'literotica', id: 'series-55', title: 'Part 1' },
      { sourceId: 'literotica', id: 'series-55', title: 'Part 2' },
      { sourceId: 'literotica', id: '201', title: 'Standalone' },
    ];

    expect(uniqueById(items).map((item) => item.title)).toEqual(['Part 1', 'Standalone']);
  });

  it('does not merge equal ids from different sources', () => {
    expect(
      uniqueById([
        { sourceId: 'a', id: '1' },
        { sourceId: 'b', id: '1' },
      ]),
    ).toHaveLength(2);
  });
});
