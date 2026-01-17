import { useNavigate, Link } from "@tanstack/react-router";
import { api } from "../api";
import { useSession, signOut } from "../auth-client";
import { useEffect, useState, type ReactNode } from "react";

interface ChatLayoutProps {
  children: ReactNode;
  currentChatId?: string | null;
}

export function ChatLayout({ children, currentChatId }: ChatLayoutProps) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-5-20250929");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: "/" });
    }
  }, [isPending, session, navigate]);

  // Fetch conversations and models
  const { data: conversationsData, refetch } = api.listConversations.useQuery({
    queryKey: ["listConversations"],
    queryData: {},
    enabled: !!session,
  });
  const { data: modelsData } = api.getModels.useQuery({
    queryKey: ["getModels"],
    queryData: {},
    enabled: !!session,
  });
  const createConversation = api.createConversation.useMutation();
  const deleteConversation = api.deleteConversation.useMutation();

  const conversations = conversationsData?.data ?? [];
  const models = modelsData?.data ?? [];

  // Set default model when models are loaded
  useEffect(() => {
    const modelsList = modelsData?.data ?? [];
    const firstModel = modelsList[0];
    if (modelsList.length > 0 && firstModel && !modelsList.find((m) => m.modelId === selectedModel)) {
      setSelectedModel(firstModel.modelId);
    }
  }, [modelsData?.data, selectedModel]);

  const handleNewChat = async () => {
    const result = await createConversation.mutateAsync({
      body: { modelId: selectedModel },
    });
    await refetch();
    if (result.data && "id" in result.data) {
      navigate({ to: "/chat/$id", params: { id: result.data.id } });
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteConversation.mutateAsync({ params: { id } });
    refetch();
    // If we deleted the current chat, go to chat index
    if (currentChatId === id) {
      navigate({ to: "/chat" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (isPending || !session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 flex flex-col border-r border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={handleNewChat}
            disabled={createConversation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait text-white rounded-lg transition-colors"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Chat
          </button>
        </div>

        {/* Model Selector */}
        <div className="p-4 border-b border-gray-700">
          <label className="text-xs text-gray-400 mb-1 block">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {models.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 && (
            <div className="text-gray-500 text-sm text-center py-4">
              No conversations yet
            </div>
          )}
          {conversations.map((convo) => (
            <Link
              key={convo.id}
              to="/chat/$id"
              params={{ id: convo.id }}
              className={`flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-700 rounded-lg group mb-1 ${
                currentChatId === convo.id ? "bg-gray-700" : ""
              }`}
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="flex-1 truncate text-sm">{convo.title}</span>
              <button
                onClick={(e) => handleDelete(convo.id, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 p-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </Link>
          ))}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <span className="text-gray-400 text-sm truncate">{session.user.name}</span>
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-white p-1"
            title="Sign out"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
