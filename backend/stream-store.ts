// Stream Store - File-based storage for resumable streams using OPFS
import { readJsonFile } from "./storage";

// Store for tracking active stream writers
const activeStreams = new Map<string, WritableStreamDefaultWriter<Uint8Array>>();

// Create a resumable stream by writing chunks to a file
// The stream from consumeSseStream is a ReadableStream<string>
export async function createResumableStream(
  chatId: string,
  streamId: string,
  stream: ReadableStream<string>
): Promise<void> {
  const root = await getDirectory("/data");
  const streamsDir = await root.getDirectoryHandle("streams", { create: true });
  const fileHandle = await streamsDir.getFileHandle(`${streamId}.ndjson`, { create: true });
  const writable = await fileHandle.createWritable();
  const writer = writable.getWriter();

  // Track this stream
  activeStreams.set(streamId, writer);

  // Read from source stream and write to file
  const reader = stream.getReader();
  const encoder = new TextEncoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Write string chunk as a line (base64 encoded to preserve content)
      const base64Chunk = btoa(value);
      await writer.write(encoder.encode(base64Chunk + "\n"));
    }
  } finally {
    activeStreams.delete(streamId);
    await writer.close();
  }
}

// Resume a stream from stored chunks
export async function resumeStream(
  streamId: string
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const root = await getDirectory("/data");
    const streamsDir = await root.getDirectoryHandle("streams", { create: false });
    const fileHandle = await streamsDir.getFileHandle(`${streamId}.ndjson`, {
      create: false,
    });
    const file = await fileHandle.getFile();
    const text = await file.text();

    if (!text) return null;

    // Parse stored chunks and create a new stream
    const lines = text.trim().split("\n").filter(Boolean);
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of lines) {
          // Decode base64 string chunk and re-encode as bytes
          const decoded = atob(line);
          controller.enqueue(encoder.encode(decoded));
        }
        controller.close();
      },
    });
  } catch {
    return null;
  }
}

// Delete stream file after completion
export async function deleteStreamFile(chatId: string): Promise<void> {
  const convo = await readJsonFile<{ activeStreamId: string | null }>(
    `conversations/${chatId}.json`
  );
  if (!convo?.activeStreamId) return;

  try {
    const root = await getDirectory("/data");
    const streamsDir = await root.getDirectoryHandle("streams", { create: false });
    await streamsDir.removeEntry(`${convo.activeStreamId}.ndjson`);
  } catch {
    // File doesn't exist, ignore
  }
}
