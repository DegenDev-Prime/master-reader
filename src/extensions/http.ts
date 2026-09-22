import { responseCache } from '@/services/response-cache';
import { HttpClient, HttpError } from '@/sources/transport';
import { useSettingsStore } from '@/stores/settings';

import type { ExtensionHttpRequest, ExtensionHttpResponse } from './protocol';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = (typeof METHODS)[number];

/**
 * Network bridge for extensions. Requests go through the same cached,
 * rate-limited and offline-aware transport as built-in sources, so extensions
 * get caching for free and never hit CORS.
 */
const client = new HttpClient({
  userAgent: 'MasterReader/0.1 (extension)',
  retries: 2,
  timeoutMs: 20_000,
  cache: responseCache,
  isOffline: () => useSettingsStore.getState().settings.offlineMode,
});

function normalizeMethod(method?: string): Method {
  const upper = (method ?? 'GET').toUpperCase();
  return (METHODS as readonly string[]).includes(upper) ? (upper as Method) : 'GET';
}

export async function performExtensionRequest(
  request: ExtensionHttpRequest,
): Promise<ExtensionHttpResponse> {
  try {
    const text = await client.request<string>(request.url, {
      method: normalizeMethod(request.method),
      query: request.query,
      headers: request.headers,
      body: request.body,
      responseType: 'text',
    });
    return { ok: true, status: 200, text };
  } catch (error) {
    if (error instanceof HttpError) {
      return { ok: false, status: error.status, text: error.body ?? '' };
    }
    throw error;
  }
}

export function fetchExtensionCode(url: string): Promise<string> {
  return client.get<string>(url, { responseType: 'text' });
}
