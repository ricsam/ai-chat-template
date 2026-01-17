# AI Chat App Template Plan

A full-featured chat application where users can authenticate, create conversations, choose models, and chat with AI using the `@/ai-sdk-provider`.

## Features

- **Authentication**: Simple username-only auth (enter username to sign in/up)
- **Chat Interface**: Real-time streaming chat with AI using `useChat` hook
- **Text Completions**: Single-prompt completions using `useCompletion` hook
- **Model Selection**: Choose from available AI models
- **Chat History**: Sidebar with list of conversations
- **Persistent Storage**: Conversations stored as JSON files on disk (OPFS) using AI SDK's `UIMessage` format
- **Resumable Streams**: Streams can be resumed after page refresh or client disconnect
- **Token Usage Tracking**: Track and display tokens used per message via metadata

---

## Storage Architecture

### File Structure

```
/data/
├── conversations/
│   ├── index.json           # List of conversations with metadata
│   └── {conversationId}.json # Individual conversation files with UIMessage[] array
├── streams/
│   └── {streamId}.ndjson    # Active stream chunks (newline-delimited JSON)
```

### Conversation Index (`index.json`)

```typescript
interface ConversationIndex {
  conversations: Array<{
    id: string;
    userId: string;
    title: string;
    modelId: string;
    createdAt: string;      // ISO timestamp
    updatedAt: string;      // ISO timestamp
  }>;
}
```

### Individual Conversation File (`{conversationId}.json`)

Uses AI SDK's `UIMessage` format for direct compatibility with `useChat`:

```typescript
import { UIMessage } from "ai";

interface ConversationFile {
  id: string;
  userId: string;
  title: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  messages: UIMessage[];       // AI SDK's UIMessage format
  activeStreamId: string | null;  // Active stream for resumption
}
```

The `UIMessage` format includes:
- `id`: Unique message identifier
- `role`: "user" | "assistant" | "system"
- `parts`: Array of message parts (text, tool calls, etc.)
- `createdAt`: Timestamp

---

## Message Metadata Types

Define types for message-level metadata (token usage, timestamps, model info):

```typescript
// shared/types.ts
import { UIMessage } from "ai";
import { z } from "zod";

// Schema for message metadata
export const messageMetadataSchema = z.object({
  createdAt: z.number().optional(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// Typed UIMessage with metadata
export type ChatMessage = UIMessage<MessageMetadata>;
```

---

## File Storage Helpers

```typescript
// backend/storage.ts

// Helper to get or create a directory recursively
async function getOrCreateDir(
  root: FileSystemDirectoryHandle,
  pathParts: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const part of pathParts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

// Read JSON file from OPFS
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const root = await getDirectory("/data");
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: false });
    }

    const fileHandle = await dir.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Write JSON file to OPFS
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const root = await getDirectory("/data");
  const parts = filePath.split("/").filter(Boolean);
  const fileName = parts.pop()!;

  const dir = parts.length > 0
    ? await getOrCreateDir(root, parts)
    : root;

  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

// Delete JSON file from OPFS
async function deleteJsonFile(filePath: string): Promise<void> {
  try {
    const root = await getDirectory("/data");
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: false });
    }

    await dir.removeEntry(fileName);
  } catch {
    // File doesn't exist, ignore
  }
}
```

---

## Chat Store Helpers

```typescript
// backend/chat-store.ts
import { UIMessage, generateId } from "ai";
import { readJsonFile, writeJsonFile, deleteJsonFile } from "./storage";

interface ConversationFile {
  id: string;
  userId: string;
  title: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  messages: UIMessage[];
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

// Create a new chat
export async function createChat(userId: string, modelId: string, title?: string): Promise<string> {
  const id = generateId();
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
export async function loadChat(id: string): Promise<UIMessage[]> {
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
  messages?: UIMessage[];
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
  if (convo.title === "New Chat" && convo.messages.length > 0) {
    const firstUserMessage = convo.messages.find(m => m.role === "user");
    if (firstUserMessage) {
      const textPart = firstUserMessage.parts.find(p => p.type === "text");
      if (textPart && textPart.type === "text") {
        const text = textPart.text;
        convo.title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
      }
    }
  }

  await writeJsonFile(`conversations/${chatId}.json`, convo);

  // Update index
  const index = await getConversationIndex();
  const entry = index.conversations.find(c => c.id === chatId);
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
  index.conversations = index.conversations.filter(c => c.id !== id);
  await saveConversationIndex(index);
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

// List user's conversations
export async function listChats(userId: string): Promise<ConversationIndex["conversations"]> {
  const index = await getConversationIndex();
  return index.conversations
    .filter(c => c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
```

