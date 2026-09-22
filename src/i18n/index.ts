import { getLocales } from 'expo-localization';

import { setLocale } from './translator';

// Seed the translator with the device language on first import.
setLocale(getLocales()[0]?.languageCode ?? null);

export * from './translator';
