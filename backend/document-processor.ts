// Document processing with Docling for knowledge base
import { docling } from "@/docling";
import type { Chunk } from "./embedding";


// Document processing result
export interface ProcessedDocument {
  markdownContent: string;
  chunks: Chunk[];
}

// Process uploaded file with Docling and extract chunks
export async function processDocument(file: File): Promise<ProcessedDocument> {
  const result = await docling(file);

  // Get markdown content from first document
  const markdownContent = result.documents[0]?.markdown || "";

  // Convert Docling chunks to our Chunk format
  const chunks: Chunk[] = result.chunks
    .filter((chunk) => chunk.text && chunk.text.trim().length > 10)
    .map((chunk) => ({
      text: chunk.text.trim(),
      blockType: chunk.headings?.length ? "section" : "paragraph",
      pageNumber: chunk.pageNumbers?.[0] ?? 1,
    }));

  return { markdownContent, chunks };
}

// Process plain text file (txt, md)
export async function processTextFile(file: File): Promise<ProcessedDocument> {
  const text = await file.text();
  const chunks: Chunk[] = [];

  // Split by paragraphs
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 10);

  for (const paragraph of paragraphs) {
    chunks.push({
      text: paragraph.trim(),
      blockType: "paragraph",
      pageNumber: 1,
    });
  }

  return {
    markdownContent: text,
    chunks,
  };
}

// Main processing function that routes to appropriate handler
export async function processFile(file: File): Promise<ProcessedDocument> {
  const fileName = file.name.toLowerCase();

  // Plain text files can be handled directly
  if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
    return processTextFile(file);
  }

  // All other formats go through Docling
  return processDocument(file);
}
