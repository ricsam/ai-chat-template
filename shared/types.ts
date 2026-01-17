import { z } from "zod";

// Schema for message metadata (token usage, timestamps, model info)
export const messageMetadataSchema = z.object({
  createdAt: z.number().optional(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;
