import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppBar } from '@/components/ui/app-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingView } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { StoryList } from '@/components/story-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuthorPage } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { useOpenStory } from '@/navigation/routes';
import { formatCount } from '@/utils/format';
import { uniqueById } from '@/utils/unique-by-id';

export default function AuthorScreen() {
  const { sourceId, id } = useLocalSearchParams<{ sourceId: string; id: string }>();
  const theme = useTheme();
  const query = useAuthorPage(sourceId ?? '', id ?? '');
  const openStory = useOpenStory();

  const author = query.data?.pages[0]?.author ?? null;
  const stories = useMemo(
    () => uniqueById(query.data?.pages.flatMap((page) => page?.stories.items ?? []) ?? []),
    [query.data],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  }, []);

  const stats = author
    ? [
        author.worksCount != null ? t('author.works', { count: author.worksCount }) : null,
        author.followers != null ? t('author.followers', { count: author.followers }) : null,
        author.wordCount != null
          ? t('author.words', { count: formatCount(author.wordCount) ?? author.wordCount })
          : null,
      ].filter(Boolean)
    : [];

  if (query.isLoading && !author) {
    return (
      <Screen>
        <AppBar title={t('author.title')} onBack={goBack} />
        <LoadingView label={t('common.loading')} />
      </Screen>
    );
  }

  if (query.isError && !author) {
    return (
      <Screen>
        <AppBar title={t('author.title')} onBack={goBack} />
        <ErrorState
          title={t('author.errorTitle')}
          message={t('author.errorMessage')}
          onRetry={() => void query.refetch()}
        />
      </Screen>
    );
  }

  if (!author) {
    return (
      <Screen>
        <AppBar title={t('author.title')} onBack={goBack} />
        <EmptyState
          icon="person-outline"
          title={t('author.emptyTitle')}
          message={t('author.emptyMessage')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={author.name} onBack={goBack} />
      <View style={styles.root}>
        <StoryList
          stories={stories}
          onPressStory={openStory}
          hasMore={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListHeaderComponent={
            <View style={styles.profile}>
              <View style={styles.identity}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}
                >
                  {author.avatarUrl ? (
                    <Image
                      source={{ uri: author.avatarUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <ThemedText type="title2" themeColor="textMuted">
                      {author.name.slice(0, 1).toUpperCase()}
                    </ThemedText>
                  )}
                </View>
                <View style={styles.identityText}>
                  <ThemedText type="title2" numberOfLines={2}>
                    {author.name}
                  </ThemedText>
                  {stats.length > 0 ? (
                    <ThemedText type="small" themeColor="textMuted">
                      {stats.join(' · ')}
                    </ThemedText>
                  ) : null}
                  {author.url ? (
                    <Pressable
                      onPress={() => void Linking.openURL(author.url ?? '')}
                      accessibilityRole="link"
                      accessibilityLabel={t('author.openWeb')}
                      style={styles.webLink}
                    >
                      <Ionicons name="open-outline" size={15} color={theme.primary} />
                      <ThemedText type="smallBold" themeColor="primary">
                        {t('author.openWeb')}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {author.bio ? (
                <ThemedText type="default" themeColor="textSecondary" style={styles.bio}>
                  {author.bio}
                </ThemedText>
              ) : null}

              <ThemedText type="eyebrow" style={styles.sectionLabel}>
                {t('author.worksTitle')}
              </ThemedText>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title={t('author.noWorksTitle')}
              message={t('author.noWorksMessage')}
            />
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  profile: { gap: Spacing.three, padding: Spacing.three },
  identity: { flexDirection: 'row', gap: Spacing.three },
  avatar: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 88,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 88,
  },
  identityText: { flex: 1, gap: Spacing.one, paddingTop: Spacing.one },
  webLink: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, minHeight: 32 },
  bio: { lineHeight: 23 },
  sectionLabel: { paddingTop: Spacing.one },
});
