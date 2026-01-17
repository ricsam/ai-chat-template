import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { api, queryClient } from "../../api";
import { ChatLayout } from "../../components/chat-layout";
import type { MessageMetadata } from "@/shared/types";
import env from "@/env";

export const Route = createFileRoute("/chat/$id")({
  component: ChatView,
});

function ChatView() {
  const { id } = Route.useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle form submission
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status !== "streaming") {
      sendMessage({ text: input });
      setInput("");
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && status !== "streaming") {
        sendMessage({ text: input });
        setInput("");
      }
    }
  };

  if (isLoading) {
    return (
      <ChatLayout currentChatId={id}>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </ChatLayout>
    );
  }

  if (error || !conversation) {
    return (
      <ChatLayout currentChatId={id}>
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Conversation not found
        </div>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout currentChatId={id}>
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h1 className="text-white font-medium">
            {conversation.conversation.title}
          </h1>
          <p className="text-xs text-gray-400">
            {conversation.conversation.modelId}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              Start a conversation by typing a message below
            </div>
          )}

          {messages.map((message: UIMessage) => {
            const metadata = message.metadata as MessageMetadata | undefined;
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col max-w-[70%]">
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-100"
                    }`}
                  >
                    {/* Render message parts */}
                    {message.parts.map((part: { type: string; text?: string }, i: number) => {
                      if (part.type === "text" && part.text) {
                        return (
                          <p key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </p>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Token usage metadata (assistant messages only) */}
                  {message.role === "assistant" && metadata?.totalTokens && (
                    <div className="mt-1 text-xs text-gray-500 px-2">
                      {metadata.totalTokens} tokens
                      {metadata.createdAt && (
                        <span className="ml-2">
                          {new Date(metadata.createdAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}

          {/* Streaming indicator */}
          {status === "streaming" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="bg-gray-700 px-4 py-3 rounded-2xl">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          {chatError && (
            <div className="text-red-400 text-center py-2">
              Error: {chatError.message}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={onSubmit} className="p-4 border-t border-gray-700">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={status === "streaming"}
            />
            <button
              type="submit"
              disabled={!input.trim() || status === "streaming"}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </ChatLayout>
  );
}
