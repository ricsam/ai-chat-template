// Knowledge Base Upload Handler - multipart file upload for documents with background processing
import { authenticateRequest } from "./auth";
import { processFile } from "./document-processor";
import { generateEmbeddings } from "./embedding";
import db from "@/db";
import { documentsTable, embeddingsTable } from "./schema";
import { eq } from "drizzle-orm";

// Supported file types
const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Upload response type for each file
interface UploadResult {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: "pending" | "processing" | "indexed" | "failed";
}

// Background processing function
async function processDocumentAsync(docId: string, file: File) {
  try {
    // Update status to processing
    await db
      .update(documentsTable)
      .set({ status: "processing" })
      .where(eq(documentsTable.id, docId));

    // Process document with Docling
    const { markdownContent, chunks } = await processFile(file);

    // Generate embeddings for chunks
    const embeddingsData = await generateEmbeddings(chunks);

    // Save embeddings to database
    if (embeddingsData.length > 0) {
      await db.insert(embeddingsTable).values(
        embeddingsData.map((e) => ({
          documentId: docId,
          content: e.content,
          blockType: e.blockType,
          pageNumber: e.pageNumber,
          embedding: e.embedding,
        }))
      );
    }

    // Update document as indexed
    await db
      .update(documentsTable)
      .set({
        status: "indexed",
        markdownContent,
        chunksCount: embeddingsData.length,
      })
      .where(eq(documentsTable.id, docId));

    console.log(`Document ${docId} indexed successfully with ${embeddingsData.length} chunks`);
  } catch (error) {
    console.error(`Document ${docId} processing failed:`, error);

    // Update document as failed
    await db
      .update(documentsTable)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Processing failed",
      })
      .where(eq(documentsTable.id, docId));
  }
}

// Handle document upload endpoint - supports multiple files
export async function handleDocumentUpload(request: Request): Promise<Response> {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();

    // Support both single file ("file") and multiple files ("files")
    const files: File[] = [];
    const singleFile = formData.get("file") as File | null;
    if (singleFile) {
      files.push(singleFile);
    }
    const multipleFiles = formData.getAll("files") as File[];
    files.push(...multipleFiles);

    if (files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results: UploadResult[] = [];
    const errors: { fileName: string; error: string }[] = [];

    for (const file of files) {
      // Validate file type
      if (!SUPPORTED_TYPES.includes(file.type)) {
        errors.push({
          fileName: file.name,
          error: `Unsupported file type: ${file.type}`,
        });
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          fileName: file.name,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        });
        continue;
      }

      // Insert document with pending status
      const docId = crypto.randomUUID();
      await db.insert(documentsTable).values({
        id: docId,
        userId: auth.userId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        markdownContent: null,
        status: "pending",
        createdAt: new Date(),
      });

      results.push({
        id: docId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        status: "pending",
      });

      // Process in background (fire-and-forget)
      processDocumentAsync(docId, file);
    }

    // Return response with results and any errors
    const response = {
      documents: results,
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Document upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process upload";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
