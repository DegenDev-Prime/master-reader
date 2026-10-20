import { localeDisplayName } from './system-voice-names';

export type NeuralEngineKind = 'piper' | 'kokoro';

export type VoicePackDef = {
  id: string;
  engine: NeuralEngineKind;
  name: string;
  language: string;
  /** Single tarball bundling model + tokens (+ voices.bin for Kokoro). */
  url: string;
  /** Expected download size in bytes (shown to the user, verified after). */
  bytes: number;
  /** Speaker id for multi-speaker models. */
  sid?: number;
  experimental?: boolean;
};

/**
 * Curated voice packs. Tarballs come from sherpa-onnx `tts-models` releases so
 * each pack ships model, tokens and phonemizer data together. Nothing here is
 * bundled with the app; packs download on demand into app storage.
 *
 * Licensing note: Piper voice models carry their own open-data terms (see each
 * pack's MODEL_CARD), and the Piper inference path is GPL-3.0-or-later via
 * OHF-Voice/piper1-gpl — kept as a separately downloaded pack, never linked
 * into the app build.
 */
export const VOICE_PACKS: VoicePackDef[] = [
  {
    id: 'piper-en-amy-low',
    engine: 'piper',
    name: 'Amy (US English)',
    language: 'en-US',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-low.tar.bz2',
    bytes: 67095344,
    sid: 0,
  },
  {
    id: 'piper-en-ryan-low',
    engine: 'piper',
    name: 'Ryan (US English)',
    language: 'en-US',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ryan-low.tar.bz2',
    bytes: 67100179,
    sid: 0,
  },
  {
    id: 'piper-en-lessac-low',
    engine: 'piper',
    name: 'Lessac (US English)',
    language: 'en-US',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-low-int8.tar.bz2',
    bytes: 21070568,
  },
  {
    id: 'piper-en-danny-low',
    engine: 'piper',
    name: 'Danny (US English)',
    language: 'en-US',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-danny-low-int8.tar.bz2',
    bytes: 21184916,
  },
  {
    id: 'piper-en-kathleen-low',
    engine: 'piper',
    name: 'Kathleen (US English)',
    language: 'en-US',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-kathleen-low-int8.tar.bz2',
    bytes: 21289266,
  },
  {
    id: 'piper-en-ljspeech-medium',
    engine: 'piper',
    name: 'LJSpeech (US English)',
    language: 'en-US',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ljspeech-medium-int8.tar.bz2',
    bytes: 21090429,
  },
  {
    id: 'piper-en-gb-alan-low',
    engine: 'piper',
    name: 'Alan (British English)',
    language: 'en-GB',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_GB-alan-low-int8.tar.bz2',
    bytes: 21289969,
  },
  {
    id: 'piper-en-gb-southern-female-low',
    engine: 'piper',
    name: 'Southern English Female (British English)',
    language: 'en-GB',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_GB-southern_english_female-low-int8.tar.bz2',
    bytes: 21207615,
  },
  {
    id: 'piper-en-gb-northern-male-medium',
    engine: 'piper',
    name: 'Northern English Male (British English)',
    language: 'en-GB',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_GB-northern_english_male-medium-int8.tar.bz2',
    bytes: 21100291,
  },
  {
    id: 'piper-en-gb-jenny-medium',
    engine: 'piper',
    name: 'Jenny Dioco (British English)',
    language: 'en-GB',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_GB-jenny_dioco-medium-int8.tar.bz2',
    bytes: 20950036,
  },
  {
    id: 'piper-de-thorsten-low',
    engine: 'piper',
    name: 'Thorsten (German)',
    language: 'de',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-de_DE-thorsten-low-int8.tar.bz2',
    bytes: 21292232,
  },
  {
    id: 'piper-fr-siwis-low',
    engine: 'piper',
    name: 'Siwis (French)',
    language: 'fr',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-fr_FR-siwis-low-int8.tar.bz2',
    bytes: 13317962,
  },
  {
    id: 'piper-es-sharvard-medium',
    engine: 'piper',
    name: 'Sharvard (Spanish)',
    language: 'es',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-sharvard-medium-int8.tar.bz2',
    bytes: 23477120,
  },
  {
    id: 'piper-pt-br-edresson-low',
    engine: 'piper',
    name: 'Edresson (Brazilian Portuguese)',
    language: 'pt-BR',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-pt_BR-edresson-low-int8.tar.bz2',
    bytes: 21198064,
  },
  {
    id: 'piper-it-paola-medium',
    engine: 'piper',
    name: 'Paola (Italian)',
    language: 'it',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-it_IT-paola-medium-int8.tar.bz2',
    bytes: 21143212,
  },
  {
    id: 'piper-ru-irina-medium',
    engine: 'piper',
    name: 'Irina (Russian)',
    language: 'ru',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-ru_RU-irina-medium-int8.tar.bz2',
    bytes: 21149417,
  },
  {
    id: 'piper-nl-pim-medium',
    engine: 'piper',
    name: 'Pim (Dutch)',
    language: 'nl',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-nl_NL-pim-medium-int8.tar.bz2',
    bytes: 21127183,
  },
  {
    id: 'piper-zh-xiao-ya-medium',
    engine: 'piper',
    name: 'Xiao Ya (Chinese)',
    language: 'zh',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-zh_CN-xiao_ya-medium-int8.tar.bz2',
    bytes: 14016124,
  },
  {
    id: 'kokoro-en-int8',
    engine: 'kokoro',
    name: 'Kokoro (English, compact)',
    language: 'en',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-en-v0_19.tar.bz2',
    bytes: 103248205,
    experimental: true,
  },
];

export function voicePackById(id: string): VoicePackDef | null {
  return VOICE_PACKS.find((pack) => pack.id === id) ?? null;
}

export function voicePacksForEngine(engine: NeuralEngineKind): VoicePackDef[] {
  return VOICE_PACKS.filter((pack) => pack.engine === engine);
}

export type VoicePackGroup = {
  language: string;
  label: string;
  packs: VoicePackDef[];
};

/** Groups packs under a readable language heading, ordered alphabetically. */
export function groupVoicePacksByLanguage(packs: VoicePackDef[]): VoicePackGroup[] {
  const byLanguage = new Map<string, VoicePackDef[]>();
  for (const pack of packs) {
    const rows = byLanguage.get(pack.language) ?? [];
    rows.push(pack);
    byLanguage.set(pack.language, rows);
  }
  return [...byLanguage.entries()]
    .map(([language, rows]) => ({
      language,
      label: localeDisplayName(language),
      packs: [...rows].sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
}
