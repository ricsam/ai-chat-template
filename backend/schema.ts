import { pgTable, text, timestamp, boolean, integer, index, vector } from "drizzle-orm/pg-core";

// User table (managed by Better Auth with credentials plugin)
export const userTable = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  // Credentials plugin field
  username: text("username").notNull().unique(),
});

// Session table for better-auth
export const sessionTable = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

// Account table for OAuth providers
export const accountTable = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// Verification table for tokens
export const verificationTable = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// Documents table - stores uploaded files and metadata for knowledge base
export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  markdownContent: text("markdown_content"),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'indexed' | 'failed'
  error: text("error"), // Error message if failed
  chunksCount: integer("chunks_count"), // Number of chunks created after indexing
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
});

// Embeddings table - stores chunks with pgvector for semantic search
export const embeddingsTable = pgTable("embeddings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  documentId: text("document_id").notNull().references(() => documentsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  blockType: text("block_type"),
  pageNumber: integer("page_number"),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
});
