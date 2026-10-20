import { systemEngine } from './engines/system';
import type { NarrationEngineId } from '@/services/settings';
import type { VoiceInfo } from './types';
import { voicePackStatus, type VoicePackStatus } from './voice-pack-store';
import { voicePacksForEngine } from './voice-packs';

export type SelectableVoice = {
  id: string;
  name: string;
  language: string;
  engine: NarrationEngineId;
  /** True when the voice is downloaded and ready to be spoken with. */
  ready: boolean;
};

function toSelectable(voice: VoiceInfo): SelectableVoice {
  return {
    id: voice.id,
    name: voice.name,
    language: voice.language,
    engine: voice.engine,
    ready: true,
  };
}

/**
 * The voices that can be picked for an engine. The system engine lists the
 * voices Android has installed; a neural engine lists the voice packs that
 * are on the device, so the picker never offers a voice that cannot speak.
 */
export async function listSelectableVoices(engine: NarrationEngineId): Promise<SelectableVoice[]> {
  if (engine === 'system') {
    const voices = await systemEngine.listVoices();
    return voices.map(toSelectable);
  }
  const packs = voicePacksForEngine(engine);
  const rows: { pack: (typeof packs)[number]; status: VoicePackStatus }[] = [];
  for (const pack of packs) {
    const status = await voicePackStatus(pack).catch(() => ({ state: 'missing' }) as const);
    rows.push({ pack, status });
  }
  return rows
    .filter((row) => row.status.state === 'ready')
    .map((row) => ({
      id: row.pack.id,
      name: row.pack.name,
      language: row.pack.language,
      engine: row.pack.engine,
      ready: true,
    }));
}

/**
 * A short label for a voice id, used where the full name does not fit. The
 * voice itself is named by the settings screen; the player only shows which
 * voice is in use.
 */
export function voiceLabel(
  voiceId: string | null | undefined,
  fallback: string,
  names?: ReadonlyMap<string, string>,
): string {
  if (!voiceId) return fallback;
  return names?.get(voiceId) ?? voiceId;
}
