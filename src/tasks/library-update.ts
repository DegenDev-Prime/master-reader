import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { updateLibrary } from '@/services/library-updater';
import { useSettingsStore } from '@/stores/settings';

export const LIBRARY_UPDATE_TASK = 'master-reader-library-update';

const MINIMUM_INTERVAL_MINUTES = 6 * 60;

// Tasks must be defined at module scope so they are registered on every launch.
TaskManager.defineTask(LIBRARY_UPDATE_TASK, async () => {
  try {
    if (!useSettingsStore.getState().settings.checkForLibraryUpdates) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    await updateLibrary();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('Background library update failed', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerLibraryUpdateTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

    if (!(await TaskManager.isTaskRegisteredAsync(LIBRARY_UPDATE_TASK))) {
      await BackgroundTask.registerTaskAsync(LIBRARY_UPDATE_TASK, {
        minimumInterval: MINIMUM_INTERVAL_MINUTES,
      });
    }
  } catch (error) {
    console.warn('Could not register background update task', error);
  }
}

export async function unregisterLibraryUpdateTask(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(LIBRARY_UPDATE_TASK)) {
      await BackgroundTask.unregisterTaskAsync(LIBRARY_UPDATE_TASK);
    }
  } catch (error) {
    console.warn('Could not unregister background update task', error);
  }
}

export async function syncLibraryUpdateTask(enabled: boolean): Promise<void> {
  if (enabled) {
    await registerLibraryUpdateTask();
  } else {
    await unregisterLibraryUpdateTask();
  }
}
