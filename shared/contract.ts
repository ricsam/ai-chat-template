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
        thinking: z.boolean(),
        provider: z.string(),
        maxTokens: z.number().optional(),
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

  // Get single conversation with messages
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
});
