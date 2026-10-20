import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  buildReadinessScript,
  parseBrowserPageMessage,
  setBrowserFetcher,
  type BrowserFetchRequest,
  type BrowserFetchResult,
} from '@/services/browser-fetch';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_SETTLE_MS = 250;
const TIMEOUT_GRACE_MS = 5_000;

type Queued = {
  id: string;
  request: BrowserFetchRequest;
  resolve: (result: BrowserFetchResult) => void;
  reject: (error: Error) => void;
};

type Machine = {
  queue: Queued[];
  current: Queued | null;
  timer: ReturnType<typeof setTimeout> | null;
};

function newId(): string {
  return `bf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mounts a single hidden WebView that loads pages on behalf of providers that
 * need a real browser to pass bot challenges. Requests are serialised; cookies
 * persist in the WebView so a clearance cookie survives across requests.
 */
export function BrowserHost() {
  const webviewRef = useRef<WebView>(null);
  const [source, setSource] = useState<{ uri: string; id: string } | null>(null);
  const machine = useRef<Machine>({ queue: [], current: null, timer: null });
  const settleRef = useRef<(id: string, result?: BrowserFetchResult, error?: Error) => void>(
    () => {},
  );
  const pumpRef = useRef<() => void>(() => {});

  const start = useCallback((next: Queued) => {
    const state = machine.current;
    state.current = next;
    setSource({ uri: next.request.url, id: next.id });
    state.timer = setTimeout(
      () => settleRef.current(next.id, undefined, new Error('Browser fetch timed out')),
      (next.request.timeoutMs ?? DEFAULT_TIMEOUT_MS) + TIMEOUT_GRACE_MS,
    );
  }, []);

  const pump = useCallback(() => {
    const state = machine.current;
    if (state.current) return;
    const next = state.queue.shift();
    if (next) start(next);
  }, [start]);

  const settle = useCallback((id: string, result?: BrowserFetchResult, error?: Error) => {
    const state = machine.current;
    if (!state.current || state.current.id !== id) return;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    const active = state.current;
    state.current = null;
    setSource(null);
    if (error) active.reject(error);
    else if (result) active.resolve(result);
    pumpRef.current();
  }, []);

  useEffect(() => {
    settleRef.current = settle;
  }, [settle]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  useEffect(() => {
    setBrowserFetcher(
      (request) =>
        new Promise<BrowserFetchResult>((resolve, reject) => {
          machine.current.queue.push({ id: newId(), request, resolve, reject });
          pumpRef.current();
        }),
    );
    return () => setBrowserFetcher(null);
  }, []);

  const injectReadiness = useCallback(() => {
    const state = machine.current;
    if (!state.current || !webviewRef.current) return;
    const request = state.current.request;
    webviewRef.current.injectJavaScript(
      buildReadinessScript({
        id: state.current.id,
        waitForSelector: request.waitForSelector,
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        settleMs: request.settleMs ?? DEFAULT_SETTLE_MS,
        evaluate: request.evaluate,
      }),
    );
  }, []);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const message = parseBrowserPageMessage(event.nativeEvent.data);
      if (!message) return;
      if (message.ready) {
        settle(message.id, {
          url: message.url,
          html: message.html,
          ...(message.result !== undefined ? { result: message.result } : {}),
        });
      } else {
        settle(message.id, undefined, new Error('Could not get past the provider challenge'));
      }
    },
    [settle],
  );

  if (!source) return null;

  return (
    <WebView
      key={source.id}
      ref={webviewRef}
      source={{ uri: source.uri }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
      // The WebView's own user agent carries the "; wv" marker, which bot
      // challenges treat as automation. Replacing the application name drops
      // the marker while keeping the real engine version, so the identity
      // stays self-consistent.
      applicationNameForUserAgent="Chrome"
      androidLayerType="hardware"
      onLoadEnd={injectReadiness}
      onMessage={onMessage}
      onError={(event) => {
        // A failed navigation must not leave the queue waiting for a reply.
        const state = machine.current;
        if (!state.current) return;
        settle(state.current.id, undefined, new Error(event.nativeEvent.description));
      }}
      onContentProcessDidTerminate={() => {
        const state = machine.current;
        if (!state.current) return;
        settle(state.current.id, undefined, new Error('The browser process was terminated'));
      }}
      style={styles.hidden}
      containerStyle={styles.hidden}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  // The WebView is laid out on screen and kept in the topmost layer, but it
  // neither draws nor takes touches. A bot challenge checks that the page is
  // really rendered; a hidden or occluded view never clears that check.
  hidden: {
    position: 'absolute',
    width: 360,
    height: 640,
    opacity: 0.01,
    left: 0,
    top: 0,
    zIndex: 1000,
  },
});