---

## API Contract

```typescript
// shared/contract.ts
import { defineContract, Status } from "@richie-rpc/core";
import { z } from "zod";

const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  modelId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const contract = defineContract({
  // Get available AI models
  getModels: {
    type: "standard",
    method: "GET",
    path: "/models",
    responses: {
      [Status.OK]: z.array(z.object({
        modelId: z.string(),
        displayName: z.string(),
      })),
    },
  },

  // List user's conversations
  listConversations: {
    type: "standard",
    method: "GET",
    path: "/conversations",
    responses: {
      [Status.OK]: z.array(ConversationSchema),
    },
  },

  // Get single conversation metadata
  getConversation: {
    type: "standard",
    method: "GET",
    path: "/conversations/:id",
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.object({
        conversation: ConversationSchema,
        messages: z.array(z.any()), // UIMessage[] - complex type
      }),
      [Status.NotFound]: z.object({ error: z.string() }),
    },
  },

  // Create new conversation
  createConversation: {
    type: "standard",
    method: "POST",
    path: "/conversations",
    body: z.object({
      modelId: z.string(),
      title: z.string().optional(),
    }),
    responses: {
      [Status.Created]: ConversationSchema,
    },
  },

  // Update conversation (title, model)
  updateConversation: {
    type: "standard",
    method: "PATCH",
    path: "/conversations/:id",
    params: z.object({ id: z.string() }),
    body: z.object({
      title: z.string().optional(),
      modelId: z.string().optional(),
    }),
    responses: {
      [Status.OK]: ConversationSchema,
      [Status.NotFound]: z.object({ error: z.string() }),
    },
  },

  // Delete conversation
  deleteConversation: {
    type: "standard",
    method: "DELETE",
    path: "/conversations/:id",
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.object({ success: z.boolean() }),
      [Status.NotFound]: z.object({ error: z.string() }),
    },
  },

  // Streaming chat endpoint (used by useChat hook)
  // This is a special streaming endpoint, not a standard RPC endpoint
  // Endpoint: POST /chat (separate from /api RPC routes)
});
```

---

## Backend Router

