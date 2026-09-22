import { describe, expect, it } from 'vitest';

import {
  parseHostToRunner,
  parseRunnerToHost,
  serializeMessage,
  type HostToRunner,
  type RunnerToHost,
} from './protocol';

describe('protocol', () => {
  it('round-trips host messages', () => {
    const message: HostToRunner = { type: 'load', code: 'registerSource({})' };
    expect(parseHostToRunner(serializeMessage(message))).toEqual(message);
  });

  it('parses runner messages', () => {
    const parsed = parseRunnerToHost(serializeMessage({ type: 'ready' }));
    expect(parsed).toEqual({ type: 'ready' });
  });

  it('parses an http bridge request', () => {
    const parsed = parseRunnerToHost(
      serializeMessage({ type: 'http', id: 'h1', request: { url: 'https://example.com' } }),
    );
    expect(parsed).toEqual({
      type: 'http',
      id: 'h1',
      request: { url: 'https://example.com' },
    });
  });

  it('rejects unknown or malformed messages', () => {
    expect(parseRunnerToHost('not json')).toBeNull();
    expect(
      parseRunnerToHost(serializeMessage({ type: 'nope' } as unknown as RunnerToHost)),
    ).toBeNull();
    expect(
      parseHostToRunner(
        serializeMessage({ type: 'result', id: '1', ok: true } as unknown as RunnerToHost),
      ),
    ).toBeNull();
  });
});
