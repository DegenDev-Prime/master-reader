import { describe, expect, it } from 'vitest';

import { RequestQueue } from './queue';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('RequestQueue', () => {
  it('caps concurrency at maxConcurrent', async () => {
    const queue = new RequestQueue({ maxConcurrent: 2, minIntervalMs: 0, sleep: async () => {} });

    let active = 0;
    let maxActive = 0;
    const gates: (() => void)[] = [];

    const task = () =>
      new Promise<void>((resolve) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        gates.push(() => {
          active -= 1;
          resolve();
        });
      });

    const promises = [1, 2, 3, 4].map((n) => queue.schedule(async () => (await task(), n)));

    await flush();
    expect(gates).toHaveLength(2);
    expect(queue.pending).toBe(2);

    gates.shift()?.();
    await flush();
    expect(gates).toHaveLength(2);

    while (gates.length > 0) {
      gates.shift()?.();
      await flush();
    }

    const results = await Promise.all(promises);
    expect(results.sort()).toEqual([1, 2, 3, 4]);
    expect(maxActive).toBe(2);
  });

  it('spaces request starts by the minimum interval', async () => {
    const slept: number[] = [];
    let clock = 0;

    const queue = new RequestQueue({
      maxConcurrent: 1,
      minIntervalMs: 100,
      now: () => clock,
      sleep: async (ms) => {
        slept.push(ms);
        clock += ms;
      },
    });

    await queue.schedule(async () => {
      clock += 10;
    });
    await queue.schedule(async () => {
      clock += 10;
    });

    expect(slept).toEqual([90]);
  });

  it('releases the slot even when the task throws', async () => {
    const queue = new RequestQueue({ maxConcurrent: 1, minIntervalMs: 0, sleep: async () => {} });

    await expect(queue.schedule(async () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );

    await expect(queue.schedule(async () => 'ok')).resolves.toBe('ok');
  });
});
