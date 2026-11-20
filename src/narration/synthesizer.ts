import type { ResolvedNarration } from './backends';
import type { ClipSynthesizer } from './clip-worker';
import { createNeuralSynthesizer } from './engines/neural';
import { createSystemSynthesizer } from './engines/system';

/** One factory for every backend, so the controller never knows which is active. */
export function createNarrationSynthesizer(resolved: ResolvedNarration): ClipSynthesizer {
  if (resolved.engine === 'system') {
    return createSystemSynthesizer({ getVoiceId: () => resolved.voiceId });
  }
  return createNeuralSynthesizer(resolved.engine, { getVoicePackId: () => resolved.pack.id });
}
