import { browserFetch } from '@/services/browser-fetch';

import type { HtmlLoader } from './types';

/**
 * `HtmlLoader` backed by the in-app thin browser. Providers that are behind bot
 * challenges (Cloudflare) use this so the challenge's JavaScript executes.
 */
/**
 * A bot challenge needs a real browser to run its script, which can take a
 * minute on a cold cookie jar. The generous timeout keeps slow providers
 * working instead of failing them after a few seconds.
 */
const BROWSER_TIMEOUT_MS = 90_000;

export const browserHtmlLoader: HtmlLoader = async (url, options) => {
  const { html } = await browserFetch({
    url,
    waitForSelector: options?.waitForSelector,
    timeoutMs: BROWSER_TIMEOUT_MS,
  });
  return html;
};

/**
 * Runs an expression inside the in-app browser and returns its result. The
 * page keeps its own session, so same-origin calls the page itself makes —
 * including AJAX endpoints that reject plain requests — succeed here.
 */
export async function browserEvaluate(url: string, expression: string): Promise<string> {
  const { result } = await browserFetch({
    url,
    timeoutMs: BROWSER_TIMEOUT_MS,
    evaluate: expression,
  });
  return result ?? '';
}
