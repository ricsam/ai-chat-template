import { auth } from "./auth";
import { router } from "./router";
import { handleChatStream } from "./chat-stream";
import { handleResumeStream } from "./chat-resume";
import { handleCompletion } from "./completion";

serve({
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle Better Auth routes (/api/auth/* - local server strips /api prefix)
    if (url.pathname.startsWith("/auth/")) {
      return auth.handler(request);
    }

    // Handle streaming chat endpoint (useChat POST)
    // Note: /chat routes are separate from RPC routes
    if (url.pathname === "/chat" && request.method === "POST") {
      return handleChatStream(request);
    }

    // Handle stream resume endpoint (useChat GET with resume: true)
    // Pattern: /chat/{id}/stream
    const streamMatch = url.pathname.match(/^\/chat\/([^/]+)\/stream$/);
    if (streamMatch?.[1] && request.method === "GET") {
      return handleResumeStream(request, streamMatch[1]);
    }

    // Handle completion endpoint (useCompletion)
    if (url.pathname === "/chat/completion" && request.method === "POST") {
      return handleCompletion(request);
    }

    // Handle RPC routes (all other routes go to router)
    // The serve script strips the /api prefix, so paths come in as /conversations, /models, etc.
    return router.handle(request);
  },
});
