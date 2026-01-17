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
    // Parse request body
    const { message, id: chatId } = (await request.json()) as {
      message: UIMessage;
      id: string;
    };

    // Load conversation
    const convo = await getConversation(chatId);
    if (!convo || convo.userId !== auth.userId) {
      return new Response("Conversation not found", { status: 404 });
    }

    // Load previous messages
    const previousMessages = (await loadChat(chatId)) as UIMessage[];
    const messages = [...previousMessages, message];

    // Convert messages
    const modelMessages = await convertToModelMessages(messages);

    // Stream AI response
    const result = streamText({
      model: buildItNow(convo.modelId),
      messages: modelMessages,
    });

    // Return UIMessageStream format for useChat hook
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      // Generate consistent server-side IDs for persistence
      generateMessageId: createIdGenerator({
        prefix: "msg",
        size: 16,
      }),
      // Attach metadata at different stream stages
      messageMetadata: ({ part }) => {
        if (part.type === "start") {
          return {
            createdAt: Date.now(),
            model: convo.modelId,
          };
        }
        if (part.type === "finish") {
          return {
            totalTokens: part.totalUsage.totalTokens,
            promptTokens: part.totalUsage.inputTokens,
            completionTokens: part.totalUsage.outputTokens,
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
