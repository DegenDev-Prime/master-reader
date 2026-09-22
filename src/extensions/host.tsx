import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { useExtensionsStore } from '@/stores/extensions';

import type { ExtensionManifest, ExtensionRecord } from './manifest';
import { EXTENSION_RUNNER_HTML } from './runner';
import { ExtensionRuntime, deleteRuntime, setExtensionProber, setRuntime } from './runtime';

type ProbeRequest = { id: string; code: string };
type ProbeResolver = {
  resolve: (manifest: ExtensionManifest) => void;
  reject: (error: Error) => void;
};

/**
 * Mounts the hidden sandboxes that execute installed extensions and hosts the
 * transient sandbox used to evaluate extensions during installation. Renders
 * nothing when no extensions are installed.
 */
export function ExtensionHost() {
  const records = useExtensionsStore((state) => state.records);
  const syncSources = useExtensionsStore((state) => state.syncSources);

  const [probes, setProbes] = useState<ProbeRequest[]>([]);
  const resolvers = useRef(new Map<string, ProbeResolver>());

  useEffect(() => {
    setExtensionProber((code) => {
      const id = `probe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      return new Promise<ExtensionManifest>((resolve, reject) => {
        resolvers.current.set(id, { resolve, reject });
        setProbes((current) => [...current, { id, code }]);
      });
    });

    return () => setExtensionProber(null);
  }, []);

  const handleProbeDone = useCallback((id: string, manifest?: ExtensionManifest, error?: Error) => {
    const resolver = resolvers.current.get(id);
    resolvers.current.delete(id);
    setProbes((current) => current.filter((probe) => probe.id !== id));

    if (error) resolver?.reject(error);
    else if (manifest) resolver?.resolve(manifest);
  }, []);

  const handleReady = useCallback(() => {
    void syncSources();
  }, [syncSources]);

  return (
    <>
      {records
        .filter((record) => record.enabled)
        .map((record) => (
          <ExtensionRuntimeView
            key={`${record.id}:${record.updatedAt}`}
            record={record}
            onReady={handleReady}
          />
        ))}
      {probes.map((probe) => (
        <ExtensionProbeView key={probe.id} probe={probe} onDone={handleProbeDone} />
      ))}
    </>
  );
}

function ExtensionRuntimeView({
  record,
  onReady,
}: {
  record: ExtensionRecord;
  onReady: () => void;
}) {
  const [runtime] = useState(() => new ExtensionRuntime(record.id));

  useEffect(() => {
    setRuntime(record.id, runtime);
    runtime.load(record.code);

    let cancelled = false;
    runtime.ready
      .then(() => {
        if (!cancelled) onReady();
      })
      .catch((error) => {
        console.warn(`Extension "${record.id}" failed to load`, error);
      });

    return () => {
      cancelled = true;
      deleteRuntime(record.id);
    };
  }, [record.id, record.code, runtime, onReady]);

  return (
    <Sandbox
      onAttach={(webview) => runtime.attach(webview)}
      onMessage={(data) => runtime.handleMessage(data)}
    />
  );
}

function ExtensionProbeView({
  probe,
  onDone,
}: {
  probe: ProbeRequest;
  onDone: (id: string, manifest?: ExtensionManifest, error?: Error) => void;
}) {
  const [runtime] = useState(() => new ExtensionRuntime(`probe:${probe.id}`));

  useEffect(() => {
    runtime.load(probe.code);

    let cancelled = false;
    runtime.ready
      .then((manifest) => {
        if (!cancelled) onDone(probe.id, manifest);
      })
      .catch((error) => {
        if (!cancelled) onDone(probe.id, undefined, error as Error);
      });

    return () => {
      cancelled = true;
      runtime.dispose();
    };
  }, [probe.id, probe.code, runtime, onDone]);

  return (
    <Sandbox
      onAttach={(webview) => runtime.attach(webview)}
      onMessage={(data) => runtime.handleMessage(data)}
    />
  );
}

function Sandbox({
  onAttach,
  onMessage,
}: {
  onAttach: (webview: WebView | null) => void;
  onMessage: (data: string) => void;
}) {
  return (
    <WebView
      ref={(webview) => onAttach(webview)}
      source={{ html: EXTENSION_RUNNER_HTML }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      style={styles.hidden}
      containerStyle={styles.hidden}
    />
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});
