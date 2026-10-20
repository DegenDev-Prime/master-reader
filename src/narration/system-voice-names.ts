export type RawSystemVoice = {
  id: string;
  name: string;
  language: string;
};

export type NormalizedSystemVoice = {
  id: string;
  label: string;
  language: string;
};

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  bg: 'Bulgarian',
  bn: 'Bengali',
  bs: 'Bosnian',
  ca: 'Catalan',
  cs: 'Czech',
  cy: 'Welsh',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fa: 'Persian',
  fi: 'Finnish',
  fil: 'Filipino',
  fr: 'French',
  ga: 'Irish',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  id: 'Indonesian',
  in: 'Indonesian',
  jv: 'Javanese',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ka: 'Georgian',
  kk: 'Kazakh',
  ku: 'Kurdish',
  ko: 'Korean',
  la: 'Latin',
  lt: 'Lithuanian',
  lv: 'Latvian',
  ml: 'Malayalam',
  ms: 'Malay',
  ne: 'Nepali',
  nb: 'Norwegian Bokmål',
  nl: 'Dutch',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  si: 'Sinhala',
  sk: 'Slovak',
  sl: 'Slovenian',
  sq: 'Albanian',
  sr: 'Serbian',
  sv: 'Swedish',
  su: 'Sundanese',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  yue: 'Cantonese',
  zh: 'Chinese',
};

const COUNTRY_NAMES: Record<string, string> = {
  AR: 'Argentina',
  AT: 'Austria',
  AU: 'Australia',
  BE: 'Belgium',
  BR: 'Brazil',
  CA: 'Canada',
  CH: 'Switzerland',
  CL: 'Chile',
  CN: 'China',
  CO: 'Colombia',
  CZ: 'Czechia',
  DE: 'Germany',
  DK: 'Denmark',
  DZ: 'Algeria',
  EG: 'Egypt',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GB: 'United Kingdom',
  GR: 'Greece',
  HK: 'Hong Kong',
  HU: 'Hungary',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IN: 'India',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  LU: 'Luxembourg',
  MX: 'Mexico',
  MY: 'Malaysia',
  NG: 'Nigeria',
  NL: 'Netherlands',
  NO: 'Norway',
  NZ: 'New Zealand',
  PE: 'Peru',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  RS: 'Serbia',
  RU: 'Russia',
  SE: 'Sweden',
  SG: 'Singapore',
  SI: 'Slovenia',
  SK: 'Slovakia',
  TH: 'Thailand',
  TR: 'Turkey',
  TW: 'Taiwan',
  UA: 'Ukraine',
  US: 'United States',
  VN: 'Vietnam',
  ZA: 'South Africa',
};

/** Android TTS fragments that describe the pipeline instead of the voice. */
const NOISE_TOKENS = new Set(['x', 'language', 'voice', 'tts', 'default', 'sfx']);

type ParsedTag = { language: string; region?: string };

export function parseLocaleTag(tag: string): ParsedTag | null {
  const parts = tag.trim().toLowerCase().split(/[-_]/).filter(Boolean);
  const language = parts[0];
  if (!language || !/^[a-z]{2,3}$/.test(language)) return null;
  const region = parts[1];
  if (region && /^[a-z]{2}$/.test(region)) return { language, region: region.toUpperCase() };
  return { language };
}

/** English display name for a locale tag, e.g. `en-US` → `English (United States)`. */
export function localeDisplayName(tag: string): string {
  const parsed = parseLocaleTag(tag);
  if (!parsed) return tag.trim() || tag;
  const language = LANGUAGE_NAMES[parsed.language] ?? parsed.language.toUpperCase();
  if (!parsed.region) return language;
  const country = COUNTRY_NAMES[parsed.region] ?? parsed.region;
  return `${language} (${country})`;
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type VoiceShape = { variant: string | null; code: string | null };

/**
 * Splits a raw Android id such as `en-us-x-sfg-network` into a readable
 * qualifier (`Network`) and the opaque engine code that produced it (`sfg`).
 */
function shapeOf(raw: string): VoiceShape {
  const tokens = raw
    .trim()
    .toLowerCase()
    .split(/[-_.\s]+/)
    .map((token) => token.replace(/[^a-z]/g, ''))
    .filter(Boolean);

  let cursor = 0;
  if (tokens[0] && /^[a-z]{2,3}$/.test(tokens[0])) cursor = 1;
  if (tokens[cursor] && /^[a-z]{2}$/.test(tokens[cursor])) cursor += 1;
  if (tokens[cursor] === 'x') cursor += 1;

  const rest = tokens.slice(cursor).filter((token) => !NOISE_TOKENS.has(token));
  const descriptive = rest.filter((token) => token.length >= 5);
  const codes = rest.filter((token) => token.length < 5);

  return {
    variant: descriptive.length ? titleCase(descriptive.join(' ')) : null,
    code: codes.length ? titleCase(codes.join(' ')) : null,
  };
}

/** Package segment (`com.google.android.tts` → `google`) used as a qualifier. */
function engineHint(id: string): string | null {
  const parts = id.split('.');
  if (parts.length < 3) return null;
  const candidate = parts.find((part) => part.length > 2 && part !== 'com') ?? parts[1];
  return candidate ? titleCase(candidate) : null;
}

type PendingVoice = NormalizedSystemVoice & { variant: string | null; code: string | null };

/**
 * Turns raw `expo-speech` voices (whose Android `name` is the untranslated TTS
 * identifier) into readable, de-duplicated, sorted labels. Collisions — Google
 * ships many near-identical voices per locale — are disambiguated with the
 * engine code carried in the id.
 */
export function normalizeSystemVoices(voices: RawSystemVoice[]): NormalizedSystemVoice[] {
  const seen = new Set<string>();
  const rows: PendingVoice[] = [];

  for (const voice of voices) {
    const id = voice.id || voice.name;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const tag = parseLocaleTag(voice.language) ? voice.language : localeFromId(id, voice.name);
    const shape = id.includes('.') ? { variant: engineHint(id), code: null } : shapeOf(id);
    rows.push({ id, language: tag, label: '', variant: shape.variant, code: shape.code });
  }

  const baseLabel = (row: PendingVoice): string => {
    const base = localeDisplayName(row.language);
    return row.variant ? `${base} · ${row.variant}` : base;
  };

  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = baseLabel(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const used = new Set<string>();
  for (const row of rows) {
    let label = baseLabel(row);
    if ((counts.get(label) ?? 0) > 1 && row.code) label = `${label} (${row.code})`;
    let unique = label;
    let suffix = 2;
    while (used.has(unique)) {
      unique = `${label} #${suffix}`;
      suffix += 1;
    }
    used.add(unique);
    row.label = unique;
  }

  return rows
    .map(({ id, label, language }) => ({ id, label, language }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

function localeFromId(id: string, name: string): string {
  const match = `${id} ${name}`.match(/([a-z]{2,3})[-_]([a-z]{2})\b/i);
  return match ? `${match[1].toLowerCase()}-${match[2].toUpperCase()}` : 'en';
}