```typescript
// backend/router.ts
import { createRouter, Status } from "@richie-rpc/server";
import { contract } from "@/shared/contract";
import { getModels } from "@/ai-sdk-provider";
import {
  createChat,
  loadChat,
  getConversation,
  deleteChat,
  listChats,
} from "./chat-store";
import { readJsonFile, writeJsonFile } from "./storage";
import { authenticateRequest } from "./auth";

interface ConversationFile {
  id: string;
  userId: string;
  title: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  messages: unknown[];
}

export const router = createRouter<typeof contract, { getUserId: () => string }>(
  contract,
  {
    // Get available AI models
    getModels: async () => {
      const models = await getModels();
      return { status: Status.OK, body: models };
    },

    // List conversations for authenticated user
    listConversations: async ({ context }) => {
      const userId = context.getUserId();
      const convos = await listChats(userId);

      return {
        status: Status.OK,
        body: convos.map((c) => ({
          id: c.id,
          title: c.title,
          modelId: c.modelId,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      };
    },

    // Get conversation with messages
    getConversation: async ({ params, context }) => {
      const userId = context.getUserId();
      const convo = await getConversation(params.id);

      if (!convo || convo.userId !== userId) {
        return { status: Status.NotFound, body: { error: "Conversation not found" } };
      }

      return {
        status: Status.OK,
        body: {
          conversation: {
            id: convo.id,
            title: convo.title,
            modelId: convo.modelId,
            createdAt: convo.createdAt,
            updatedAt: convo.updatedAt,
          },
          messages: convo.messages,
        },
      };
    },

    // Create new conversation
    createConversation: async ({ body, context }) => {
      const userId = context.getUserId();
      const id = await createChat(userId, body.modelId, body.title);
      const convo = await getConversation(id);

      return {
        status: Status.Created,
        body: {
          id,
          title: convo?.title || "New Chat",
          modelId: body.modelId,
          createdAt: convo?.createdAt || new Date().toISOString(),
          updatedAt: convo?.updatedAt || new Date().toISOString(),
        },
      };
    },

    // Update conversation
    updateConversation: async ({ params, body, context }) => {
      const userId = context.getUserId();
      const convo = await readJsonFile<ConversationFile>(`conversations/${params.id}.json`);

      if (!convo || convo.userId !== userId) {
        return { status: Status.NotFound, body: { error: "Conversation not found" } };
      }

      const now = new Date().toISOString();
      if (body.title) convo.title = body.title;
      if (body.modelId) convo.modelId = body.modelId;
      convo.updatedAt = now;

      await writeJsonFile(`conversations/${params.id}.json`, convo);

      return {
        status: Status.OK,
        body: {
          id: convo.id,
          title: convo.title,
          modelId: convo.modelId,
          createdAt: convo.createdAt,
          updatedAt: convo.updatedAt,
        },
      };
    },

    // Delete conversation
    deleteConversation: async ({ params, context }) => {
      const userId = context.getUserId();
      const convo = await getConversation(params.id);

      if (!convo || convo.userId !== userId) {
        return { status: Status.NotFound, body: { error: "Conversation not found" } };
      }

      await deleteChat(params.id);

      return { status: Status.OK, body: { success: true } };
    },
  },
  {
    basePath: "/api",
    async context(request) {
      const auth = await authenticateRequest(request);
      if (!auth) {
        return {
          getUserId() {
            throw new Error("Unauthorized");
          },
        };
      }
      return {
        getUserId() {
          return auth.userId;
        },
      };
    },
  }
);
```

---

## Streaming Chat Endpoint

```typescript
// backend/chat-stream.ts
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  createIdGenerator,
  generateId,
} from "ai";
import { buildItNow } from "@/ai-sdk-provider";
import { loadChat, saveChat, getConversation } from "./chat-store";
import { createResumableStream, deleteStreamFile } from "./stream-store";
import { authenticateRequest } from "./auth";

// POST /chat - Streaming chat endpoint for useChat hook
export async function handleChatStream(request: Request): Promise<Response> {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse request body
  // With prepareSendMessagesRequest, we only receive the last message
  const { message, id: chatId } = await request.json() as {
    message: UIMessage;
    id: string;
  };

  // Load conversation to get modelId and verify ownership
  const convo = await getConversation(chatId);
  if (!convo || convo.userId !== auth.userId) {
    return new Response("Conversation not found", { status: 404 });
  }

  // Load previous messages from storage
  const previousMessages = await loadChat(chatId);

  // Append new message to previous messages
  const messages = [...previousMessages, message];

  // Stream AI response
  const result = streamText({
    model: buildItNow(convo.modelId),
    messages: convertToModelMessages(messages),
  });

  // Consume stream to ensure it runs to completion even if client disconnects
  result.consumeStream();

  // Return streaming response in UIMessage format for useChat
  // Use consumeSseStream for resumable streams
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    // Generate consistent server-side IDs for persistence
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
    // Attach token usage metadata to the assistant message at different stages
    messageMetadata: ({ part }) => {
      // Send model info and timestamp when streaming starts
      if (part.type === "start") {
        return {
          createdAt: Date.now(),
          model: convo.modelId,
        };
      }

      // Send token usage when streaming completes
      if (part.type === "finish") {
        return {
          totalTokens: part.totalUsage.totalTokens,
          promptTokens: part.totalUsage.promptTokens,
          completionTokens: part.totalUsage.completionTokens,
        };
      }
    },
    onFinish: ({ messages: updatedMessages }) => {
      // Clear active stream and save all messages
      saveChat({ chatId, messages: updatedMessages, activeStreamId: null });
      // Clean up stream file
      deleteStreamFile(chatId);
    },
    async consumeSseStream({ stream }) {
      const streamId = generateId();

      // Store stream chunks to file for resumption
      await createResumableStream(chatId, streamId, stream);

      // Track active stream in conversation
      await saveChat({ chatId, activeStreamId: streamId });
    },
  });
}
```

