// RPC Router - Implements the contract with file-based storage
import { createRouter, Status } from "@richie-rpc/server";
import { contract } from "@/shared/contract";
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
        if (model.modelId.startsWith("gpt-") || model.modelId.startsWith("o1-") || model.modelId.startsWith("o3-")) {
          provider = "openai";
        } else if (model.modelId.startsWith("gemini-")) {
          provider = "google";
        } else if (model.modelId.startsWith("deepseek-")) {
          provider = "deepseek";
        }

        return {
          modelId: model.modelId,
          displayName: model.displayName,
          thinking: model.thinking,
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
  },
  {
    // Note: The serve script strips the /api prefix before sending to backend
    // So paths arrive as /conversations, /models, etc. - no basePath needed
    basePath: "",
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
