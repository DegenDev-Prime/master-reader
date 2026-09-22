let counter = 0;

/**
 * Generates a locally-unique identifier. Not cryptographically secure; suitable
 * for primary keys of locally created rows (history records, library categories).
 */
export function createId(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${random}`;
}
