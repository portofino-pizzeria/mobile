import { File, Paths } from 'expo-file-system';

// A tiny text key/value store, native half. `storage.web.ts` is the web half
// and uses localStorage — but localStorage does not exist on iOS/Android, and
// this app ships both, so the native side keeps one small file per key in the
// app's document directory (document, not cache: an offline menu that the OS
// may evict under storage pressure is not an offline menu). `kitchen.ts` and
// `admin.ts` both keep their staff/owner credential here for the same reason.
//
// Every operation is best-effort. Persistence here is a convenience, never a
// correctness dependency, so a failure reads as "nothing stored" instead of
// propagating an error into a screen.

function fileFor(key: string): File {
  return new File(Paths.document, `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
}

export async function readStoredText(key: string): Promise<string | null> {
  try {
    const file = fileFor(key);
    if (!file.exists) return null;
    return await file.text();
  } catch {
    return null;
  }
}

export function removeStoredText(key: string): Promise<void> {
  try {
    const file = fileFor(key);
    if (file.exists) file.delete();
  } catch {
    // Best-effort, like every operation here.
  }
  return Promise.resolve();
}

export function writeStoredText(key: string, value: string): Promise<void> {
  try {
    const file = fileFor(key);
    if (!file.exists) file.create({ intermediates: true });
    file.write(value);
  } catch {
    // Best-effort: a menu we could not cache simply is not cached.
  }
  return Promise.resolve();
}
