const { withAppBuildGradle } = require('expo/config-plugins');

const SPLITS_BLOCK = `splits {
        abi {
            reset()
            enable true
            universalApk true
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }
`;

const withAbiSplits = (config) =>
  withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('universalApk')) {
      config.modResults.contents = config.modResults.contents.replace(
        /android\s*\{/,
        `android {\n    ${SPLITS_BLOCK}`,
      );
    }
    return config;
  });

module.exports = withAbiSplits;
