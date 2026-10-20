import { localeDisplayName } from './system-voice-names';
import type { VoiceInfo } from './types';

export type VoiceGroup = {
  language: string;
  label: string;
  voices: VoiceInfo[];
};

/** Case-insensitive match on a voice's name, language tag or language label. */
export function filterVoices(voices: VoiceInfo[], query: string): VoiceInfo[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return voices;
  return voices.filter(
    (voice) =>
      voice.name.toLowerCase().includes(needle) ||
      voice.language.toLowerCase().includes(needle) ||
      localeDisplayName(voice.language).toLowerCase().includes(needle),
  );
}

/** Groups voices under a readable language heading, ordered alphabetically. */
export function groupVoicesByLanguage(voices: VoiceInfo[]): VoiceGroup[] {
  const byLanguage = new Map<string, VoiceInfo[]>();
  for (const voice of voices) {
    const rows = byLanguage.get(voice.language) ?? [];
    rows.push(voice);
    byLanguage.set(voice.language, rows);
  }
  return [...byLanguage.entries()]
    .map(([language, rows]) => ({
      language,
      label: localeDisplayName(language),
      voices: [...rows].sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
}
