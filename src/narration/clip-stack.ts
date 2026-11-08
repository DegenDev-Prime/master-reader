import type { SpeechChunk } from './chunker';
import { estimateDurationMs } from './player-estimates';

/**
 * One speech chunk and the generated clip that speaks it. The text spine is
 * append-only; clips are 1:1 with chunks so a clip can never point at another
 * chunk. All functions here are pure.
 */
export type ClipPhase = 'pending' | 'synthesizing' | 'ready' | 'failed' | 'dead';

export type ClipAudio = {
  uri: string;
  /** Exact duration at 1x, when the synthesizer knows it. */
  durationMs?: number | null;
};

export type ClipEntry = {
  index: number;
  chunkId: string;
  phase: ClipPhase;
  audio?: ClipAudio;
  attempts: number;
  error?: string | null;
};

export type ClipStack = {
  sessionId: number;
  chunks: readonly SpeechChunk[];
  clips: readonly ClipEntry[];
};

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 400,
  maxDelayMs: 5_000,
};

export const DEFAULT_LOOKAHEAD = 2;

function createClip(chunk: SpeechChunk, index: number): ClipEntry {
  return { index, chunkId: chunk.id, phase: 'pending', attempts: 0, error: null };
}

export function createClipStack(sessionId: number, chunks: readonly SpeechChunk[]): ClipStack {
  return {
    sessionId,
    chunks,
    clips: chunks.map(createClip),
  };
}

/** Appends new chunks while keeping every existing clip index stable. */
export function appendChunks(stack: ClipStack, chunks: readonly SpeechChunk[]): ClipStack {
  if (chunks.length === 0) return stack;
  const start = stack.chunks.length;
  return {
    sessionId: stack.sessionId,
    chunks: [...stack.chunks, ...chunks],
    clips: [...stack.clips, ...chunks.map((chunk, offset) => createClip(chunk, start + offset))],
  };
}

export function clipAt(stack: ClipStack, index: number): ClipEntry | null {
  return stack.clips[index] ?? null;
}

function withPhase(stack: ClipStack, index: number, patch: Partial<ClipEntry>): ClipStack {
  const current = stack.clips[index];
  if (!current) return stack;
  const clips = stack.clips.slice();
  clips[index] = { ...current, ...patch };
  return { ...stack, clips };
}

export function markSynthesizing(stack: ClipStack, index: number): ClipStack {
  return withPhase(stack, index, { phase: 'synthesizing', error: null });
}

export function markReady(stack: ClipStack, index: number, audio: ClipAudio): ClipStack {
  return withPhase(stack, index, { phase: 'ready', audio, error: null });
}

/**
 * Records one failed attempt. A clip that is out of attempts becomes `dead`
 * and the cursor will skip it; otherwise it stays `failed` until the worker
 * waits out the backoff and marks it pending again.
 */
export function recordFailure(
  stack: ClipStack,
  index: number,
  error: string,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): ClipStack {
  const current = stack.clips[index];
  if (!current) return stack;
  const attempts = current.attempts + 1;
  return withPhase(stack, index, {
    attempts,
    error,
    phase: attempts >= policy.maxAttempts ? 'dead' : 'failed',
  });
}

export function markDead(stack: ClipStack, index: number): ClipStack {
  return withPhase(stack, index, { phase: 'dead' });
}

export function markPending(stack: ClipStack, index: number): ClipStack {
  const current = stack.clips[index];
  if (!current || current.phase === 'dead' || current.phase === 'ready') return stack;
  return withPhase(stack, index, { phase: 'pending', error: null });
}

/** Explicit user retry: a dead clip gets a fresh attempt budget. */
export function resetClip(stack: ClipStack, index: number): ClipStack {
  return withPhase(stack, index, {
    phase: 'pending',
    attempts: 0,
    error: null,
    audio: undefined,
  });
}

export function shouldRetry(attempts: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  return attempts < policy.maxAttempts;
}

/** Exponential backoff, capped. Attempt 1 waits baseDelay. */
export function retryDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const steps = Math.max(0, Math.floor(attempt) - 1);
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** steps);
}

