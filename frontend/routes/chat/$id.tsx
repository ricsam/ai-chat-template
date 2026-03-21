import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
} from "@/components/ai-elements/queue";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import env from "@/env";
import type { MessageMetadata } from "@/shared/types";
import { useChat } from "@ai-sdk/react";
import { IconBook, IconBrain, IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import { createFileRoute } from "@richie-router/react";
import type { FileUIPart } from "ai";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, queryClient } from "../../api";
import { ChatLayout } from "../../ui/chat-layout";
import { CitationMarkdownRenderer } from "../../ui/citation-pill";

// Skeleton component for loading state
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ""}`} />;
}

export const Route = createFileRoute("/chat/$id")({
  component: ChatView,
});

// Model info type from contract
type ModelInfo = {
  modelId: string;
  displayName: string;
  thinking: boolean;
  provider: string;
  maxTokens?: number;
};

type QueuedMessage = {
  id: string;
  text: string;
  files: FileUIPart[];
  modelId: string;
  thinkingEnabled: boolean;
};

function ChatView() {
  const { id } = Route.useParams();
  const [input, setInput] = useState("");
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  // Track which chat ID we've initialized to avoid re-syncing on query refetch
  const initializedChatRef = useRef<string | null>(null);

  // Fetch available models (suspense query - models must exist)
  const { data: modelsData } = api.getModels.useSuspenseQuery({
    queryKey: ["getModels"],
    queryData: {},
  });

  const models = modelsData.payload;
  if (models.length === 0) {
    throw new Error("No models available. At least one model is required.");
  }

  // Initialize selected model to first available model
  const [selectedModel, setSelectedModel] = useState(() => models[0]!.modelId);

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, ModelInfo[]> = {};
    for (const model of models) {
      const provider = model.provider;
      if (!grouped[provider]) {
        grouped[provider] = [];
      }
      grouped[provider]!.push(model);
    }
    return grouped;
  }, [models]);

  // Get selected model info
  const selectedModelInfo = useMemo(() => {
    return models.find((m) => m.modelId === selectedModel) ?? models[0]!;
  }, [models, selectedModel]);

  // Fetch conversation metadata and initial messages
  const {
    data: convoData,
    isLoading,
    error,
  } = api.getConversation.useQuery({
    queryKey: ["getConversation", id],
    queryData: { params: { id } },
  });

  const conversation = convoData?.payload ?? null;

  // Reset thinking mode when model changes (if model doesn't support thinking)
  useEffect(() => {
    if (selectedModelInfo && !selectedModelInfo.thinking) {
      setThinkingEnabled(false);
    }
  }, [selectedModelInfo]);

  // useChat hook for streaming messages
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    error: chatError,
  } = useChat({
    id, // use the conversation ID
    experimental_throttle: 50, // Throttle updates to every 50ms
    transport: new DefaultChatTransport({
      api: env.BASE_URL + "/api/chat",
      credentials: "include",
      // Only send the last message to the server (we load previous from storage)
      prepareSendMessagesRequest({ messages: msgs, id: chatId }) {
        return { body: { message: msgs[msgs.length - 1], id: chatId } };
      },
    }),
    onFinish() {
      // Invalidate both sidebar and conversation query so fresh data is available
      // when user navigates away and back. The sync effect won't overwrite during
      // streaming because initializedChatRef.current === id at that point.
      queryClient.invalidateQueries({ queryKey: ["listConversations"] });
      queryClient.invalidateQueries({ queryKey: ["getConversation", id] });

      // Process next queued message
      setMessageQueue((prev) => {
        if (prev.length === 0) return prev;
        const [next, ...rest] = prev;
        if (next) {
          setTimeout(() => {
            sendMessage({ text: next.text, files: next.files }, { body: { modelId: next.modelId, thinkingEnabled: next.thinkingEnabled } });
          }, 0);
        }
        return rest;
      });
    },
  });

  // Sync initial messages ONLY when first loading a chat (not on every query refetch)
  useEffect(() => {
    if (conversation?.messages && initializedChatRef.current !== id) {
      setMessages(conversation.messages as UIMessage[]);
      initializedChatRef.current = id;
    }
  }, [conversation?.messages, id, setMessages]);

  // Calculate cumulative token usage from all messages
  const cumulativeTokens = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let cached = 0;
    let reasoning = 0;

    for (const msg of messages) {
      const metadata = msg.metadata as MessageMetadata | undefined;
      if (metadata) {
        inputTokens += metadata.promptTokens ?? 0;
        outputTokens += metadata.completionTokens ?? 0;
        cached += metadata.cachedInputTokens ?? 0;
        reasoning += metadata.reasoningTokens ?? 0;
      }
    }

    return {
      inputTokens,
      outputTokens,
      total: inputTokens + outputTokens,
      cached,
      reasoning,
    };
  }, [messages]);

  // Handle prompt input submission
  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;

    if (status === "streaming" || status === "submitted") {
      // Queue message instead of blocking
      setMessageQueue((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: message.text,
          files: message.files,
          modelId: selectedModel,
          thinkingEnabled,
        },
      ]);
      setInput("");
      return;
    }

    // Send with per-message model and thinking mode
    sendMessage(
      { text: message.text, files: message.files },
      {
        body: {
          modelId: selectedModel,
          thinkingEnabled,
        },
      },
    );
    setInput("");
  };

  // Remove a message from the queue
  const removeFromQueue = (id: string) => {
    setMessageQueue((prev) => prev.filter((m) => m.id !== id));
  };

  // Copy message text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Handle model selection
  const handleModelSelect = (model: ModelInfo) => {
    setSelectedModel(model.modelId);
    setModelSelectorOpen(false);
  };

  // Toggle thinking mode
  const toggleThinking = () => {
    if (selectedModelInfo?.thinking) {
      setThinkingEnabled(!thinkingEnabled);
    }
  };

  if (isLoading) {
    return (
      <ChatLayout currentChatId={id}>
        <div className="flex-1 flex flex-col p-6 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </ChatLayout>
    );
  }

  if (error || !conversation) {
    return (
      <ChatLayout currentChatId={id}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Conversation not found</div>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout currentChatId={id}>
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h1 className="text-foreground font-medium">{conversation.conversation.title}</h1>
        </div>

        {/* Messages */}
        <Conversation className="flex-1">
          <ConversationContent className="p-6">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground mt-20">Start a conversation by typing a message below</div>
            )}

            {messages.map((message: UIMessage, msgIndex: number) => {
              const metadata = message.metadata as MessageMetadata | undefined;
              const isStreaming = status === "streaming" && message.id === messages.at(-1)?.id;
              const hasTextContent = message.parts.some((p) => p.type === "text" && p.text);
              return (
                <div key={message.id}>
                  {/* Show shimmer for streaming assistant message with no content yet */}
                  {message.role === "assistant" && isStreaming && !hasTextContent && (
                    <Message from="assistant">
                      <MessageContent>
                        <Shimmer className="text-sm">Thinking...</Shimmer>
                      </MessageContent>
                    </Message>
                  )}
                  {message.parts.map((part: { type: string; text?: string }, i: number) => {
                    if (part.type === "text" && part.text) {
                      const hasCitations = message.role === "assistant" && metadata?.citations && metadata.citations.length > 0;

                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            {hasCitations ? (
                              <CitationMarkdownRenderer text={part.text} citations={metadata?.citations} />
                            ) : (
                              <MessageResponse>{part.text}</MessageResponse>
                            )}
                          </MessageContent>
                          {message.role === "assistant" && !isStreaming && (
                            <MessageActions className="flex items-center gap-2">
                              {/* Token usage and model info */}
                              {metadata?.totalTokens && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <span>{metadata.model}</span>
                                  <span>·</span>
                                  <span>{metadata.totalTokens} tokens</span>
                                  {metadata.ragEnabled && (
                                    <>
                                      <span>·</span>
                                      <span className="flex items-center gap-0.5">
                                        <IconBook size={10} />
                                        RAG
                                      </span>
                                    </>
                                  )}
                                  {metadata.thinkingEnabled && (
                                    <>
                                      <span>·</span>
                                      <span className="flex items-center gap-0.5">
                                        <IconBrain size={10} />
                                        thinking
                                      </span>
                                    </>
                                  )}
                                  {metadata.createdAt && (
                                    <>
                                      <span>·</span>
                                      <span>{new Date(metadata.createdAt).toLocaleTimeString()}</span>
                                    </>
                                  )}
                                </span>
                              )}
                              <MessageAction label="Copy" onClick={() => copyToClipboard(part.text || "")}>
                                <IconCopy size={12} />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    }
                    // Handle reasoning parts for thinking mode
                    if (part.type === "reasoning" && part.text) {
                      const isReasoningStreaming =
                        status === "streaming" && i === message.parts.length - 1 && message.id === messages.at(-1)?.id;
                      return (
                        <Reasoning key={`${message.id}-${i}`} className="w-full mb-2" isStreaming={isReasoningStreaming}>
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            })}

            {/* Loading indicator when waiting for response (before streaming message exists) */}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer className="text-sm">Thinking...</Shimmer>
                </MessageContent>
              </Message>
            )}

            {chatError && (
              <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 text-center">
                {chatError.message}
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input */}
        <div className="p-4 border-t border-border">
          {messageQueue.length > 0 && (
            <Queue className="mb-3">
              <QueueList>
                {messageQueue.map((queuedMsg, index) => (
                  <QueueItem key={queuedMsg.id}>
                    <div className="flex items-center gap-2">
                      <QueueItemIndicator />
                      <QueueItemContent className="flex-1 truncate">
                        <span className="text-muted-foreground text-xs mr-2">#{index + 1}</span>
                        {queuedMsg.text.length > 50 ? queuedMsg.text.substring(0, 50) + "..." : queuedMsg.text}
                      </QueueItemContent>
                      <QueueItemActions>
                        <QueueItemAction onClick={() => removeFromQueue(queuedMsg.id)} aria-label="Remove">
                          <IconX size={14} />
                        </QueueItemAction>
                      </QueueItemActions>
                    </div>
                  </QueueItem>
                ))}
              </QueueList>
            </Queue>
          )}
          <PromptInputProvider>
            <PromptInput onSubmit={handleSubmit} globalDrop multiple>
            <PromptInputAttachments>{(attachment) => <PromptInputAttachment data={attachment} />}</PromptInputAttachments>
              <PromptInputBody>
                <PromptInputTextarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  {/* Attachments action menu */}
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>

                  {/* Context/Token usage - only show if model has maxTokens */}
                  {selectedModelInfo.maxTokens && cumulativeTokens.total > 0 && (
                    <Context
                      maxTokens={selectedModelInfo.maxTokens}
                      modelId={selectedModel ?? ""}
                      usage={{
                        inputTokens: cumulativeTokens.inputTokens,
                        outputTokens: cumulativeTokens.outputTokens,
                        totalTokens: cumulativeTokens.total,
                        cachedInputTokens: cumulativeTokens.cached,
                        reasoningTokens: cumulativeTokens.reasoning,
                        inputTokenDetails: {
                          noCacheTokens: undefined,
                          cacheReadTokens: cumulativeTokens.cached || undefined,
                          cacheWriteTokens: undefined,
                        },
                        outputTokenDetails: {
                          textTokens: cumulativeTokens.outputTokens || undefined,
                          reasoningTokens: cumulativeTokens.reasoning || undefined,
                        },
                      }}
                      usedTokens={cumulativeTokens.total}
                    >
                      <ContextTrigger />
                      <ContextContent>
                        <ContextContentHeader />
                        <ContextContentBody>
                          <ContextInputUsage />
                          <ContextOutputUsage />
                          {cumulativeTokens.reasoning > 0 && <ContextReasoningUsage />}
                          {cumulativeTokens.cached > 0 && <ContextCacheUsage />}
                        </ContextContentBody>
                        <ContextContentFooter />
                      </ContextContent>
                    </Context>
                  )}

                  {/* Model selector */}
                  <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                    <ModelSelectorTrigger asChild>
                      <PromptInputButton>
                        <ModelSelectorLogo provider={selectedModelInfo.provider} />
                        <ModelSelectorName className="max-w-[120px] truncate">{selectedModelInfo.displayName}</ModelSelectorName>
                      </PromptInputButton>
                    </ModelSelectorTrigger>
                    <ModelSelectorContent>
                      <ModelSelectorInput placeholder="Search models..." />
                      <ModelSelectorList>
                        <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                        {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                          <ModelSelectorGroup heading={provider} key={provider}>
                            {providerModels.map((model) => (
                              <ModelSelectorItem key={model.modelId} onSelect={() => handleModelSelect(model)} value={model.modelId}>
                                <ModelSelectorLogo provider={model.provider} />
                                <ModelSelectorName>{model.displayName}</ModelSelectorName>
                                {model.thinking && (
                                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                                    <IconBrain size={12} />
                                  </span>
                                )}
                                {selectedModel === model.modelId && <IconCheck size={14} className="ml-1 text-primary" />}
                              </ModelSelectorItem>
                            ))}
                          </ModelSelectorGroup>
                        ))}
                      </ModelSelectorList>
                    </ModelSelectorContent>
                  </ModelSelector>

                  {/* Thinking mode toggle - only for models that support it */}
                  {selectedModelInfo.thinking && (
                    <PromptInputButton
                      variant={thinkingEnabled ? "default" : "ghost"}
                      onClick={toggleThinking}
                      title={thinkingEnabled ? "Thinking mode enabled" : "Enable thinking mode"}
                    >
                      <IconBrain size={16} />
                      <span className="hidden sm:inline">Think</span>
                    </PromptInputButton>
                  )}
                </PromptInputTools>
                <PromptInputSubmit
                  disabled={!input.trim() && status !== "streaming" && status !== "submitted"}
                  status={status === "streaming" || status === "submitted" ? status : undefined}
                  onClick={
                    status === "streaming" || status === "submitted"
                      ? (e) => {
                          e.preventDefault();
                          stop();
                        }
                      : undefined
                  }
                />
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>
        </div>
      </div>
    </ChatLayout>
  );
}
