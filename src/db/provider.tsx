import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { runAutoBackupIfDue } from '@/services/backup';
import { pruneExpiredCaches } from '@/services/cache';
import { useSettingsStore } from '@/stores/settings';

import { initDatabase } from './client';

type Status = 'loading' | 'ready' | 'error';

/**
 * Boots the database and hydrates the settings store before rendering children.
 * While loading it renders nothing so the native splash screen stays visible.
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await initDatabase();
        await useSettingsStore.getState().hydrate();
        if (!cancelled) setStatus('ready');

        // Reclaim space from stale cache entries without blocking startup.
        void pruneExpiredCaches().catch((error) => console.warn('Cache prune failed', error));

        // Run a scheduled auto-backup in the background when due.
        void runAutoBackupIfDue().catch((error) => console.warn('Auto backup failed', error));
      } catch (error) {
        console.error('Database initialisation failed', error);
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : String(error));
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') return null;
  if (status === 'error') return <DatabaseError message={message} />;
  return <>{children}</>;
}

function DatabaseError({ message }: { message: string | null }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Database error</Text>
      <Text style={styles.body}>
        Master Reader could not open its local database. Reinstalling the app usually resolves this.
      </Text>
      {message ? <Text style={styles.detail}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#101014',
    gap: 12,
  },
  title: {
    color: '#FAFAFA',
    fontSize: 20,
    fontWeight: '600',
  },
  body: {
    color: '#B0B4BA',
    fontSize: 15,
    textAlign: 'center',
  },
  detail: {
    color: '#7C8189',
    fontSize: 12,
    textAlign: 'center',
  },
});
