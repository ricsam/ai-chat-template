// Chat Stream - Streaming chat endpoint for useChat hook
// Returns UIMessageStream format for real-time streaming with useChat
import { authenticateRequest } from "./auth";
import { getConversation, loadChat, saveChat } from "./chat-store";
import {
  convertToModelMessages,
  streamText,
  createIdGenerator,
  type UIMessage,
} from "ai";
import { buildItNow } from "@/ai-sdk-provider";

// POST /chat - Streaming chat endpoint for useChat hook
export async function handleChatStream(request: Request): Promise<Response> {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Parse request body - includes per-message model selection and thinking mode
    const { message, id: chatId, modelId, thinkingEnabled } = (await request.json()) as {
      message: UIMessage;
      id: string;
      modelId?: string;
      thinkingEnabled?: boolean;
    };

    // Load conversation
    const convo = await getConversation(chatId);
    if (!convo || convo.userId !== auth.userId) {
      return new Response("Conversation not found", { status: 404 });
    }

    // Use per-message model if provided, otherwise fall back to conversation default
    const selectedModel = modelId || convo.modelId;

    // Load previous messages
    const previousMessages = (await loadChat(chatId)) as UIMessage[];
    const messages = [...previousMessages, message];

    // Convert messages
    const modelMessages = await convertToModelMessages(messages);

    // Stream AI response with optional thinking mode
    const result = streamText({
      model: buildItNow(selectedModel),
      messages: modelMessages,
      ...(thinkingEnabled && {
        providerOptions: {
          anthropic: {
            thinking: { type: "enabled", budgetTokens: 10000 },
          },
        },
      }),
    });

    // Return UIMessageStream format for useChat hook
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      // Generate consistent server-side IDs for persistence
      generateMessageId: createIdGenerator({
        prefix: "msg",
        size: 16,
      }),
      // Send reasoning tokens to client when thinking is enabled
      sendReasoning: thinkingEnabled,
      // Attach metadata at different stream stages
      messageMetadata: ({ part }) => {
        if (part.type === "start") {
          return {
            createdAt: Date.now(),
            model: selectedModel,
            thinkingEnabled: thinkingEnabled ?? false,
          };
        }
        if (part.type === "finish") {
          return {
            totalTokens: part.totalUsage.totalTokens,
            promptTokens: part.totalUsage.inputTokens,
            completionTokens: part.totalUsage.outputTokens,
            cachedInputTokens: part.totalUsage.cachedInputTokens ?? 0,
            reasoningTokens: part.totalUsage.reasoningTokens ?? 0,
          };
        }
      },
      // Save messages when stream completes
      onFinish: ({ messages: updatedMessages }) => {
        saveChat({ chatId, messages: updatedMessages });
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error("Chat error:", errorMessage, errorStack);
    return new Response(
      JSON.stringify({
        error: errorMessage || "Chat request failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
