import { Directory, File, Paths } from 'expo-file-system';

import { getSherpaTtsModule } from './native/sherpa-tts';
import type { VoicePackDef } from './voice-packs';

export type VoicePackStatus =
  { state: 'missing' } | { state: 'ready'; bytes: number } | { state: 'partial' };

export type PackDownloadProgress = { received: number; total: number | null };

export function voicePackDir(id: string): string {
  return `${Paths.document.uri}narration/voices/${id}/`;
}

/** True when the directory holds a complete pack (model + tokens). */
function isComplete(dir: Directory): boolean {
  let hasOnnx = false;
  let hasTokens = false;
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue;
    const name = entry.name.toLowerCase();
    if (name.endsWith('.onnx')) hasOnnx = true;
    if (name === 'tokens.txt') hasTokens = true;
  }
  return hasOnnx && hasTokens;
}

/** Resolves the extracted directory holding the model (tarballs nest one level). */
export function resolveInstalledModelDir(def: VoicePackDef): Directory | null {
  const dir = new Directory(voicePackDir(def.id));
  if (!dir.exists) return null;
  if (isComplete(dir)) return dir;
  for (const entry of dir.list()) {
    if (entry instanceof Directory && isComplete(entry)) return entry;
  }
  return null;
}

/** Inspects an installed pack without trusting partial downloads. */
export async function voicePackStatus(def: VoicePackDef): Promise<VoicePackStatus> {
  const dir = resolveInstalledModelDir(def);
  if (!dir) return await missingOrPartial(def);
  return { state: 'ready', bytes: installedPackBytes(dir) };
}

async function missingOrPartial(def: VoicePackDef): Promise<VoicePackStatus> {
  return new Directory(voicePackDir(def.id)).exists ? { state: 'partial' } : { state: 'missing' };
}

function installedPackBytes(dir: Directory): number {
  let total = 0;
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue;
    const name = entry.name.toLowerCase();
    if (name.endsWith('.onnx') || name === 'tokens.txt' || name === 'voices.bin') {
      total += entry.size;
    }
  }
  return total;
}

/** Downloads a voice-pack tarball to a temp file, reporting progress. */
export async function downloadVoicePack(
  def: VoicePackDef,
  onProgress?: (progress: PackDownloadProgress) => void,
): Promise<File> {
  const dir = new Directory(voicePackDir(def.id));
  dir.create({ intermediates: true, idempotent: true });
  const tmp = new File(dir, 'pack.tar.bz2');
  if (tmp.exists) tmp.delete();
  const file = await File.downloadFileAsync(def.url, tmp, {
    idempotent: true,
    onProgress: onProgress
      ? ({ bytesWritten, totalBytes }) =>
          onProgress({ received: bytesWritten, total: totalBytes >= 0 ? totalBytes : null })
      : undefined,
  });
  if (!file.exists) throw new Error('Voice pack download failed.');
  return file;
}

/** Removes a downloaded pack and its extracted files. */
export function deleteVoicePack(id: string): void {
  const dir = new Directory(voicePackDir(id));
  if (dir.exists) dir.delete();
}

/**
 * Full install pipeline: download the tarball, extract it with the native
 * module, verify model.onnx landed, then clean up the archive.
 */
export async function installVoicePack(
  def: VoicePackDef,
  onProgress?: (progress: PackDownloadProgress) => void,
): Promise<void> {
  const module = getSherpaTtsModule();
  if (!module) throw new Error('Neural narration is not available in this build.');
  const tmp = await downloadVoicePack(def, onProgress);
  try {
    const dir = new Directory(voicePackDir(def.id));
    await module.extractTarBz2(tmp.uri, dir.uri);
    if (!resolveInstalledModelDir(def)) {
      throw new Error('Voice pack is incomplete after extraction.');
    }
  } finally {
    if (tmp.exists) tmp.delete();
  }
}
