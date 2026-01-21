import { auth } from "./auth";
import { router } from "./router";
import { handleChatStream } from "./chat-stream";
import { handleResumeStream } from "./chat-resume";
import { handleCompletion } from "./completion";
import { handleDocumentUpload } from "./knowledge-base-upload";

serve({
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle Better Auth routes (/auth/* - local server strips /api prefix)
    if (url.pathname.startsWith("/api/auth/")) {
      console.log("auth.handler(request)", url.pathname);
      return auth.handler(request);
    }

    // Handle streaming chat endpoint (useChat POST)
    // Note: /chat routes are separate from RPC routes
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatStream(request);
    }

    // Handle stream resume endpoint (useChat GET with resume: true)
    // Pattern: /api/chat/{id}/stream
    const streamMatch = url.pathname.match(/^\/api\/chat\/([^/]+)\/stream$/);
    if (streamMatch?.[1] && request.method === "GET") {
      return handleResumeStream(request, streamMatch[1]);
    }

    // Handle completion endpoint (useCompletion)
    if (url.pathname === "/api/chat/completion" && request.method === "POST") {
      return handleCompletion(request);
    }

    // Handle knowledge base document upload (multipart form data)
    if (url.pathname === "/api/knowledge-base/upload" && request.method === "POST") {
      return handleDocumentUpload(request);
    }

    // Handle RPC routes (all other routes go to router)
    return router.handle(request);
  },
});
