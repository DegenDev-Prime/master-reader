import type { NarrationEngineId } from '@/services/settings';

import type { VoicePackDef } from './voice-packs';

export type NarrationBackendFacts = {
  /** The Android TTS service and its voices are present. */
  systemAvailable: boolean;
  systemVoiceIds: readonly string[];
  installedPacks: readonly VoicePackDef[];
};

export type ResolvedNarration =
  | {
      engine: 'system';
      voiceId: string | null;
      /** Set when the requested engine was unavailable and another was used. */
      fallbackFrom: NarrationEngineId | null;
    }
  | {
      engine: 'piper' | 'kokoro';
      pack: VoicePackDef;
      fallbackFrom: NarrationEngineId | null;
    };

type RequestedNarration = {
  engine: NarrationEngineId;
  voiceId: string | null;
};

function installedOf(
  packs: readonly VoicePackDef[],
  engine: 'piper' | 'kokoro',
): VoicePackDef | null {
  return packs.find((pack) => pack.engine === engine) ?? null;
}

function neuralFallback(
  requested: NarrationEngineId,
  packs: readonly VoicePackDef[],
): ResolvedNarration | null {
  for (const engine of ['piper', 'kokoro'] as const) {
    const pack = installedOf(packs, engine);
    if (pack) return { engine, pack, fallbackFrom: requested };
  }
  return null;
}

/**
 * Picks the backend from settings and what is actually installed. A missing
 * pack or a device without a TTS service falls back to the other family; the
 * `fallbackFrom` field lets the UI say so once instead of failing playback.
 */
export function resolveNarration(
  requested: RequestedNarration,
  facts: NarrationBackendFacts,
): ResolvedNarration | null {
  const packs = facts.installedPacks;

  if (requested.engine === 'system') {
    if (facts.systemAvailable) {
      const voiceId =
        requested.voiceId && facts.systemVoiceIds.includes(requested.voiceId)
          ? requested.voiceId
          : null;
      return { engine: 'system', voiceId, fallbackFrom: null };
    }
    return neuralFallback('system', packs);
  }

  const requestedPack = requested.voiceId
    ? packs.find((pack) => pack.id === requested.voiceId && pack.engine === requested.engine)
    : null;
  const pack = requestedPack ?? installedOf(packs, requested.engine);
  if (pack) return { engine: requested.engine, pack, fallbackFrom: null };

  if (facts.systemAvailable) {
    const voiceId =
      requested.voiceId && facts.systemVoiceIds.includes(requested.voiceId)
        ? requested.voiceId
        : null;
    return { engine: 'system', voiceId, fallbackFrom: requested.engine };
  }
  return neuralFallback(requested.engine, packs);
}

/** Stable identity for the controller and synth cache. */
export function narrationBackendKey(resolved: ResolvedNarration): string {
  return resolved.engine === 'system'
    ? `system:${resolved.voiceId ?? 'default'}`
    : `${resolved.engine}:${resolved.pack.id}`;
}
