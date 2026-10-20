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
 * A back button must land on that parent, and a button that jumps to a parent
 * must not push a second copy of it. Pushing the chapter list from the reader
 * — which already sits on top of the chapter list — leaves two copies in the
 * stack, so the user needs two back presses to get out and the next tap on the
 * same button pushes a third.
 *
 * The helpers here are pure so they can be tested without a router; the
 * imperative navigation lives in `use-parent-back`.
 */

/** A route and the values for its dynamic segments. */
export type RouteTarget = {
  /** Route path, with dynamic segments written as `[param]`. */
  pathname: string;
  /** Values for the dynamic segments, keyed by parameter name. */
  params?: Record<string, string | undefined>;
};

export type StackRoute = {
  key?: string;
  name?: string;
  params?: Record<string, string | undefined>;
};

/** Fills a route's dynamic segments with their values. */
export function buildHref(target: RouteTarget): string {
  let href = target.pathname;
  for (const [key, value] of Object.entries(target.params ?? {})) {
    if (value == null) continue;
    href = href.replace(`[${key}]`, encodeURIComponent(value));
  }
  return href;
}

/** The route name expo-router uses for a path, e.g. `chapters/[sourceId]/[id]`. */
export function routeName(pathname: string): string {
  return pathname.split('/').filter(Boolean).join('/');
}

/**
 * Whether a route is already on the stack, with the same dynamic values.
 * The current screen never counts: navigating to it would be a no-op.
 */
export function isTargetOnStack(
  routes: readonly StackRoute[],
  target: RouteTarget,
  currentKey?: string,
): boolean {
  const name = routeName(target.pathname);
  return routes.some((route) => {
    if (route.key != null && route.key === currentKey) return false;
    if ((route.name ?? '') !== name) return false;
    return Object.entries(target.params ?? {}).every(([key, value]) => {
      if (value == null) return true;
      return route.params?.[key] === value;
    });
  });
}

export type NavigationNode = {
  getState: () => { routes?: readonly StackRoute[]; index?: number } | undefined;
  getParent: () => NavigationNode | undefined;
};

/**
 * Whether a route is on the stack of any navigator in the tree.
 *
 * The app's screens live in the root stack, but a screen inside the tab bar
 * only sees the tab navigator, so the whole tree is searched.
 */
export function findTargetInTree(node: NavigationNode | undefined, target: RouteTarget): boolean {
  let current = node;
  while (current) {
    const state = current.getState();
    const routes = state?.routes;
    if (routes) {
      const currentKey = state?.index != null ? routes[state.index]?.key : undefined;
      if (isTargetOnStack(routes, target, currentKey)) return true;
    }
    current = current.getParent();
  }
  return false;
}
