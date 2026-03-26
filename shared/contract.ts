import { defineContract, Status } from "@richie-rpc/core";
import { z } from "zod";

const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  modelId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const DocumentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  createdAt: z.string(),
  status: z.enum(["pending", "processing", "indexed", "failed"]),
});

const authErrorSchema = z.object({
  error: z.string(),
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
    errorResponses: {
      [Status.Unauthorized]: authErrorSchema,
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
    },
    errorResponses: {
      [Status.NotFound]: z.object({ error: z.string() }),
      [Status.Unauthorized]: authErrorSchema,
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
    errorResponses: {
      [Status.Unauthorized]: authErrorSchema,
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
    },
    errorResponses: {
      [Status.NotFound]: z.object({ error: z.string() }),
      [Status.Unauthorized]: authErrorSchema,
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
    },
    errorResponses: {
      [Status.NotFound]: z.object({ error: z.string() }),
      [Status.Unauthorized]: authErrorSchema,
    },
  },

  // Knowledge Base - List documents
  listDocuments: {
    type: "standard",
    method: "GET",
    path: "/knowledge-base/documents",
    responses: {
      [Status.OK]: z.array(DocumentSchema),
    },
    errorResponses: {
      [Status.Unauthorized]: authErrorSchema,
    },
  },

  // Knowledge Base - Delete document
  deleteDocument: {
    type: "standard",
    method: "DELETE",
    path: "/knowledge-base/documents/:id",
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.object({ success: z.boolean() }),
    },
    errorResponses: {
      [Status.NotFound]: z.object({ error: z.string() }),
      [Status.Unauthorized]: authErrorSchema,
    },
  },

  // Knowledge Base - Get single document with details
  getDocument: {
    type: "standard",
    method: "GET",
    path: "/knowledge-base/documents/:id",
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.object({
        id: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        markdownContent: z.string().nullable(),
        createdAt: z.string(),
        status: z.enum(["pending", "processing", "indexed", "failed"]),
        error: z.string().nullable(),
        chunksCount: z.number().nullable(),
      }),
    },
    errorResponses: {
      [Status.NotFound]: z.object({ error: z.string() }),
      [Status.Unauthorized]: authErrorSchema,
    },
  },

  // Knowledge Base - Get document chunks
  getDocumentChunks: {
    type: "standard",
    method: "GET",
    path: "/knowledge-base/documents/:id/chunks",
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.array(z.object({
        id: z.string(),
        content: z.string(),
        blockType: z.string().nullable(),
        pageNumber: z.number().nullable(),
      })),
    },
    errorResponses: {
      [Status.NotFound]: z.object({ error: z.string() }),
      [Status.Unauthorized]: authErrorSchema,
    },
  },
});