/**
 * Indices the worker should fill next: the playhead first, then the clips
 * ahead of it. Ready, in-flight and dead clips are not re-queued.
 */
export function planPrefetch(
  stack: ClipStack,
  playIndex: number,
  ahead: number = DEFAULT_LOOKAHEAD,
): number[] {
  const start = Math.max(0, Math.floor(playIndex));
  const end = Math.min(stack.clips.length - 1, start + Math.max(0, ahead));
  const indices: number[] = [];
  for (let index = start; index <= end; index += 1) {
    const clip = stack.clips[index];
    if (clip.phase === 'pending' || clip.phase === 'failed') indices.push(index);
  }
  return indices;
}

/** Closest index in `direction` that is not permanently failed. */
export function nextPlayableIndex(
  stack: ClipStack,
  from: number,
  direction: 1 | -1 = 1,
): number | null {
  if (stack.clips.length === 0) return null;
  let index = Math.min(Math.max(0, Math.floor(from)), stack.clips.length - 1);
  while (index >= 0 && index < stack.clips.length) {
    if (stack.clips[index].phase !== 'dead') return index;
    index += direction;
  }
  return null;
}

export function hasPlayableClip(stack: ClipStack): boolean {
  return stack.clips.some((clip) => clip.phase !== 'dead');
}

/** Exact duration when known, otherwise the text estimate at the given speed. */
export function clipDurationMs(stack: ClipStack, index: number, speed = 1): number {
  const clip = stack.clips[index];
  const chunk = stack.chunks[index];
  if (!clip || !chunk) return 0;
  if (clip.audio?.durationMs != null && clip.audio.durationMs > 0) {
    return clip.audio.durationMs / Math.max(0.25, speed);
  }
  return estimateDurationMs(chunk.text, speed);
}

/** Start time of every clip on the session timeline. */
export function clipOffsetsMs(stack: ClipStack, speed = 1): number[] {
  const offsets: number[] = [];
  let elapsed = 0;
  for (let index = 0; index < stack.clips.length; index += 1) {
    offsets.push(elapsed);
    elapsed += clipDurationMs(stack, index, speed);
  }
  return offsets;
}

export function totalDurationMs(stack: ClipStack, speed = 1): number {
  return (
    clipDurationMs(stack, stack.clips.length - 1, speed) + (clipOffsetsMs(stack, speed).at(-1) ?? 0)
  );
}

export type ClipPosition = { index: number; intoMs: number };

export function positionMs(stack: ClipStack, index: number, intoMs = 0, speed = 1): number {
  const offsets = clipOffsetsMs(stack, speed);
  if (stack.clips.length === 0) return 0;
  const clamped = Math.min(Math.max(0, Math.floor(index)), stack.clips.length - 1);
  return (offsets[clamped] ?? 0) + Math.max(0, intoMs);
}

/** Moves by a signed number of milliseconds, crossing clip boundaries both ways. */
export function seekByMs(
  stack: ClipStack,
  index: number,
  intoMs: number,
  deltaMs: number,
  speed = 1,
): ClipPosition {
  if (stack.clips.length === 0) return { index: 0, intoMs: 0 };
  const clamped = Math.min(Math.max(0, Math.floor(index)), stack.clips.length - 1);
  const target = Math.min(
    totalDurationMs(stack, speed),
    Math.max(0, positionMs(stack, clamped, intoMs, speed) + deltaMs),
  );
  const offsets = clipOffsetsMs(stack, speed);
  for (let position = offsets.length - 1; position >= 0; position -= 1) {
    if (target >= offsets[position]) {
      return {
        index: position,
        intoMs: Math.max(0, target - offsets[position]),
      };
    }
  }
  return { index: 0, intoMs: 0 };
}

export function clipIndexAtMs(stack: ClipStack, position: number, speed = 1): number {
  if (stack.clips.length === 0) return 0;
  const offsets = clipOffsetsMs(stack, speed);
  const clamped = Math.max(0, position);
  for (let index = offsets.length - 1; index >= 0; index -= 1) {
    if (clamped >= offsets[index]) return index;
  }
  return 0;
}