---

## Resumable Stream Storage

Since this template uses OPFS instead of Redis, we implement resumable streams with file-based storage. Stream chunks are written to newline-delimited JSON files.

> **Important**: Stream resumption is not compatible with abort functionality. Closing a tab or refreshing the page triggers an abort signal that will break the resumption mechanism. Do not use `resume: true` if you need abort functionality in your application.

```typescript
// backend/stream-store.ts
import { readJsonFile, writeJsonFile, deleteJsonFile } from "./storage";

// Store for tracking stream writers
const activeStreams = new Map<string, WritableStreamDefaultWriter<Uint8Array>>();

// Create a resumable stream by writing chunks to a file
export async function createResumableStream(
  chatId: string,
  streamId: string,
  stream: ReadableStream<Uint8Array>
): Promise<void> {
  const root = await getDirectory("/data");
  const streamsDir = await root.getDirectoryHandle("streams", { create: true });
  const fileHandle = await streamsDir.getFileHandle(`${streamId}.ndjson`, { create: true });
  const writable = await fileHandle.createWritable();
  const writer = writable.getWriter();

  // Track this stream
  activeStreams.set(streamId, writer);

  // Read from source stream and write to file
  const reader = stream.getReader();
  const encoder = new TextEncoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Write chunk as a line (base64 encoded to handle binary data)
      const base64Chunk = btoa(String.fromCharCode(...value));
      await writer.write(encoder.encode(base64Chunk + "\n"));
    }
  } finally {
    activeStreams.delete(streamId);
    await writer.close();
  }
}

// Resume a stream from stored chunks
export async function resumeStream(streamId: string): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const root = await getDirectory("/data");
    const streamsDir = await root.getDirectoryHandle("streams", { create: false });
    const fileHandle = await streamsDir.getFileHandle(`${streamId}.ndjson`, { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();

    if (!text) return null;

    // Parse stored chunks and create a new stream
    const lines = text.trim().split("\n").filter(Boolean);

    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of lines) {
          // Decode base64 chunk
          const decoded = atob(line);
          const bytes = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
          }
          controller.enqueue(bytes);
        }
        controller.close();
      },
    });
  } catch {
    return null;
  }
}

// Delete stream file after completion
export async function deleteStreamFile(chatId: string): Promise<void> {
  const convo = await readJsonFile<{ activeStreamId: string | null }>(`conversations/${chatId}.json`);
  if (!convo?.activeStreamId) return;

  try {
    const root = await getDirectory("/data");
    const streamsDir = await root.getDirectoryHandle("streams", { create: false });
    await streamsDir.removeEntry(`${convo.activeStreamId}.ndjson`);
  } catch {
    // File doesn't exist, ignore
  }
}
```

---

## Resume Stream Endpoint

The GET endpoint at `/chat/:id/stream` allows clients to resume an active stream after reconnection.

```typescript
// backend/chat-resume.ts
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { getConversation } from "./chat-store";
import { resumeStream } from "./stream-store";
import { authenticateRequest } from "./auth";

// GET /chat/:id/stream - Resume active stream endpoint
export async function handleResumeStream(
  request: Request,
  chatId: string
): Promise<Response> {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Load conversation to get active stream ID
  const convo = await getConversation(chatId);
  if (!convo || convo.userId !== auth.userId) {
    return new Response("Conversation not found", { status: 404 });
  }

  // Check if there's an active stream
  if (!convo.activeStreamId) {
    // Return 204 No Content when there's no active stream
    return new Response(null, { status: 204 });
  }

  // Resume the stream from stored chunks
  const stream = await resumeStream(convo.activeStreamId);
  if (!stream) {
    // Stream file not found, clear the stale reference
    return new Response(null, { status: 204 });
  }

  return new Response(stream, {
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}
```

---

## Completion Endpoint (for useCompletion)

The `useCompletion` hook is for simple text completions - single prompt, single response. Unlike `useChat`, it doesn't maintain a conversation history. Useful for autocomplete, summarization, or one-shot prompts.

