import { router, useNavigation } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useCallback } from 'react';

import { buildHref, findTargetInTree, type NavigationNode, type RouteTarget } from './parent';

/**
 * Navigation between the app's screens.
 *
 * The root stack is a tree, and every screen below the tab bar has one parent:
 *
 *   (tabs)/index              library
 *   (tabs)/browse             browse
 *   (tabs)/audio              audio
 *   (tabs)/more               more
 *   search                     library
 *   story/[sourceId]/[id]      story
 *   chapters/[sourceId]/[id]   story
 *   reader/.../[chapterId]     chapters
 *   history                    more
 *   downloads                  more
 *   downloads/series/[id]      downloads
 *   sources                    more
 *   settings                   more
 *   settings/...               settings
 *   restore                    settings/backup
 *   export                     settings/backup
 *   pronunciation              settings/narration
 *
 * Two rules keep the stack honest:
 *
 *   Opening a screen that is already on the stack unwinds to it instead of
 *   pushing a second copy, so a button pressed twice does not need two back
 *   presses to undo.
 *
 *   A back button returns to the screen's parent route. When the parent is
 *   not on the stack the gesture steps back normally, so the user always
 *   lands somewhere they recognise.
 */

function href(target: RouteTarget): RelativePathString {
  return buildHref(target) as RelativePathString;
}

/**
 * Opens a screen.
 *
 * When the screen is already on the stack the stack unwinds to it, so the
 * screen never appears twice. Otherwise it is pushed, keeping the current
 * screen underneath it.
 */
export function useOpenTarget() {
  const navigation = useNavigation() as unknown as NavigationNode;

  return useCallback(
    (target: RouteTarget) => {
      if (findTargetInTree(navigation, target)) {
        router.dismissTo(href(target));
        return;
      }
      router.push(href(target));
    },
    [navigation],
  );
}

/**
 * Goes back to a parent route.
 *
 * When the parent is on the stack the stack unwinds to it; when it is not the
 * gesture steps back normally, so the user returns to wherever they came from
 * rather than to an unexpected screen.
 */
export function useBackToParent() {
  const navigation = useNavigation() as unknown as NavigationNode;

  return useCallback(
    (target: RouteTarget) => {
      if (findTargetInTree(navigation, target)) {
        router.dismissTo(href(target));
        return;
      }
      if (router.canGoBack()) {
        router.back();
        return;
      }
      // Opened from a link, so there is no history to step back through; the
      // parent is still the right destination.
      router.navigate(href(target));
    },
    [navigation],
  );
}

/** Replaces the current screen with another. */
export function replaceWith(target: RouteTarget): void {
  router.replace(href(target));
}
