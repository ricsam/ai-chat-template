import { handleHeadTagRequest } from "@richie-router/server";
import { RouteNotFoundError, ValidationError } from "@richie-rpc/server";
import { auth } from "./auth";
import { headTags } from "./head-tags";
import { router, UnauthorizedError } from "./router";
import { handleChatStream } from "./chat-stream";
import { handleResumeStream } from "./chat-resume";
import { handleCompletion } from "./completion";
import { handleDocumentUpload } from "./knowledge-base-upload";
import env from "@/env";

const baseUrl = new URL(env.BASE_URL);
const basePathname = baseUrl.pathname === "/" ? "" : baseUrl.pathname;
const authPath = basePathname + "/api/auth";
const chatPath = basePathname + "/api/chat";
const completionPath = basePathname + "/api/chat/completion";
const knowledgeBaseUploadPath = basePathname + "/api/knowledge-base/upload";
const escapedBasePathname = basePathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const chatStreamPathPattern = new RegExp(`^${escapedBasePathname}\\/api\\/chat\\/([^/]+)\\/stream$`);

serve({
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const headRequest = await handleHeadTagRequest(request, {
      headTags,
      basePath: baseUrl.pathname,
    });

    if (headRequest.matched) {
      return headRequest.response;
    }

    if (url.pathname === authPath || url.pathname.startsWith(authPath + "/")) {
      return auth.handler(request);
    }

    if (url.pathname === chatPath && request.method === "POST") {
      return handleChatStream(request);
    }

    const streamMatch = url.pathname.match(chatStreamPathPattern);
    if (streamMatch?.[1] && request.method === "GET") {
      return handleResumeStream(request, streamMatch[1]);
    }

    if (url.pathname === completionPath && request.method === "POST") {
      return handleCompletion(request);
    }

    if (url.pathname === knowledgeBaseUploadPath && request.method === "POST") {
      return handleDocumentUpload(request);
    }

    try {
      return await router.handle(request);
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json(
          {
            error: "Validation Error",
            field: error.field,
            issues: error.zodError.issues,
          },
          { status: 400 },
        );
      }
      if (error instanceof RouteNotFoundError) {
        return Response.json({ error: "Not Found" }, { status: 404 });
      }
      if (error instanceof UnauthorizedError) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      console.error("Unhandled server error", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});
