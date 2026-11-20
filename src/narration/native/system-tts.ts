import { requireNativeModule } from 'expo-modules-core';

export type SystemTtsVoice = {
  id: string;
  name: string;
  language: string;
  networkRequired: boolean;
};

type SystemTtsModuleType = {
  isAvailable(): boolean;
  warmup(): Promise<void>;
  getVoices(): Promise<SystemTtsVoice[]>;
  synthesize(text: string, voiceId: string | null, outputPath: string): Promise<void>;
  release(): Promise<void>;
};

let cached: SystemTtsModuleType | null | undefined;
let availability: boolean | null = null;

/**
 * Typed access to the local Android system TTS module. Returns null when the
 * module is not linked (Expo Go or a build predating it), so the resolver can
 * fall back to a neural pack instead of crashing.
 */
export function getSystemTtsModule(): SystemTtsModuleType | null {
  if (cached !== undefined) return cached;
  try {
    cached = requireNativeModule<SystemTtsModuleType>('SystemTts');
  } catch {
    cached = null;
  }
  return cached;
}

/** Memoized: this is read during render and on every backend resolution. */
export function systemTtsAvailable(): boolean {
  const module = getSystemTtsModule();
  if (!module) return false;
  availability ??= module.isAvailable();
  return availability;
}
