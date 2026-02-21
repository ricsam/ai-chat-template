// File Storage Helpers using OPFS (Origin Private File System)
// `fs` is a global provided by the isolate runtime

// Helper to get or create a directory recursively
async function getOrCreateDir(
  root: FileSystemDirectoryHandle,
  pathParts: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const part of pathParts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

// Read JSON file from OPFS
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const root = await getDirectory("/data");
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: false });
    }

    const fileHandle = await dir.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Write JSON file to OPFS
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const root = await getDirectory("/data");
  const parts = filePath.split("/").filter(Boolean);
  const fileName = parts.pop()!;

  const dir = parts.length > 0
    ? await getOrCreateDir(root, parts)
    : root;

  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

// Delete JSON file from OPFS
export async function deleteJsonFile(filePath: string): Promise<void> {
  try {
    const root = await getDirectory("/data");
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: false });
    }

    await dir.removeEntry(fileName);
  } catch {
    // File doesn't exist, ignore
  }
}
