// Completion - Streaming completion endpoint for useCompletion hook
import { streamText } from "ai";
import { buildItNow } from "@/ai-sdk-provider";
import { authenticateRequest } from "./auth";

// POST /chat/completion - Streaming completion endpoint for useCompletion hook
export async function handleCompletion(request: Request): Promise<Response> {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse request body (useCompletion sends { prompt, ... })
  const { prompt, modelId } = (await request.json()) as {
    prompt: string;
    modelId?: string;
  };

  if (!prompt) {
    return new Response("Prompt is required", { status: 400 });
  }

  // Use provided model or default
  const model = modelId || "claude-sonnet-4-5-20250929";

  // Stream AI response
  const result = streamText({
    model: buildItNow(model),
    prompt,
  });

  // Consume stream to ensure it runs to completion even if client disconnects
  result.consumeStream();

  // Return streaming response for useCompletion
  return result.toUIMessageStreamResponse();
}
