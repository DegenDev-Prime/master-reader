/// <reference types="node" />
import fs from 'fs';
import path from 'path';

/** Loads a recorded JSON payload from the top-level `fixtures/` directory. */
export function loadFixture<T = unknown>(name: string): T {
  const file = path.resolve(process.cwd(), 'fixtures', 'literotica', name);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}
