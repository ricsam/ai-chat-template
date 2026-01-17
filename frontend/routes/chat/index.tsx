import { createFileRoute } from "@tanstack/react-router";
import { ChatLayout } from "../../components/chat-layout";

export const Route = createFileRoute("/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  return (
    <ChatLayout currentChatId={null}>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h2 className="text-xl font-medium text-gray-300 mb-2">
            Start a new conversation
          </h2>
          <p className="text-gray-500">
            Click "New Chat" to begin
          </p>
        </div>
      </div>
    </ChatLayout>
  );
}
