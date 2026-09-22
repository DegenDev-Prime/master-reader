import { FlashList } from '@shopify/flash-list';
import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { StoryListItem } from '@/components/story-list-item';
import { LoadingView } from '@/components/ui/loading';
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
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
};

export function StoryList({
  stories,
  onPressStory,
  isUnread,
  onEndReached,
  isFetchingNextPage,
  isRefreshing,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
}: StoryListProps) {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      <FlashList
        data={stories}
        keyExtractor={(item) => `${item.sourceId}:${item.id}`}
        renderItem={({ item }) => (
          <StoryListItem
            story={item}
            unread={isUnread?.(item)}
            onPress={() => onPressStory(item)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={isFetchingNextPage ? <LoadingView /> : null}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
});
