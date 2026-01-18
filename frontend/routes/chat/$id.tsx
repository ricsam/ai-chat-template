import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { api, queryClient } from "../../api";
import { ChatLayout } from "../../components/chat-layout";
import type { MessageMetadata } from "@/shared/types";
import env from "@/env";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Loader } from "@/components/ai-elements/loader";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { CopyIcon } from "lucide-react";

export const Route = createFileRoute("/chat/$id")({
  component: ChatView,
});

function ChatView() {
  const { id } = Route.useParams();
  const [input, setInput] = useState("");
  // Track which chat ID we've initialized to avoid re-syncing on query refetch
  const initializedChatRef = useRef<string | null>(null);

  // Fetch conversation metadata and initial messages
  const {
    data: convoData,
    isLoading,
    error,
  } = api.getConversation.useQuery({
    queryKey: ["getConversation", id],
    queryData: { params: { id } },
  });

  const conversation =
    convoData?.data && "conversation" in convoData.data ? convoData.data : null;

  // useChat hook for streaming messages
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error: chatError,
  } = useChat({
    id, // use the conversation ID
    experimental_throttle: 50, // Throttle updates to every 50ms
    transport: new DefaultChatTransport({
      api: env.API_BASE_URL + "/chat",
      credentials: "include",
      // Only send the last message to the server (we load previous from storage)
      prepareSendMessagesRequest({ messages: msgs, id: chatId }) {
        return { body: { message: msgs[msgs.length - 1], id: chatId } };
      },
    }),
    onFinish() {
      // Only invalidate sidebar list, not the conversation query
      // (to avoid useEffect overwriting useChat's state)
      queryClient.invalidateQueries({ queryKey: ["listConversations"] });
    },
  });

  // Sync initial messages ONLY when first loading a chat (not on every query refetch)
  useEffect(() => {
    if (conversation?.messages && initializedChatRef.current !== id) {
      setMessages(conversation.messages as UIMessage[]);
      initializedChatRef.current = id;
    }
  }, [conversation?.messages, id, setMessages]);

  // Handle prompt input submission
  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;
    if (status === "streaming" || status === "submitted") return;
    sendMessage({ text: message.text });
    setInput("");
  };

  // Copy message text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <ChatLayout currentChatId={id}>
        <div className="flex-1 flex flex-col p-6 space-y-4">
          <div className="flex gap-3">
            <Shimmer className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-4 w-1/2" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <div className="space-y-2">
              <Shimmer className="h-4 w-48" />
            </div>
            <Shimmer className="w-8 h-8 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Shimmer className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </ChatLayout>
    );
  }

  if (error || !conversation) {
    return (
      <ChatLayout currentChatId={id}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Conversation not found
        </div>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout currentChatId={id}>
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h1 className="text-foreground font-medium">
            {conversation.conversation.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {conversation.conversation.modelId}
          </p>
        </div>

        {/* Messages */}
        <Conversation className="flex-1">
          <ConversationContent className="p-6">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground mt-20">
                Start a conversation by typing a message below
              </div>
            )}

            {messages.map((message: UIMessage) => {
              const metadata = message.metadata as MessageMetadata | undefined;
              return (
                <div key={message.id}>
                  {message.parts.map((part: { type: string; text?: string }, i: number) => {
                    if (part.type === "text" && part.text) {
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>{part.text}</MessageResponse>
                          </MessageContent>
                          {message.role === "assistant" && (
                            <MessageActions>
                              <MessageAction
                                label="Copy"
                                onClick={() => copyToClipboard(part.text || "")}
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    }
                    return null;
                  })}

                  {/* Token usage metadata (assistant messages only) */}
                  {message.role === "assistant" && metadata?.totalTokens && (
                    <div className="mt-1 text-xs text-muted-foreground px-2 ml-10">
                      {metadata.totalTokens} tokens
                      {metadata.createdAt && (
                        <span className="ml-2">
                          {new Date(metadata.createdAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator when waiting for response */}
            {status === "submitted" && <Loader />}

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
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
            />
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputSubmit
                disabled={!input.trim()}
                status={status === "streaming" || status === "submitted" ? status : undefined}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </ChatLayout>
  );
}
