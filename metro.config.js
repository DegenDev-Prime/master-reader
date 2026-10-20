const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');

// `cheerio` ships a browser build that avoids Node's `stream` and `undici`.
// Metro does not use the `browser` export condition on native platforms, so
// it would resolve the ESM build, which imports `node:stream` and fails to
// bundle. Point it at the browser build explicitly.
//
// The browser build is plain JavaScript over `parse5` and `htmlparser2` and
// pulls in no Node built-ins, so it runs under Hermes unchanged.
const CHEERIO_BROWSER_BUILD = path.resolve(
  __dirname,
  'node_modules/cheerio/dist/browser/index.js',
);

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'cheerio') {
    return context.resolveRequest(context, CHEERIO_BROWSER_BUILD, platform);
  }
  return resolveRequest
    ? resolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
