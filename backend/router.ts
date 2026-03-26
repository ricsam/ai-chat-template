// RPC Router - Implements the contract with file-based storage
import { createRouter, Status } from "@richie-rpc/server";
import { contract } from "@/shared/contract";
import env from "@/env";
import { getModels } from "@/ai-sdk-provider";
import {
  createChat,
  getConversation,
  deleteChat,
  listChats,
  type ConversationFile,
} from "./chat-store";
import { readJsonFile, writeJsonFile } from "./storage";
import { authenticateRequest } from "./auth";
import db from "@/db";
import { documentsTable, embeddingsTable } from "./schema";
import { eq, and, desc } from "drizzle-orm";

const baseUrl = new URL(env.BASE_URL);
const basePathname = baseUrl.pathname === "/" ? "" : baseUrl.pathname;

interface RouterContext {
  getUserId: () => string;
}

export const router = createRouter<typeof contract, RouterContext>(
  contract,
  {
    // Get available AI models
    getModels: async () => {
      const models = await getModels();
      // Map models to include provider (inferred from model ID)
      const mappedModels = models.map((model) => {
        // Infer provider from model ID
        let provider = "anthropic";
        const executableModelId = model.executableModelId.toLowerCase();
        if (executableModelId.startsWith("gpt-") || executableModelId.startsWith("o1-") || executableModelId.startsWith("o3-")) {
          provider = "openai";
        } else if (executableModelId.startsWith("gemini-")) {
          provider = "google";
        } else if (executableModelId.startsWith("deepseek-")) {
          provider = "deepseek";
        }

        const providerOptions = model.providerOptions as { thinking?: unknown } | undefined;
        const thinking = provider === "anthropic" && providerOptions?.thinking !== undefined && providerOptions.thinking !== false;

        return {
          modelId: model.modelId,
          displayName: model.displayName,
          thinking,
          provider,
          maxTokens: model.contextWindow,
        };
      });
      return { status: Status.OK, body: mappedModels };
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

    // Knowledge Base - List documents
    listDocuments: async ({ context }) => {
      const userId = context.getUserId();
      const documents = await db
        .select({
          id: documentsTable.id,
          fileName: documentsTable.fileName,
          fileType: documentsTable.fileType,
          fileSize: documentsTable.fileSize,
          status: documentsTable.status,
          createdAt: documentsTable.createdAt,
        })
        .from(documentsTable)
        .where(eq(documentsTable.userId, userId))
        .orderBy(desc(documentsTable.createdAt));

      return {
        status: Status.OK,
        body: documents.map((doc) => ({
          id: doc.id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          createdAt: doc.createdAt.toISOString(),
          status: doc.status as "pending" | "processing" | "indexed" | "failed",
        })),
      };
    },

    // Knowledge Base - Delete document
    deleteDocument: async ({ params, context }) => {
      const userId = context.getUserId();

      // Check if document exists and belongs to user
      const [doc] = await db
        .select({ id: documentsTable.id })
        .from(documentsTable)
        .where(and(eq(documentsTable.id, params.id), eq(documentsTable.userId, userId)))
        .limit(1);

      if (!doc) {
        return { status: Status.NotFound, body: { error: "Document not found" } };
      }

      // Delete document (embeddings will cascade delete)
      await db.delete(documentsTable).where(eq(documentsTable.id, params.id));

      return { status: Status.OK, body: { success: true } };
    },

    // Knowledge Base - Get single document with details
    getDocument: async ({ params, context }) => {
      const userId = context.getUserId();
      const [doc] = await db
        .select()
        .from(documentsTable)
        .where(and(eq(documentsTable.id, params.id), eq(documentsTable.userId, userId)))
        .limit(1);

      if (!doc) {
        return { status: Status.NotFound, body: { error: "Document not found" } };
      }

      return {
        status: Status.OK,
        body: {
          id: doc.id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          markdownContent: doc.markdownContent,
          createdAt: doc.createdAt.toISOString(),
          status: doc.status as "pending" | "processing" | "indexed" | "failed",
          error: doc.error,
          chunksCount: doc.chunksCount,
        },
      };
    },

    // Knowledge Base - Get document chunks
    getDocumentChunks: async ({ params, context }) => {
      const userId = context.getUserId();

      // First verify the document exists and belongs to user
      const [doc] = await db
        .select({ id: documentsTable.id })
        .from(documentsTable)
        .where(and(eq(documentsTable.id, params.id), eq(documentsTable.userId, userId)))
        .limit(1);

      if (!doc) {
        return { status: Status.NotFound, body: { error: "Document not found" } };
      }

      // Fetch chunks for this document
      const chunks = await db
        .select({
          id: embeddingsTable.id,
          content: embeddingsTable.content,
          blockType: embeddingsTable.blockType,
          pageNumber: embeddingsTable.pageNumber,
        })
        .from(embeddingsTable)
        .where(eq(embeddingsTable.documentId, params.id));

      return {
        status: Status.OK,
        body: chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          blockType: chunk.blockType,
          pageNumber: chunk.pageNumber,
        })),
      };
    },
  },
  {
    basePath: basePathname + "/api/router",
    async context(request) {
      const auth = await authenticateRequest(request);
      if (!auth) {
        return {
          getUserId() {
            throw new UnauthorizedError();
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

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}
