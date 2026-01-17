// Chat Resume - Resume active stream endpoint
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { getConversation } from "./chat-store";
import { resumeStream } from "./stream-store";
import { authenticateRequest } from "./auth";

// GET /chat/:id/stream - Resume active stream endpoint
export async function handleResumeStream(
  request: Request,
  chatId: string
): Promise<Response> {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Load conversation to get active stream ID
  const convo = await getConversation(chatId);
  if (!convo || convo.userId !== auth.userId) {
    return new Response("Conversation not found", { status: 404 });
  }

  // Check if there's an active stream
  if (!convo.activeStreamId) {
    // Return 204 No Content when there's no active stream
    return new Response(null, { status: 204 });
  }

  // Resume the stream from stored chunks
  const stream = await resumeStream(convo.activeStreamId);
  if (!stream) {
    // Stream file not found, clear the stale reference
    return new Response(null, { status: 204 });
  }

  return new Response(stream, {
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}
