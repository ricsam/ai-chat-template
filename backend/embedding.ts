// Embedding logic for RAG knowledge base
import { embed, embedMany } from "ai";
import { buildItNow } from "@/ai-sdk-provider";
import db from "@/db";
import { embeddingsTable, documentsTable } from "./schema";
import { cosineDistance, desc, gt, sql, eq, and } from "drizzle-orm";

// Chunk type for embedding generation
export interface Chunk {
  text: string;
  blockType?: string;
  pageNumber?: number;
}

// Embedding result type
export interface EmbeddingResult {
  content: string;
  blockType?: string;
  pageNumber?: number;
  embedding: number[];
}

// Search result type
export interface SearchResult {
  documentId: string;
  fileName: string;
  content: string;
  similarity: number;
  pageNumber: number | null;
  blockType: string | null;
}

// Generate embeddings for an array of text chunks
export async function generateEmbeddings(chunks: Chunk[]): Promise<EmbeddingResult[]> {
  if (chunks.length === 0) {
    return [];
  }

  const texts = chunks.map((c) => c.text);
  const { embeddings } = await embedMany({
    model: buildItNow.textEmbeddingModel(),
    values: texts,
  });

  return chunks.map((chunk, i) => ({
    content: chunk.text,
    blockType: chunk.blockType,
    pageNumber: chunk.pageNumber,
    embedding: embeddings[i]!,
  }));
}

// Find relevant content for a query using cosine similarity
export async function findRelevantContent(
  userId: string,
  query: string,
  limit = 5,
  similarityThreshold = 0.3
): Promise<SearchResult[]> {
  const { embedding: queryEmbedding } = await embed({
    model: buildItNow.textEmbeddingModel(),
    value: query,
  });

  const similarity = sql<number>`1 - (${cosineDistance(embeddingsTable.embedding, queryEmbedding)})`;

  const results = await db
    .select({
      documentId: embeddingsTable.documentId,
      fileName: documentsTable.fileName,
      content: embeddingsTable.content,
      pageNumber: embeddingsTable.pageNumber,
      blockType: embeddingsTable.blockType,
      similarity,
    })
    .from(embeddingsTable)
    .innerJoin(documentsTable, eq(embeddingsTable.documentId, documentsTable.id))
    .where(and(eq(documentsTable.userId, userId), gt(similarity, similarityThreshold)))
    .orderBy(desc(similarity))
    .limit(limit);

  return results;
}
