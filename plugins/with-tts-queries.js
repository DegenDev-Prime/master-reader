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
    const declared = queries.some((query) =>
      (query.intent ?? []).some((intent) =>
        (intent.action ?? []).some((action) => action.$?.['android:name'] === TTS_ACTION),
      ),
    );
    if (!declared) {
      queries.push({ intent: [{ action: [{ $: { 'android:name': TTS_ACTION } }] }] });
    }
    manifest.queries = queries;
    return result;
  });
};
