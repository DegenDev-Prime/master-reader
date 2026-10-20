import { FlashList } from '@shopify/flash-list';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { StoryListItem } from '@/components/story-list-item';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Story } from '@/models/story';

export type StoryListProps = {
  stories: Story[];
  onPressStory: (story: Story) => void;
  isUnread?: (story: Story) => boolean;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  /** `undefined` hides the end-of-results marker. */
  hasMore?: boolean;
  /** A page fetch failed after the first page. Takes precedence over loading. */
  footerError?: boolean;
  onRetryMore?: () => void;
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
};

type FooterKind = 'loading' | 'error' | 'end';

export function StoryList({
  stories,
  onPressStory,
  isUnread,
  onEndReached,
  isFetchingNextPage,
  isRefreshing,
  onRefresh,
  hasMore,
  footerError,
  onRetryMore,
  ListHeaderComponent,
  ListEmptyComponent,
}: StoryListProps) {
  const footer = pickFooter({ hasMore, footerError, isFetchingNextPage, count: stories.length });

  const pressRef = useRef(onPressStory);
  useEffect(() => {
    pressRef.current = onPressStory;
  }, [onPressStory]);
  const handlePress = useCallback((story: Story) => pressRef.current(story), []);

  const renderItem = useCallback(
    ({ item }: { item: Story }) => (
      <StoryListItem story={item} unread={isUnread?.(item)} onPress={handlePress} />
    ),
    [isUnread, handlePress],
  );

  return (
    <View style={styles.root}>
      <FlashList
        data={stories}
        keyExtractor={(item) => `${item.sourceId}:${item.id}`}
        renderItem={renderItem}
        ItemSeparatorComponent={RowSeparator}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={footer ? <ListFooter kind={footer} onRetry={onRetryMore} /> : null}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

function RowSeparator() {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.border }]} />;
}

function pickFooter({
  hasMore,
  footerError,
  isFetchingNextPage,
  count,
}: {
  hasMore?: boolean;
  footerError?: boolean;
  isFetchingNextPage?: boolean;
  count: number;
}): FooterKind | null {
  if (footerError) return 'error';
  if (isFetchingNextPage) return 'loading';
  if (hasMore === false && count > 0) return 'end';
  return null;
}

function ListFooter({ kind, onRetry }: { kind: FooterKind; onRetry?: () => void }) {
  const theme = useTheme();

  if (kind === 'loading') {
    return (
      <View style={styles.footer} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  if (kind === 'error') {
    return (
      <View style={styles.footer} accessibilityLiveRegion="polite">
        <ThemedText type="small" themeColor="textSecondary">
          {t('browse.listError')}
        </ThemedText>
        <Button variant="ghost" title={t('common.retry')} onPress={onRetry} />
      </View>
    );
  }

  return (
    <View style={styles.footer} accessibilityLiveRegion="polite">
      <ThemedText type="small" themeColor="textMuted">
        {t('browse.endOfResults')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
