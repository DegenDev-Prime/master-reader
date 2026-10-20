import { requireNativeModule } from 'expo-modules-core';

export type SherpaInitResult = {
  sampleRate: number;
  numSpeakers: number;
};

export type SherpaSynthResult = {
  sampleRate: number;
  frames: number;
};

type SherpaTtsModuleType = {
  isAvailable(): boolean;
  initVoice(engine: 'piper' | 'kokoro', dir: string, numThreads: number): Promise<SherpaInitResult>;
  synthesize(text: string, sid: number, outputPath: string): Promise<SherpaSynthResult>;
  extractTarBz2(archivePath: string, destDir: string): Promise<string[]>;
  release(): Promise<void>;
};

let cached: SherpaTtsModuleType | null | undefined;

/**
 * Typed access to the sherpa-tts native module. Returns null when the module
 * is not linked (e.g. Expo Go or a build predating Phase 2) so engines can
 * report themselves unavailable instead of crashing.
 */
export function getSherpaTtsModule(): SherpaTtsModuleType | null {
  if (cached !== undefined) return cached;
  try {
    cached = requireNativeModule<SherpaTtsModuleType>('SherpaTts');
  } catch {
    cached = null;
  }
  return cached;
}
