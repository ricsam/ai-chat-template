import { useNavigate, Link } from "@tanstack/react-router";
import { api } from "../api";
import { useSession, signOut } from "../auth-client";
import { useEffect, useState, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ModeToggle } from "./mode-toggle";
import { IconBook } from "@tabler/icons-react";

// Skeleton component for loading state
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ""}`} />;
}

interface ChatLayoutProps {
  children: ReactNode;
  currentChatId?: string | null;
}

export function ChatLayout({ children, currentChatId }: ChatLayoutProps) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const conversations = conversationsData?.payload ?? [];
  const models = modelsData?.payload ?? [];

  // Use first available model as default for new chats
  const defaultModel = models[0]?.modelId ?? "claude-sonnet-4-5-20250929";

  const handleNewChat = async () => {
    const result = await createConversation.mutateAsync({
      body: { modelId: defaultModel },
    });
    await refetch();
    if (result.payload && "id" in result.payload) {
      navigate({ to: "/chat/$id", params: { id: result.payload.id } });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    await deleteConversation.mutateAsync({ params: { id: deleteId } });
    refetch();
    // If we deleted the current chat, go to chat index
    if (currentChatId === deleteId) {
      navigate({ to: "/chat" });
    }
    setDeleteId(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (isPending || !session) {
    return (
      <div className="h-screen flex bg-background">
        {/* Sidebar Skeleton */}
        <div className="w-64 bg-card flex flex-col border-r border-border p-4 space-y-4">
          <Skeleton className="h-10 w-full rounded" />
          <Skeleton className="h-10 w-full rounded" />
          <div className="flex-1 space-y-2 mt-4">
            <Skeleton className="h-8 w-full rounded" />
            <Skeleton className="h-8 w-full rounded" />
            <Skeleton className="h-8 w-3/4 rounded" />
          </div>
          <Skeleton className="h-8 w-full rounded mt-auto" />
        </div>
        {/* Main Content Skeleton */}
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-4 w-full max-w-md px-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-card flex flex-col border-r border-border">
        {/* Header */}
        <div className="p-4 border-b border-border space-y-2">
          <Button
            onClick={handleNewChat}
            disabled={createConversation.isPending}
            className="w-full"
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
          </Button>
          <Link
            to="/knowledge-base"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
          >
            <IconBook size={16} />
            Knowledge Base
          </Link>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 && (
            <div className="text-muted-foreground text-sm text-center py-4">
              No conversations yet
            </div>
          )}
          {conversations.map((convo) => (
            <div key={convo.id} className="relative group mb-1">
              <Link
                to="/chat/$id"
                params={{ id: convo.id }}
                className={`flex items-center gap-2 px-3 py-2 text-foreground hover:bg-accent rounded-lg ${
                  currentChatId === convo.id ? "bg-accent" : ""
                }`}
              >
                <svg
                  className="w-4 h-4 flex-shrink-0 text-muted-foreground"
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
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteId(convo.id);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-opacity"
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
              <AlertDialog
                open={deleteId === convo.id}
                onOpenChange={(open) => !open && setDeleteId(null)}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{convo.title}" and all its messages. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={buttonVariants({ variant: "destructive" })}
                      onClick={handleDeleteConfirm}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-muted-foreground text-sm truncate">{session.user.name}</span>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
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
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
