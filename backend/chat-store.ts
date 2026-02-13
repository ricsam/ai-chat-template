// Chat Store - File-based storage for conversations using OPFS
import { readJsonFile, writeJsonFile, deleteJsonFile } from "./storage";

// Types for conversation storage
export interface ConversationFile {
  id: string;
  userId: string;
  title: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  messages: unknown[]; // UIMessage[] - will be typed in Phase 3
  activeStreamId: string | null;
}

interface ConversationIndex {
  conversations: Array<{
    id: string;
    userId: string;
    title: string;
    modelId: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

// Get conversation index
async function getConversationIndex(): Promise<ConversationIndex> {
  const index = await readJsonFile<ConversationIndex>("conversations/index.json");
  return index || { conversations: [] };
}

// Save conversation index
async function saveConversationIndex(index: ConversationIndex): Promise<void> {
  await writeJsonFile("conversations/index.json", index);
}

// Create a new chat
export async function createChat(
  userId: string,
  modelId: string,
  title?: string
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const convo: ConversationFile = {
    id,
    userId,
    title: title || "New Chat",
    modelId,
    createdAt: now,
    updatedAt: now,
    messages: [],
    activeStreamId: null,
  };

  await writeJsonFile(`conversations/${id}.json`, convo);

  // Update index
  const index = await getConversationIndex();
  index.conversations.push({
    id,
    userId,
    title: convo.title,
    modelId,
    createdAt: now,
    updatedAt: now,
  });
  await saveConversationIndex(index);

  return id;
}

// Load chat messages
export async function loadChat(id: string): Promise<unknown[]> {
  const convo = await readJsonFile<ConversationFile>(`conversations/${id}.json`);
  return convo?.messages ?? [];
}

// Save chat messages (and optionally update activeStreamId)
export async function saveChat({
  chatId,
  messages,
  activeStreamId,
}: {
  chatId: string;
  messages?: unknown[];
  activeStreamId?: string | null;
}): Promise<void> {
  const convo = await readJsonFile<ConversationFile>(`conversations/${chatId}.json`);
  if (!convo) return;

  const now = new Date().toISOString();
  if (messages !== undefined) {
    convo.messages = messages;
  }
  if (activeStreamId !== undefined) {
    convo.activeStreamId = activeStreamId;
  }
  convo.updatedAt = now;

  // Auto-generate title from first user message if it's "New Chat"
  if (!convo.title || convo.title === "New Chat" && convo.messages.length > 0) {
    const firstUserMessage = convo.messages.find(
      (m) => typeof m === "object" && m !== null && "role" in m && m.role === "user"
    ) as { role: string; parts?: Array<{ type: string; text?: string }> } | undefined;

    if (firstUserMessage?.parts) {
      const textPart = firstUserMessage.parts.find((p) => p.type === "text");
      if (textPart?.text) {
        const text = textPart.text;
        convo.title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
      }
    }
  }

  await writeJsonFile(`conversations/${chatId}.json`, convo);

  // Update index
  const index = await getConversationIndex();
  const entry = index.conversations.find((c) => c.id === chatId);
  if (entry) {
    entry.updatedAt = now;
    entry.title = convo.title;
    await saveConversationIndex(index);
  }
}

// Get conversation metadata
export async function getConversation(id: string): Promise<ConversationFile | null> {
  return readJsonFile<ConversationFile>(`conversations/${id}.json`);
}

// Delete conversation
export async function deleteChat(id: string): Promise<void> {
  await deleteJsonFile(`conversations/${id}.json`);

  const index = await getConversationIndex();
  index.conversations = index.conversations.filter((c) => c.id !== id);
  await saveConversationIndex(index);
}

// List user's conversations
export async function listChats(
  userId: string
): Promise<ConversationIndex["conversations"]> {
  const index = await getConversationIndex();
  return index.conversations
    .filter((c) => c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