```typescript
// backend/completion.ts
import { streamText } from "ai";
import { buildItNow } from "@/ai-sdk-provider";
import { authenticateRequest } from "./auth";

// POST /chat/completion - Streaming completion endpoint for useCompletion hook
export async function handleCompletion(request: Request): Promise<Response> {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse request body (useCompletion sends { prompt, ... })
  const { prompt, modelId } = await request.json() as {
    prompt: string;
    modelId?: string;
  };

  if (!prompt) {
    return new Response("Prompt is required", { status: 400 });
  }

  // Use provided model or default
  const model = modelId || "claude-sonnet-4-5-20250929";

  // Stream AI response
  const result = streamText({
    model: buildItNow(model),
    prompt,
  });

  // Consume stream to ensure it runs to completion even if client disconnects
  result.consumeStream();

  // Return streaming response for useCompletion
  return result.toUIMessageStreamResponse();
}
```

---

## Server Entry Point

```typescript
// backend/server.ts
import { router } from "./router";
import { handleChatStream } from "./chat-stream";
import { handleResumeStream } from "./chat-resume";
import { handleCompletion } from "./completion";
import { auth } from "./auth";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle Better Auth routes (/auth/*)
    if (url.pathname.startsWith("/auth")) {
      return auth.handler(request);
    }

    // Handle streaming chat endpoint (useChat POST)
    // Note: /chat routes are separate from /api (RPC) routes
    if (url.pathname === "/chat" && request.method === "POST") {
      return handleChatStream(request);
    }

    // Handle stream resume endpoint (useChat GET with resume: true)
    // Pattern: /chat/{id}/stream
    const streamMatch = url.pathname.match(/^\/chat\/([^/]+)\/stream$/);
    if (streamMatch && request.method === "GET") {
      const chatId = streamMatch[1];
      return handleResumeStream(request, chatId);
    }

    // Handle completion endpoint (useCompletion)
    if (url.pathname === "/chat/completion" && request.method === "POST") {
      return handleCompletion(request);
    }

    // Handle RPC routes (/api/*)
    return router.handle(request);
  },
};
```

---

## Frontend with useChat Hook

### Chat View with Streaming

```tsx
// frontend/routes/chat/$id.tsx
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/api";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef } from "react";
import { IconSend, IconRobot, IconUser } from "@tabler/icons-react";
import env from "@/env";
import type { ChatMessage } from "@/shared/types";

export const Route = createFileRoute("/chat/$id")({
  component: ChatView,
});

function ChatView() {
  const { id } = Route.useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversation metadata and initial messages
  const { data: convoData, isLoading } = api.getConversation.useQuery({ id });

  // useChat hook for streaming messages with resumable streams
  // Use ChatMessage type for metadata support
  const {
    messages,
    sendMessage,
    input,
    setInput,
    status,
    error,
  } = useChat<ChatMessage>({
    id, // use the conversation ID
    messages: convoData?.messages, // load initial messages from server
    resume: true, // Enable automatic stream resumption on page reload
    transport: new DefaultChatTransport({
      api: env.API_BASE_URL + "/chat",
      // Only send the last message to the server (we load previous from storage)
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } };
      },
      // Custom resume endpoint
      prepareReconnectToStreamRequest({ id }) {
        return {
          api: env.API_BASE_URL + `/chat/${id}/stream`,
          credentials: "include",
        };
      },
    }),
  });

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status !== "streaming") {
      sendMessage({ text: input });
      setInput("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!convoData) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Conversation not found
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <h1 className="text-white font-medium">{convoData.conversation.title}</h1>
        <p className="text-xs text-gray-400">{convoData.conversation.modelId}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            Start a conversation by typing a message below
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <IconRobot size={18} className="text-white" />
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
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
                  }
                  return null;
                })}
              </div>

              {/* Token usage metadata (assistant messages only) */}
              {message.role === "assistant" && message.metadata?.totalTokens && (
                <div className="mt-1 text-xs text-gray-500 px-2">
                  {message.metadata.totalTokens} tokens
                  {message.metadata.createdAt && (
                    <span className="ml-2">
                      {new Date(message.metadata.createdAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>
            {message.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                <IconUser size={18} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming indicator */}
        {status === "streaming" && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <IconRobot size={18} className="text-white" />
            </div>
            <div className="bg-gray-700 px-4 py-3 rounded-2xl">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-center py-2">
            Error: {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={status === "streaming"}
          />
          <button
            type="submit"
            disabled={!input.trim() || status === "streaming"}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <IconSend size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## Starting a New Chat (Redirect Pattern)

```tsx
// frontend/routes/chat/new.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "@/api";
import { useEffect } from "react";

