export type RequestQueueOptions = {
  /** Maximum number of tasks allowed to run at once. */
  maxConcurrent?: number;
  /** Minimum spacing between the start of consecutive tasks, in milliseconds. */
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Serialises network work: caps concurrency and enforces a minimum interval
 * between request starts so a source is not hammered.
 */
export class RequestQueue {
  private readonly maxConcurrent: number;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  private available: number;
  private readonly waiting: (() => void)[] = [];
  private lastStart = Number.NEGATIVE_INFINITY;

  constructor(options: RequestQueueOptions = {}) {
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 3);
    this.minIntervalMs = Math.max(0, options.minIntervalMs ?? 0);
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.available = this.maxConcurrent;
  }

  get active(): number {
    return this.maxConcurrent - this.available;
  }

  get pending(): number {
    return this.waiting.length;
  }

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      const wait = this.minIntervalMs - (this.now() - this.lastStart);
      if (wait > 0) await this.sleep(wait);
      this.lastStart = this.now();
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
      return;
    }
    this.available = Math.min(this.maxConcurrent, this.available + 1);
  }
}
