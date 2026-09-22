import { z } from 'zod';

import type { SourceCapability } from '@/sources/types';

const capabilitySchema = z.enum(['popular', 'latest', 'search', 'tags', 'categories', 'auth']);

/**
 * Shape an extension returns from `registerSource(...)`. The host validates it
 * before persisting an installed extension.
 */
export const extensionManifestSchema = z.looseObject({
  id: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)+$/i, 'id must be a unique dotted identifier'),
  name: z.string().min(1),
  version: z.string().min(1),
  lang: z.string().min(2).default('en'),
  baseUrl: z.string().url(),
  capabilities: z.array(capabilitySchema).optional(),
  description: z.string().optional(),
  nsfw: z.boolean().optional(),
});

export type ExtensionManifest = {
  id: string;
  name: string;
  version: string;
  lang: string;
  baseUrl: string;
  capabilities: SourceCapability[];
  description?: string;
  nsfw?: boolean;
};

export type ExtensionRecord = {
  id: string;
  manifest: ExtensionManifest;
  code: string;
  enabled: boolean;
  sourceUrl: string | null;
  /** unix seconds */
  installedAt: number;
  /** unix seconds */
  updatedAt: number;
};

export class ExtensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtensionError';
  }
}

export function parseManifest(value: unknown): ExtensionManifest {
  const result = extensionManifestSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ExtensionError(
      `Invalid extension manifest${issue ? `: ${issue.path.join('.')} ${issue.message}` : ''}`,
    );
  }
  const data = result.data;
  return {
    id: data.id,
    name: data.name,
    version: data.version,
    lang: data.lang,
    baseUrl: data.baseUrl,
    capabilities: data.capabilities ?? ['popular', 'latest', 'search'],
    description: data.description,
    nsfw: data.nsfw,
  };
}

/** Only http(s) extension URLs are accepted. */
export function validateExtensionUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new ExtensionError('Enter a valid http(s) URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ExtensionError('Only http(s) URLs are supported.');
  }
  return parsed.toString();
}