export const Route = createFileRoute("/chat/new")({
  component: NewChat,
});

function NewChat() {
  const navigate = useNavigate();
  const createConversation = api.createConversation.useMutation();
  const { data: models } = api.getModels.useQuery();

  useEffect(() => {
    // Create a new chat with the first available model and redirect
    const defaultModel = models?.[0]?.modelId ?? "claude-sonnet-4-5-20250929";
    createConversation.mutateAsync({ modelId: defaultModel }).then((result) => {
      navigate({ to: `/chat/${result.id}` });
    });
  }, [models]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
}
```

---

## Frontend with useCompletion Hook

The `useCompletion` hook is for simple single-prompt completions. Unlike `useChat`, it doesn't maintain multi-turn conversation history.

### Basic Completion Example

```tsx
// frontend/components/completion-demo.tsx
'use client';

import { useCompletion } from "@ai-sdk/react";
import { useState } from "react";
import env from "@/env";

export function CompletionDemo() {
  const [modelId, setModelId] = useState("claude-sonnet-4-5-20250929");

  const {
    completion,        // The streamed completion text
    input,             // Current input value
    handleInputChange, // Input change handler
    handleSubmit,      // Form submit handler
    isLoading,         // True while streaming
    error,             // Error object if request failed
    stop,              // Function to abort the stream
    setInput,          // Manually set input value
  } = useCompletion({
    api: env.API_BASE_URL + "/chat/completion",
    body: {
      modelId, // Pass model selection to backend
    },
  });

  return (
    <div className="p-6 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Enter a prompt..."
          rows={3}
          className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg resize-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
          >
            {isLoading ? "Generating..." : "Generate"}
          </button>
          {isLoading && (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Stop
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="text-red-400 p-3 bg-red-900/20 rounded-lg">
          Error: {error.message}
        </div>
      )}

      {completion && (
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="text-sm text-gray-400 mb-2">Completion:</h3>
          <p className="text-white whitespace-pre-wrap">{completion}</p>
        </div>
      )}
    </div>
  );
}
```

### Autocomplete Example

```tsx
// frontend/components/autocomplete-input.tsx
import { useCompletion } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import env from "@/env";

export function AutocompleteInput() {
  const [value, setValue] = useState("");

  const { completion, complete, isLoading } = useCompletion({
    api: env.API_BASE_URL + "/chat/completion",
    body: {
      modelId: "claude-sonnet-4-5-20250929",
    },
  });

  // Debounce autocomplete requests
  const debouncedComplete = useDebouncedCallback((text: string) => {
    if (text.length > 10) {
      complete(`Complete this text naturally: "${text}". Only output the completion, not the original text.`);
    }
  }, 500);

  useEffect(() => {
    debouncedComplete(value);
  }, [value, debouncedComplete]);

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Start typing..."
        rows={5}
        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg"
      />
      {isLoading && (
        <span className="absolute bottom-2 right-2 text-gray-400 text-sm">
          Thinking...
        </span>
      )}
      {completion && !isLoading && (
        <div className="mt-2 p-3 bg-gray-800 rounded-lg">
          <span className="text-gray-400">Suggestion: </span>
          <span className="text-blue-400">{completion}</span>
          <button
            onClick={() => setValue(value + completion)}
            className="ml-2 text-sm text-blue-500 hover:underline"
          >
            Accept
          </button>
        </div>
      )}
    </div>
  );
}
```

### Completion with Custom Request

```tsx
// Using controlled input with custom body data
import env from "@/env";

const { completion, complete, isLoading } = useCompletion({
  api: env.API_BASE_URL + "/chat/completion",
});

