/** Keeps the first card when a provider returns several works of one series. */
export function uniqueById<T extends { sourceId: string; id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sourceId}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
