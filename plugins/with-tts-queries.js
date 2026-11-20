const { withAndroidManifest } = require('expo/config-plugins');

const TTS_ACTION = 'android.intent.action.TTS_SERVICE';

/**
 * Android 11+ package visibility hides the TTS services an app did not ask
 * about, which makes getEngines()/voice discovery return nothing.
 */
module.exports = function withTtsQueries(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    const queries = manifest.queries ?? [];
    const target = queries[0] ?? {};
    target.intent = target.intent ?? [];

    const declared = target.intent.some((intent) =>
      (intent.action ?? []).some((action) => action.$?.['android:name'] === TTS_ACTION),
    );
    if (!declared) {
      target.intent.push({ action: [{ $: { 'android:name': TTS_ACTION } }] });
    }
    if (queries.length === 0) queries.push(target);
    manifest.queries = queries;
    return result;
  });
};