// Trigger completion programmatically with custom body
const handleSummarize = async (text: string) => {
  await complete(`Summarize this in 2-3 sentences: ${text}`, {
    body: {
      modelId: "claude-sonnet-4-5-20250929",
      // Additional custom fields
    },
  });
};
```

### Event Callbacks

```tsx
import env from "@/env";

const { ... } = useCompletion({
  api: env.API_BASE_URL + "/chat/completion",
  onResponse: (response) => {
    console.log("Received response:", response.status);
  },
  onFinish: (prompt, completion) => {
    console.log("Finished! Prompt:", prompt);
    console.log("Completion:", completion);
    // Save to history, analytics, etc.
  },
  onError: (error) => {
    console.error("Error:", error);
    toast.error(error.message);
  },
});
```

### Throttling UI Updates

```tsx
// Reduce re-renders during streaming
import env from "@/env";

const { completion, ... } = useCompletion({
  api: env.API_BASE_URL + "/chat/completion",
  experimental_throttle: 50, // Throttle updates to every 50ms
});
```

---

## Better Auth Setup

Uses a simple username-only authentication. User enters a unique username - if it exists they're signed in, otherwise a new account is created.

```typescript
// backend/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import db from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  plugins: [
    username(), // Enable username-based auth
  ],
});

// Helper to authenticate requests
export async function authenticateRequest(request: Request): Promise<{ userId: string } | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    return null;
  }

  return { userId: session.user.id };
}
```

```typescript
// shared/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import env from "@/env";

export const authClient = createAuthClient({
  baseURL: env.API_BASE_URL + "/auth",
  plugins: [usernameClient()],
});

export const { useSession } = authClient;

// Sign in or sign up with just a username
export async function signInWithUsername(username: string) {
  // Try to sign in first
  const signInResult = await authClient.signIn.username({
    username,
    password: username, // Use username as password for simplicity
  });

  if (signInResult.data) {
    return signInResult;
  }

  // If sign in failed, try to sign up
  const signUpResult = await authClient.signUp.username({
    username,
    password: username, // Use username as password for simplicity
    name: username,
  });

  return signUpResult;
}

export async function signOut() {
  return authClient.signOut();
}
```

---

## Database Schema (for Better Auth only)

SQLite is still used for Better Auth user/session management, but conversations are stored as JSON files.

```typescript
// backend/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// User table (managed by Better Auth with username plugin)
export const userTable = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(), // Username for auth
  email: text("email"), // Optional, not used for auth
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// Session table for better-auth
export const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

