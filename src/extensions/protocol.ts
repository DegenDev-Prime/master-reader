/**
 * Message protocol between the host (React Native) and the sandbox runner
 * (a hidden WebView). Kept pure so it can be unit-tested.
 */

export type ExtensionHttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
};

export type ExtensionHttpResponse = {
  ok: boolean;
  status: number;
  text: string;
  headers?: Record<string, string>;
};

/** Messages sent from the host into the WebView. */
export type HostToRunner =
  | { type: 'load'; code: string }
  | { type: 'httpResult'; id: string; response: ExtensionHttpResponse }
  | { type: 'httpError'; id: string; error: string };

/** Messages sent from the WebView back to the host. */
export type RunnerToHost =
  | { type: 'ready' }
  | { type: 'loaded'; manifest: unknown }
  | { type: 'loadError'; error: string }
  | { type: 'call'; id: string; method: string; args: unknown[] }
  | { type: 'http'; id: string; request: ExtensionHttpRequest }
  | { type: 'result'; id: string; ok: true; result: unknown }
  | { type: 'result'; id: string; ok: false; error: string }
  | { type: 'log'; message: string };

export function serializeMessage(message: HostToRunner | RunnerToHost): string {
  return JSON.stringify(message);
}

export function parseHostToRunner(raw: string): HostToRunner | null {
  const value = safeParse(raw);
  if (!value || typeof value !== 'object') return null;
  const type = (value as { type?: unknown }).type;
  if (type === 'load' || type === 'httpResult' || type === 'httpError') {
    return value as HostToRunner;
  }
  return null;
}

export function parseRunnerToHost(raw: string): RunnerToHost | null {
  const value = safeParse(raw);
  if (!value || typeof value !== 'object') return null;
  const type = (value as { type?: unknown }).type;
  switch (type) {
    case 'ready':
    case 'loaded':
    case 'loadError':
    case 'call':
    case 'http':
    case 'result':
    case 'log':
      return value as RunnerToHost;
    default:
      return null;
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
