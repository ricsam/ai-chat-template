// Completion - Streaming completion endpoint for useCompletion hook
import { streamText } from "ai";
import { buildItNow, getModels } from "@/ai-sdk-provider";
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

  const models = await getModels();
  if (models.length === 0) {
    return new Response(
      "No models are configured. Set AI_SDK_MODELS in your .env file.",
      { status: 503 },
    );
  }

  if (modelId && !models.some((model) => model.modelId === modelId)) {
    return new Response(
      `Model "${modelId}" is not configured. Add it to AI_SDK_MODELS in your .env file.`,
      { status: 400 },
    );
  }

  const model = modelId ?? models[0]!.modelId;

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
