import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing } from '@/constants/theme';

export type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <EmptyState
        icon="cloud-offline-outline"
        title={t('error.title')}
        message={message ?? t('error.message')}
        action={
          onRetry ? (
            <Button title={t('common.retry')} icon="refresh" onPress={onRetry} />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.four },
});
