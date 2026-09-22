import { createLiteroticaSource } from './literotica';
import type { Source } from './types';

export class SourceRegistry {
  private readonly sources = new Map<string, Source>();

  register(source: Source): void {
    this.sources.set(source.info.id, source);
  }

  get(id: string): Source | undefined {
    return this.sources.get(id);
  }

  require(id: string): Source {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Unknown source: ${id}`);
    return source;
  }

  list(): Source[] {
    return [...this.sources.values()];
  }
}

/** Creates a registry with the built-in sources registered. */
export function createSourceRegistry(): SourceRegistry {
  const registry = new SourceRegistry();
  registry.register(createLiteroticaSource());
  return registry;
}