// Account table for OAuth providers
export const accountTable = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// Verification table for magic links
export const verificationTable = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});
```

---

## Frontend Structure

### Route Tree

```
frontend/
├── entry.tsx           # App entry with providers
├── routes/
│   ├── __root.tsx      # Root layout
│   ├── index.tsx       # Login page (username input)
│   ├── chat/
│   │   ├── index.tsx   # Chat layout with sidebar
│   │   ├── new.tsx     # Create new chat and redirect
│   │   └── $id.tsx     # Individual chat view with streaming
```

### Components

```
frontend/
├── components/
│   ├── sidebar.tsx           # Conversations list sidebar
│   ├── chat-view.tsx         # Main chat interface with useChat
│   ├── message.tsx           # Single message bubble
│   ├── chat-input.tsx        # Message input with send button
│   ├── model-selector.tsx    # Model dropdown
│   ├── new-chat-button.tsx   # Create new conversation
│   └── auth-form.tsx         # Username input form
```

---

## Login Page (Username Only)

```tsx
// frontend/routes/index.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithUsername, useSession } from "@/shared/auth-client";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { data: session } = useSession();

  // Redirect if already logged in
  useEffect(() => {
    if (session?.user) {
      navigate({ to: "/chat" });
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithUsername(username.trim());
      if (result.error) {
        setError(result.error.message || "Failed to sign in");
      } else {
        navigate({ to: "/chat" });
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AI Chat</h1>
          <p className="text-gray-400">Enter your username to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? "Signing in..." : "Continue"}
          </button>
        </form>

        <p className="text-gray-500 text-sm text-center mt-6">
          New username? We'll create an account for you.
        </p>
      </div>
    </div>
  );
}
```

---

## Chat Layout with Sidebar

```tsx
// frontend/routes/chat/index.tsx
import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { api } from "@/api";
import { useSession, signOut } from "@/shared/auth-client";
import { useState } from "react";
import { IconPlus, IconMessage, IconTrash, IconLogout } from "@tabler/icons-react";
import env from "@/env";

export const Route = createFileRoute("/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-5-20250929");

  // Redirect if not logged in
  if (!session?.user) {
    navigate({ to: "/" });
    return null;
  }

  const { data: conversations, refetch } = api.listConversations.useQuery();
  const { data: models } = api.getModels.useQuery();
  const createConversation = api.createConversation.useMutation();
  const deleteConversation = api.deleteConversation.useMutation();

  const handleNewChat = async () => {
    const result = await createConversation.mutateAsync({
      modelId: selectedModel,
    });
    refetch();
    navigate({ to: `/chat/${result.id}` });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteConversation.mutateAsync({ id });
    refetch();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="h-screen flex bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <IconPlus size={18} />
            New Chat
          </button>
        </div>

        {/* Model Selector */}
        <div className="p-4 border-b border-gray-700">
          <label className="text-xs text-gray-400 mb-1 block">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm"
          >
            {models?.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations?.map((convo) => (
            <Link
              key={convo.id}
              to={`/chat/${convo.id}`}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-700 rounded-lg group"
            >
              <IconMessage size={16} />
              <span className="flex-1 truncate text-sm">{convo.title}</span>
              <button
                onClick={(e) => handleDelete(convo.id, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
              >
                <IconTrash size={14} />
              </button>
            </Link>
          ))}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <span className="text-gray-400 text-sm truncate">{session.user.name}</span>
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-white"
          >
            <IconLogout size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
```

---

## Implementation Steps

### Phase 1: Setup & Auth
1. Create schema.ts with Better Auth tables (including username field)
2. Set up Better Auth with username plugin
3. Create auth-client.ts with signInWithUsername helper
4. Create landing page with simple username input form
5. Set up storage.ts with OPFS helpers

### Phase 2: Core Chat (File Storage)
1. Create chat-store.ts with createChat, loadChat, saveChat helpers
2. Create contract.ts with all API endpoints
3. Implement router.ts with file-based storage
4. Create chat layout with sidebar
5. Implement conversation list in sidebar
6. Create new chat functionality

### Phase 3: Streaming Messages
1. Implement chat-stream.ts with streamText and UIMessage persistence
2. Add server.ts routing for /chat endpoints
3. Create chat view with useChat hook and DefaultChatTransport
4. Use prepareSendMessagesRequest to only send last message
5. Add loading states and error handling
6. Handle client disconnects with consumeStream

### Phase 4: Polish
1. Add model selector
2. Implement conversation deletion
3. Auto-generate titles from first message
4. Add responsive design for mobile
5. Add keyboard shortcuts (Enter to send)

---

## Key Features of AI SDK Integration

| Feature | Implementation |
|---------|----------------|
| Chat (multi-turn) | `useChat` hook with `UIMessage[]` format |
| Completions (single-prompt) | `useCompletion` hook for one-shot prompts |
| Streaming | `toUIMessageStreamResponse()` for both hooks |
| Persistence | `onFinish` callback saves messages (chat only) |
| Client Disconnect | `consumeStream()` ensures completion |
| ID Generation | `createIdGenerator()` for server-side IDs |
| Last Message Only | `prepareSendMessagesRequest` optimization |
| Conversion | `convertToModelMessages()` for LLM input |
| Resumable Streams | `resume: true` + `consumeSseStream` callback |
| Stream Resume Endpoint | GET `/chat/:id/stream` returns 204 or stream |
| Token Usage Tracking | `messageMetadata` callback with `part.type` stages |

---

## Future Enhancements

- [ ] Message regeneration (re-run last assistant message)
- [ ] Export conversations as markdown
- [ ] System prompt customization per conversation
- [ ] Dark/light theme toggle
- [ ] Search through conversations
- [ ] Share conversations via link
- [ ] Tool calling support with validation
