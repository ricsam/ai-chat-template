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
import { findRelevantContent, type SearchResult } from "./embedding";
import type { Citation } from "@/shared/types";

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

    // Extract text from the user's message for RAG search
    const userMessageText = message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join(" ");

    // Search knowledge base for relevant content
    let citations: Citation[] = [];
    let ragContext = "";

    try {
      const relevantContent = await findRelevantContent(auth.userId, userMessageText, 5, 0.3);

      if (relevantContent.length > 0) {
        citations = relevantContent.map((result, index) => ({
          number: String(index + 1),
          documentId: result.documentId,
          fileName: result.fileName,
          content: result.content,
          pageNumber: result.pageNumber,
          similarity: result.similarity,
        }));

        // Build RAG context for the system prompt
        ragContext = relevantContent
          .map(
            (r, i) =>
              `[${i + 1}] From "${r.fileName}"${r.pageNumber ? ` (page ${r.pageNumber})` : ""}:\n${r.content}`
          )
          .join("\n\n");
      }
    } catch (error) {
      // RAG search failed, continue without context
      console.error("RAG search error:", error);
    }

    // Build system prompt with RAG context
    let systemPrompt = "";
    if (ragContext) {
      systemPrompt = `You have access to the user's knowledge base. Use the following relevant information to help answer questions. When you use information from the knowledge base, cite it using [1], [2], etc. format corresponding to the source numbers below.

KNOWLEDGE BASE CONTEXT:
${ragContext}

CITATION INSTRUCTIONS:
- When using information from the knowledge base, include inline citations like [1], [2], etc.
- Only cite sources that are directly relevant to your answer
- You can cite multiple sources in a single sentence if needed
- If the knowledge base doesn't contain relevant information for a question, answer based on your general knowledge without citations`;
    }

    // Convert messages
    const modelMessages = await convertToModelMessages(messages);

    console.log("modelMessages", modelMessages);
    console.log("systemPrompt", systemPrompt);
    console.log("thinkingEnabled", thinkingEnabled);
    console.log("selectedModel", selectedModel);

    // Stream AI response with optional thinking mode
    const result = streamText({
      model: buildItNow(selectedModel),
      messages: modelMessages,
      ...(systemPrompt && { system: systemPrompt }),
      ...(thinkingEnabled && {
        providerOptions: {
          anthropic: {
            thinking: { type: "enabled", budgetTokens: 10000 },
          },
        },
      }),
      'onError': (error) => {
        console.error("onError", error);
      },
      'onChunk': (chunk) => {
        // console.log("onChunk");
      },
      'onFinish': (result) => {
        console.log("onFinish");
      },
      'onAbort': (result) => {
        console.log("onAbort");
      },
      'onStepFinish': (result) => { 
        console.log("onStepFinish");
      },
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
            citations: citations.length > 0 ? citations : undefined,
            ragEnabled: citations.length > 0,
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
        console.log("onFinish", updatedMessages);
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
