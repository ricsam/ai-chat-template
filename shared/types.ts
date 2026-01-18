import { z } from "zod";

// Schema for file attachment metadata
export const fileAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.number(),
});

export type FileAttachment = z.infer<typeof fileAttachmentSchema>;

// Schema for message metadata (token usage, timestamps, model info)
export const messageMetadataSchema = z.object({
  createdAt: z.number().optional(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
  thinkingEnabled: z.boolean().optional(),
  files: z.array(fileAttachmentSchema).optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;
