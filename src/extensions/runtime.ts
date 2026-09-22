import type { WebView } from 'react-native-webview';

import { ExtensionError, parseManifest, type ExtensionManifest } from './manifest';
import { performExtensionRequest } from './http';
import { serializeMessage, parseRunnerToHost, type ExtensionHttpRequest } from './protocol';

let callSeq = 0;
function nextCallId(): string {
  callSeq += 1;
  return `c${callSeq}`;
}

type PendingCall = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

/**
 * Drives one sandboxed extension inside a hidden WebView. The WebView signals
 * when the runner is ready, the host injects the extension source, and calls
 * are exchanged as JSON messages. Network access is bridged back to the app.
 */
export class ExtensionRuntime {
  /** Resolves with the manifest once the extension has been evaluated. */
  readonly ready: Promise<ExtensionManifest>;

  private webview: WebView | null = null;
  private code: string | null = null;
  private booted = false;

  private readonly pending = new Map<string, PendingCall>();
  private readonly loadedPromise: Promise<void>;
  private resolveReady!: (manifest: ExtensionManifest) => void;
  private rejectReady!: (error: Error) => void;
  private resolveLoaded!: () => void;
  private rejectLoaded!: (error: Error) => void;

  constructor(readonly label: string) {
    this.ready = new Promise<ExtensionManifest>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.loadedPromise = new Promise<void>((resolve, reject) => {
      this.resolveLoaded = resolve;
      this.rejectLoaded = reject;
    });
  }

  attach(webview: WebView | null): void {
    this.webview = webview;
    if (webview && this.booted && this.code) {
      this.post({ type: 'load', code: this.code });
    }
  }

  /** Queues the extension source; it is evaluated once the runner is ready. */
  load(code: string): void {
    this.code = code;
    if (this.webview && this.booted) {
      this.post({ type: 'load', code });
    }
  }

  handleMessage(raw: string): void {
    const message = parseRunnerToHost(raw);
    if (!message) return;

    switch (message.type) {
      case 'ready':
        this.booted = true;
        if (this.code) this.post({ type: 'load', code: this.code });
        return;

      case 'loaded':
        try {
          const manifest = parseManifest(message.manifest);
          this.resolveReady(manifest);
          this.resolveLoaded();
        } catch (error) {
          this.fail(error as Error);
        }
        return;

      case 'loadError':
        this.fail(new ExtensionError(message.error));
        return;

      case 'result': {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(message.error));
        return;
      }

      case 'http':
        void this.handleHttp(message.id, message.request);
        return;

      case 'log':
        console.log(`[extension:${this.label}] ${message.message}`);
        return;

      default:
        return;
    }
  }

  async call(method: string, args: unknown[]): Promise<unknown> {
    await this.loadedPromise;
    const id = nextCallId();
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({ type: 'call', id, method, args });
    });
  }

  dispose(): void {
    for (const pending of this.pending.values()) {
      pending.reject(new ExtensionError('Extension was unloaded'));
    }
    this.pending.clear();
    this.webview = null;
  }

  private fail(error: Error): void {
    this.rejectReady(error);
    this.rejectLoaded(error);
  }

  private async handleHttp(id: string, request: ExtensionHttpRequest): Promise<void> {
    try {
      const response = await performExtensionRequest(request);
      this.post({ type: 'httpResult', id, response });
    } catch (error) {
      this.post({
        type: 'httpError',
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private post(message: Parameters<typeof serializeMessage>[0]): void {
    this.webview?.postMessage(serializeMessage(message));
  }
}

// ---------------------------------------------------------------------------
// Runtime manager
// ---------------------------------------------------------------------------

const runtimes = new Map<string, ExtensionRuntime>();

export function setRuntime(id: string, runtime: ExtensionRuntime): void {
  runtimes.set(id, runtime);
}

export function getRuntime(id: string): ExtensionRuntime | undefined {
  return runtimes.get(id);
}

export function deleteRuntime(id: string): void {
  runtimes.get(id)?.dispose();
  runtimes.delete(id);
}

let prober: ((code: string) => Promise<ExtensionManifest>) | null = null;

/** Registered by the extension host so install screens can evaluate code. */
export function setExtensionProber(
  fn: ((code: string) => Promise<ExtensionManifest>) | null,
): void {
  prober = fn;
}

export async function probeExtension(code: string): Promise<ExtensionManifest> {
  if (!prober) throw new ExtensionError('The extension runtime is not ready yet.');
  return prober(code);
}
