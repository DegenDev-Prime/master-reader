import { create } from 'zustand';

import { settingsRepository } from '@/db/repositories';
import { createId } from '@/utils/id';
import {
  GLOBAL_SCOPE,
  normalizeRuleInput,
  PRONUNCIATION_SETTINGS_KEY,
  removeRule as removeRulePure,
  upsertRule as upsertRulePure,
  type PronunciationRule,
  type PronunciationScope,
} from '@/services/pronunciation';

/**
 * Pronunciation rules, persisted as one JSON blob under the generic
 * `settings` key/value table — mirroring how `stores/settings.ts` stores typed
 * groups without schema work. A rule is `{ id, scope, find, replace }` where
 * scope is `global` or `${sourceId}:${storyId}`. A dedicated table is a later
 * DB-agent task; this store never touches the schema.
 */
type PronunciationState = {
  rules: PronunciationRule[];
  isHydrated: boolean;
  /** Scope the add-rule form writes into. */
  scope: PronunciationScope;
  hydrate: () => Promise<void>;
  setScope: (scope: PronunciationScope) => void;
  addRule: (find: string, replace: string) => Promise<boolean>;
  removeRule: (id: string) => Promise<void>;
};

function isRule(value: unknown): value is PronunciationRule {
  if (typeof value !== 'object' || value === null) return false;
  const rule = value as PronunciationRule;
  return (
    typeof rule.id === 'string' &&
    rule.id.length > 0 &&
    typeof rule.scope === 'string' &&
    rule.scope.length > 0 &&
    typeof rule.find === 'string' &&
    rule.find.length > 0 &&
    typeof rule.replace === 'string'
  );
}

export const usePronunciationStore = create<PronunciationState>((set, get) => ({
  rules: [],
  isHydrated: false,
  scope: GLOBAL_SCOPE,

  async hydrate() {
    if (get().isHydrated) return;
    const stored = await settingsRepository.get<unknown>(PRONUNCIATION_SETTINGS_KEY);
    set({ rules: Array.isArray(stored) ? stored.filter(isRule) : [], isHydrated: true });
  },

  setScope(scope) {
    set({ scope });
  },

  async addRule(find, replace) {
    const normalized = normalizeRuleInput(find, replace);
    if (!normalized) return false;
    const next = upsertRulePure(get().rules, {
      id: createId('prn'),
      scope: get().scope,
      find: normalized.find,
      replace: normalized.replace,
    });
    set({ rules: next });
    await settingsRepository.set(PRONUNCIATION_SETTINGS_KEY, next);
    return true;
  },

  async removeRule(id) {
    const next = removeRulePure(get().rules, id);
    set({ rules: next });
    await settingsRepository.set(PRONUNCIATION_SETTINGS_KEY, next);
  },
}));
