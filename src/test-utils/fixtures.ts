/// <reference types="node" />
import fs from 'fs';
import path from 'path';

/** Loads a recorded JSON payload from `fixtures/<provider>/`. */
export function loadFixture<T = unknown>(name: string, provider = 'literotica'): T {
  const file = path.resolve(process.cwd(), 'fixtures', provider, name);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** Loads a recorded text/HTML payload from `fixtures/<provider>/`. */
export function loadTextFixture(name: string, provider: string): string {
  const file = path.resolve(process.cwd(), 'fixtures', provider, name);
  return fs.readFileSync(file, 'utf8');
}
