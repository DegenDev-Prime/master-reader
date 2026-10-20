import { describe, expect, it } from 'vitest';

import {
  applyPronunciation,
  normalizeRuleInput,
  removeRule,
  rulesForStory,
  upsertRule,
  type PronunciationRule,
} from './pronunciation';

const rule = (id: string, scope: string, find: string, replace: string): PronunciationRule => ({
  id,
  scope,
  find,
  replace,
});

describe('rulesForStory', () => {
  it('returns global plus matching story rules, longest find first', () => {
    const rules = [
      rule('1', 'global', 'Ari', 'Arri'),
      rule('2', 'royalroad:7', 'Ariana', 'Ariaana'),
      rule('3', 'literotica:2', 'Zed', 'Xd'),
    ];
    expect(rulesForStory(rules, 'royalroad', '7').map((row) => row.id)).toEqual(['2', '1']);
  });

  it('orders story-scoped overrides before unrelated global ones of equal length', () => {
    const rules = [rule('1', 'global', 'Kai', 'Kei'), rule('2', 'royalroad:7', 'Kai', 'Kaa')];
    // Equal find lengths: insertion order. The story rule is applied second,
    // so a global mis-pronunciation can still be corrected immediately after.
    expect(rulesForStory(rules, 'royalroad', '7').map((row) => row.id)).toEqual(['1', '2']);
  });

  it('returns nothing for stories without rules', () => {
    expect(rulesForStory([rule('1', 'literotica:2', 'a', 'b')], 'novelfire', '9')).toEqual([]);
  });
});

describe('applyPronunciation', () => {
  it('replaces every occurrence literally', () => {
    const rules = [rule('1', 'global', 'Siobhan', 'Shi-VAWN')];
    expect(applyPronunciation('Siobhan met Siobhan.', rules)).toBe('Shi-VAWN met Shi-VAWN.');
  });

  it('applies rules in given order, longest-target first via rulesForStory', () => {
    const rules = rulesForStory(
      [rule('1', 'global', 'Ari', 'Arri'), rule('2', 'royalroad:7', 'Ariana', 'Ariaana')],
      'royalroad',
      '7',
    );
    expect(applyPronunciation('Ariana and Ari', rules)).toBe('Ariaana and Arri');
  });

  it('leaves text unchanged without rules', () => {
    expect(applyPronunciation('plain text', [])).toBe('plain text');
  });

  it('treats rule targets as literal text, not regex', () => {
    const rules = [rule('1', 'global', 'C++', 'C plus plus')];
    expect(applyPronunciation('Try C++(fast).', rules)).toBe('Try C plus plus(fast).');
  });

  it('never matches a replacement into an earlier rule target', () => {
    // "Shi" replacement feeding rule 2 would mangle text — one pass means the
    // replacement output is never scanned again.
    const rules = [rule('1', 'global', 'a', 'Shi'), rule('2', 'global', 'Shi', 'XX')];
    expect(applyPronunciation('a bear', rules)).toBe('Shi beShir');
  });
});

describe('normalizeRuleInput', () => {
  it('rejects empty find text', () => {
    expect(normalizeRuleInput('  ', 'x')).toBeNull();
    expect(normalizeRuleInput('', 'x')).toBeNull();
  });

  it('trims find and replace text', () => {
    expect(normalizeRuleInput('  Kai  ', ' Kay ')).toEqual({ find: 'Kai', replace: 'Kay' });
  });

  it('allows an empty replacement (silent read)', () => {
    expect(normalizeRuleInput('Hzhz', '')).toEqual({ find: 'Hzhz', replace: '' });
  });
});

describe('upsertRule', () => {
  it('replaces a rule with the same scope and find text', () => {
    const next = upsertRule([rule('1', 'global', 'Kai', 'Kei')], rule('2', 'global', 'Kai', 'Kaa'));
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('2');
  });

  it('keeps the same find under a different scope', () => {
    const next = upsertRule(
      [rule('1', 'global', 'Kai', 'Kei')],
      rule('2', 'royalroad:7', 'Kai', 'Kaa'),
    );
    expect(next).toHaveLength(2);
  });

  it('ignores writes with an empty find target', () => {
    expect(upsertRule([rule('1', 'global', 'Kai', 'Kei')], rule('2', 'global', '', 'x'))).toEqual([
      rule('1', 'global', 'Kai', 'Kei'),
    ]);
  });
});

describe('removeRule', () => {
  it('drops only the matching id', () => {
    const next = removeRule([rule('1', 'global', 'a', 'b'), rule('2', 'global', 'c', 'd')], '1');
    expect(next.map((row) => row.id)).toEqual(['2']);
  });
});
