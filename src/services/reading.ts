import { libraryRepository, progressRepository, historyRepository } from '@/db/repositories';
import type { ReadingProgress } from '@/models/story';
import { clampPageIndex } from '@/utils/reading-position';

export {
  clampPageIndex,
  nextPageIndex,
  previousPageIndex,
  progressPercent,
} from '@/utils/reading-position';

export async function loadProgress(
  sourceId: string,
  storyId: string,
): Promise<ReadingProgress | null> {
  return progressRepository.get(sourceId, storyId);
}

export type SaveReadingProgressInput = {
  sourceId: string;
  storyId: string;
  pageIndex: number;
  pageCount: number;
};

export async function saveReadingProgress(input: SaveReadingProgressInput): Promise<void> {
  await progressRepository.save({
    sourceId: input.sourceId,
    storyId: input.storyId,
    pageIndex: clampPageIndex(input.pageIndex, input.pageCount),
    pageCount: input.pageCount,
  });
  await libraryRepository.touch(input.sourceId, input.storyId);
}

export async function recordHistory(
  sourceId: string,
  storyId: string,
  pageIndex: number,
  durationMs?: number,
): Promise<void> {
  await historyRepository.record({ sourceId, storyId, pageIndex, durationMs });
}
