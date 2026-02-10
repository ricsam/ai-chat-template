# AI chatbot project

The server is started on localhost:3232

* start server: `bash -c 'cd /Users/richard.samuelsson/projects/build-it-now && bun ./scripts/bun-serve.ts'`
* typcheck: `bash -c 'cd /Users/richard.samuelsson/projects/build-it-now && bun run typecheck:template ai-chatbot'`
* lint: `bash -c 'cd /Users/richard.samuelsson/projects/build-it-now && bun run lint:template ai-chatbot'`
* generate frontend routes: `bash -c 'cd /Users/richard.samuelsson/projects/build-it-now && bun scripts/generate-routes.ts ai-chatbot'`
* update migrations: `bash -c 'cd /Users/richard.samuelsson/projects/build-it-now && bun run scripts/generate-template-migrations.ts --delete-existing ai-chatbot'`


**Playwright testing:**
```bash
# Inline code
cd /Users/richard.samuelsson/projects/build-it-now

bun run scripts/run-playwright.ts --url http://localhost:3232 --code 'await page.click("button")'

# From file
bun run scripts/run-playwright.ts --url http://localhost:3232 --file ./test-script.ts

# Heredoc (multi-line)
bun run scripts/run-playwright.ts --url http://localhost:3232 --file - <<'EOF'
await page.goto(url);
await expect(page).toHaveTitle(/AI Chat/);
await page.getByRole('textbox').fill('test-user');
await page.getByRole('button', { name: 'Continue' }).click();
EOF
```

### Folder Structure
```
/
├── backend/
├── frontend/
└── shared/
```

This is a virtual file system so there is no package json nor node_modules directory but the javascript and browser environment will just work.

The icon library for this project is @tabler/icons-react

To view the different shadcn and AI elements components you can browse here:
`/Users/richard.samuelsson/projects/build-it-now/src/components` but don't modify these files, they are readonly

---

## Design Guidelines

### Frontend Aesthetics

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

#### Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

#### Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

---

## Development Best Practices

### Contract Type Safety

ALWAYS preserve TypeScript's static type checking. Never use `any`.

**Backend (router.ts)** - return explicit object literals:
```typescript
// BAD: const result: any = ...; return { body: result };
// GOOD:
return { status: Status.OK, body: { id: user.id, name: user.name } };
```

**Frontend (entry.tsx)** - use contract-inferred types:
```typescript
// BAD: const payload: any = { ... };
// GOOD:
type CreateTodo = z.input<typeof contract.createTodo.body>;
const payload: CreateTodo = { title: input.trim() };
if (notes) payload.notes = notes;  // TypeScript validates optional fields
createTodo.mutate({ body: payload });

// For nested types:
type TodoItem = CreateTodo['items'][number];
const item: TodoItem = { name: name.trim() };
```

Key rules:
1. **Never use `any`** - use `z.input<typeof contract.route.body>` for request types
2. **Return explicit object literals** in router handlers - TypeScript checks against contract
3. **Run typecheck and lint after changes** - if types don't match the contract, typecheck and the linter will catch it

---

## Library Documentation

### Richie RPC - API Contract & Hooks

#### Contract Definition (shared/contract.ts)
```typescript
import { defineContract, Status } from "@richie-rpc/core";
import { z } from "zod";

export const contract = defineContract({
  // GET with path params
  getUser: {
    method: "GET",
    path: "/users/:id",
    params: z.object({ id: z.string() }),
    responses: {
      [Status.OK]: z.object({ id: z.string(), name: z.string() }),
      [Status.NotFound]: z.object({ error: z.string() }),
    },
  },
  // GET with query params
  listUsers: {
    method: "GET",
    path: "/users",
    query: z.object({ limit: z.string().optional() }),
    responses: { [Status.OK]: z.array(userSchema) },
  },
  // POST with body
  createUser: {
    method: "POST",
    path: "/users",
    body: z.object({ name: z.string(), email: z.string().email() }),
    responses: { [Status.Created]: userSchema },
  },
  // DELETE
  deleteUser: {
    method: "DELETE",
    path: "/users/:id",
    params: z.object({ id: z.string() }),
    responses: { [Status.NoContent]: z.object({}) },
  },
});
```

**Status codes:** Status.OK (200), Status.Created (201), Status.NoContent (204), Status.BadRequest (400), Status.NotFound (404)

#### Router Implementation (backend/router.ts)
```typescript
import { createRouter, Status } from "@richie-rpc/server";
import { eq } from "drizzle-orm";

export const router = createRouter(contract, {
  getUser: async ({ params }) => {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, params.id)).get();
    if (!user) return { status: Status.NotFound, body: { error: "Not found" } };
    return { status: Status.OK, body: user };
  },
  createUser: async ({ body }) => {
    const id = crypto.randomUUID();
    await db.insert(usersTable).values({ id, ...body });
    return { status: Status.Created, body: { id, ...body } };
  },
  deleteUser: async ({ params }) => {
    await db.delete(usersTable).where(eq(usersTable.id, params.id));
    return { status: Status.NoContent, body: {} };
  },
});
```

**Handler receives:** { params, query, body, headers, request }
**Handler returns:** { status: Status.X, body: ... }

#### Frontend API Setup (frontend/api.ts)
```typescript
import { createClient } from "@richie-rpc/client";
import { createTanstackQueryApi } from "@richie-rpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import { contract } from "@/shared/contract";
import env from "@/env";

// REST client - uses relative path for API calls
export const client = createClient(contract, {
  baseUrl: env.BASE_URL + "/api",
});
export const api = createTanstackQueryApi(client, contract);
export const queryClient = new QueryClient();
```

#### Frontend Hooks (import { api, queryClient } from "./api")

All hooks use a unified options object with `queryKey` and `queryData`.

**Suspense Query (GET)** - data always available:
```typescript
const { data } = api.listUsers.useSuspenseQuery({
  queryKey: ["listUsers"],
  queryData: { query: { limit: "10" } },
});
// Access: data.data (the response body)
```

**Standard Query (GET)** - with loading state:
```typescript
const { data, isLoading } = api.getUser.useQuery({
  queryKey: ["getUser", userId],
  queryData: { params: { id: userId } },
});
```

**Mutation (POST/PUT/DELETE)** - call .mutate() to trigger:
```typescript
const createUser = api.createUser.useMutation({
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listUsers"] }),
});
// Trigger: createUser.mutate({ body: { name: "Alice" } })
// For DELETE with params: deleteMutation.mutate({ params: { id: "123" } })
```

**Query invalidation after mutations:**
```typescript
queryClient.invalidateQueries({ queryKey: ["listUsers"] });
```

**Direct fetch (no React Query):**
```typescript
const result = await api.listUsers.query({ query: { limit: "10" } });
```

---

### Drizzle ORM - Postgres

#### Schema Definition (backend/schema.ts)
```typescript
import { pgTable, text, integer } from "drizzle-orm/sqlite-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
});
```

**Column types:** text(), integer(), real(), blob()
**Modifiers:** .notNull(), .primaryKey(), .default(value), .$defaultFn(() => ...), .references(() => table.id)

#### Queries
```typescript
import db from "@/db";
import { eq, ne, gt, lt, like, and, or, desc, asc } from "drizzle-orm";

// Select all
const users = await db.select().from(usersTable).all();

// Select with where
const user = await db.select().from(usersTable).where(eq(usersTable.id, "123")).get();

// Select with multiple conditions
.where(and(eq(usersTable.status, "active"), gt(usersTable.age, 18)))
.where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "mod")))

// Pattern matching
.where(like(usersTable.name, "%john%"))

// Order, limit, offset
.orderBy(desc(usersTable.createdAt)).limit(10).offset(20)

// Insert
await db.insert(usersTable).values({ name: "Alice", email: "a@b.com" });

// Update
await db.update(usersTable).set({ name: "Bob" }).where(eq(usersTable.id, "123"));

// Delete
await db.delete(usersTable).where(eq(usersTable.id, "123"));
```

**Operators:** eq, ne, gt, gte, lt, lte, like, and, or, not, isNull, isNotNull, inArray, between

---

### Backend Runtime Environment

**IMPORTANT:** The backend runs in a sandboxed environment, NOT Node.js or a browser. It has a LIMITED set of web-standard APIs. Do not assume Node.js APIs (like `fs`, `path`, `http`) or browser-only APIs exist.

#### Available Global APIs

| API | Description |
|-----|-------------|
| `fetch`, `Request`, `Response`, `Headers` | HTTP client (Fetch API) |
| `FormData`, `AbortController`, `AbortSignal` | Fetch helpers |
| `serve()` | HTTP server handler (Bun-compatible) |
| `console` | Logging (log, warn, error, time, count, group) |
| `getDirectory()` | File system access (OPFS-compatible) |
| `atob()`, `btoa()` | Base64 encoding/decoding |
| `ReadableStream`, `WritableStream`, `TransformStream` | Web Streams |
| `Blob`, `File` | Binary data handling |
| `URL`, `URLSearchParams` | URL parsing |

#### HTTP Fetch (global)
```typescript
// fetch() works like in browsers
const response = await fetch("https://api.example.com/data");
const data = await response.json();

// With options
const response = await fetch("https://api.example.com/post", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" })
});

// Request/Response objects
const request = new Request("https://example.com", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "test" }),
});

// AbortController for timeouts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
await fetch(url, { signal: controller.signal });

// FormData
const formData = new FormData();
formData.append("name", "John");
formData.append("file", new File(["content"], "file.txt"));
```

#### HTTP Server (serve)
```typescript
// The router.ts handlers are wrapped in serve() internally
// You don't call serve() directly - use the router pattern instead

// But for reference, serve() supports:
serve({
  fetch(request, server) {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      if (server.upgrade(request, { data: { userId: "123" } })) {
        return new Response(null, { status: 101 });
      }
    }

    return Response.json({ path: url.pathname });
  },
  websocket: {
    open(ws) {
      console.log("Connected:", ws.data.userId);
    },
    message(ws, message) {
      ws.send("Echo: " + message);
    },
    close(ws, code, reason) {
      console.log("Closed:", code, reason);
    }
  }
});
```

#### Console API (global)
```typescript
// Basic logging - these appear in the backend logs panel
console.log("Info message", { data: 123 });
console.warn("Warning message");
console.error("Error occurred");
console.debug("Debug info");

// Timing operations
console.time("operation");
// ... do work ...
console.timeLog("operation", "checkpoint");
// ... more work ...
console.timeEnd("operation"); // Logs: "operation: 123ms"

// Counting
console.count("api-calls");     // api-calls: 1
console.count("api-calls");     // api-calls: 2
console.countReset("api-calls");

// Grouping (for organized output)
console.group("User Request");
console.log("Method: GET");
console.log("Path: /api/users");
console.groupEnd();

// Assertions
console.assert(user !== null, "User should exist");
```

#### File System API (fs)
```typescript
// Get a directory handle
const root = await getDirectory("/data");

// Read a file
const fileHandle = await root.getFileHandle("config.json");
const file = await fileHandle.getFile();
const text = await file.text();
const config = JSON.parse(text);

// Write a file
const outputHandle = await root.getFileHandle("output.txt", { create: true });
const writable = await outputHandle.createWritable();
await writable.write("Hello, World!");
await writable.close();

// Directory operations
const subDir = await root.getDirectoryHandle("subdir", { create: true });
await root.removeEntry("old-file.txt");
await root.removeEntry("old-dir", { recursive: true });

// Iterate directory contents
for await (const [name, handle] of root.entries()) {
  console.log(name, handle.kind); // "file" or "directory"
}
```

#### Base64 Encoding (atob/btoa)
```typescript
// Encode string to Base64
const encoded = btoa("Hello, World!");
console.log(encoded); // "SGVsbG8sIFdvcmxkIQ=="

// Decode Base64 to string
const decoded = atob("SGVsbG8sIFdvcmxkIQ==");
console.log(decoded); // "Hello, World!"

// Encoding JSON for transport
const data = { user: "john", token: "abc123" };
const base64Data = btoa(JSON.stringify(data));
```

**Note:** btoa() only works with Latin1 characters (0-255). For Unicode, encode to UTF-8 first.

#### Streams API
```typescript
// ReadableStream
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue("chunk1");
    controller.enqueue("chunk2");
    controller.close();
  }
});

const reader = stream.getReader();
const { value, done } = await reader.read();

// Blob and File
const blob = new Blob(["hello", " ", "world"], { type: "text/plain" });
const text = await blob.text(); // "hello world"

const file = new File(["content"], "file.txt", { type: "text/plain" });
console.log(file.name); // "file.txt"
```

---

### Built-in Backend Utilities

These are provided by the platform in addition to the sandbox APIs:

#### Password Hashing (@/password)
```typescript
import { password } from "@/password";

// Hash a password (returns bcrypt hash)
const hash = await password.hash("user-password");

// Verify a password against a hash
const isValid = await password.verify("user-password", hash);
```

#### Environment Variables (@/env)

The `@/env` module provides access to environment variables in both frontend and backend.

**System-provided variables (always available):**
- `BASE_URL` - Full URL where the app is served (e.g., `${process.env.BASE_URL}/preview/{projectId}/{sessionId}/{mode}`)

**Usage:**
```typescript
// Frontend (api.ts or any frontend file)
import env from "@/env";

const client = createClient(contract, { baseUrl: env.BASE_URL + '/api' });
console.log("App served at:", env.BASE_URL);

// Backend (router.ts or any backend file)
import env from "@/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
```

**User-defined variables:**
For secrets and configuration that shouldn't be hardcoded (API keys, tokens, etc.), declare them using the `declare_env` tool:
```json
{
  "envs": [
    "backend/STRIPE_SECRET_KEY",
    "backend/DEBUG_MODE?",
    "frontend/STRIPE_PUBLISHABLE_KEY"
  ]
}
```
Format: `target/NAME` with optional suffix `?` (optional) or `!` (required, default). Calls are additive — they merge into the existing schema without removing anything. To remove vars, use the `remove_env` tool.

The user sets values in the Settings panel (you cannot set values, only declare the schema).

**Important notes:**
- Backend env vars are server-side only (secrets, API keys)
- Frontend env vars are exposed to the browser (public keys only!)
- Required user-defined env vars must be set before the app will run
- The schema is stored in `env-schema.json` (git-tracked)
- Values are encrypted and stored separately (not git-tracked)

#### Claude AI (@/claude)
```typescript
import { claude } from "@/claude";

const result = await claude.message({
  messages: [{ role: "user", content: "Hello!" }],
  maxTokens: 100,
  system: "You are a helpful assistant."  // optional
});

console.log(result.content);  // AI response text
console.log(result.usage);    // { input_tokens, output_tokens }
```

#### AI SDK Provider (@/ai-sdk-provider)

For more advanced AI use cases, use the Vercel AI SDK with the built-in provider:

```typescript
import { buildItNow, getModels } from "@/ai-sdk-provider";
import { generateText, streamText } from "ai";

// List available models (from database)
const models = await getModels();
console.log(models);
// [{ modelId: "claude-opus-4-5-20251101", displayName: "Claude Opus 4.5", thinking: true, inputPricePerMTok: ... }, ...]

function getModels(): Promise<ModelInfo>

interface ModelInfo {
  modelId: string;
  displayName: string;
  thinking: boolean;
  contextWindow: number;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  cacheWrite5mPricePerMTok: number | null;
  cacheWrite1hPricePerMTok: number | null;
  cacheReadPricePerMTok: number | null;
}

// Non-streaming text generation
const result = await generateText({
  model: buildItNow("claude-haiku-4-5-20251001"),
  prompt: "Explain quantum computing in simple terms.",
  maxTokens: 500,
});
console.log(result.text);

// Streaming text generation
const stream = streamText({
  model: buildItNow("claude-sonnet-4-5-20250929"),
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Write a short poem about coding." },
  ],
});

for await (const chunk of stream.textStream) {
  console.log(chunk); // Prints text as it arrives
}

// Access final result after streaming
const finalResult = await stream;
console.log(finalResult.usage); // { promptTokens, completionTokens }

// Text Embeddings (1536 dimensions via OpenAI text-embedding-ada-002)
import { embed, embedMany } from "ai";

// Single embedding
const { embedding } = await embed({
  model: buildItNow.textEmbeddingModel(),
  value: "Your text to embed",
});
console.log(embedding.length); // Always 1536 dimensions

// Multiple embeddings
const { embeddings } = await embedMany({
  model: buildItNow.textEmbeddingModel(),
  values: ["First text", "Second text", "Third text"],
});
```

**Note:** Embeddings use OpenAI's text-embedding-ada-002 model which always outputs 1536-dimensional vectors. No modelId parameter is needed since only one embedding model is supported.

**When to use AI SDK vs @/claude:**
- Use `@/claude` for simple single-turn conversations
- Use `@/ai-sdk-provider` when you need:
  - Streaming responses
  - AI SDK features (structured output, tools, etc.)
  - Compatibility with AI SDK patterns

#### Document Conversion & Chunking (@/docling)

Convert PDF, DOCX, and other files to embedding-ready chunks:

```typescript
import { docling } from "@/docling";
import { embedMany } from "ai";
import { buildItNow } from "@/ai-sdk-provider";

// Convert files to chunks
const result = await docling(pdfFile, docxFile);

// Chunks are ready for embedding
const { embeddings } = await embedMany({
  model: buildItNow.textEmbeddingModel(),
  values: result.chunks.map(c => c.text),
});

// Store chunks with embeddings
const vectorData = result.chunks.map((chunk, i) => ({
  content: chunk.text,          // Text with heading context (use for embeddings)
  embedding: embeddings[i],
  filename: chunk.filename,
  headings: chunk.headings,     // Section headings
  pageNumbers: chunk.pageNumbers,
}));

// Access raw document content if needed
const markdown = result.documents[0]?.markdown;
```

**Result structure:**
- `chunks` - Pre-chunked content optimized for RAG (use `chunk.text` for embeddings)
- `documents` - Source documents with `markdown`, `html`, `text`, `status`, `errors`
- `processingTime` - Total processing time in seconds

**Supported formats:** PDF, DOCX, images, and other document formats supported by Docling.

#### Database Migrations (@/migrations)
```typescript
import { generateMigration, createCustomMigration, migrate } from "@/migrations";

// Generate migration from schema changes (auto-applied)
const result = await generateMigration("add_posts_table");
// Returns { name: "20250109120000_add_posts_table.sql", sql: "..." } or null if no changes

// Create custom SQL migration (for seeding data)
await createCustomMigration("seed_users", `
  INSERT INTO users (id, name) VALUES ('1', 'Admin');
  INSERT INTO users (id, name) VALUES ('2', 'User');
`);

// Apply pending migrations (called automatically after generate/create)
const applied = await migrate();
// Returns array of applied migration names
```

Migrations are stored in `backend/migrations/` with format `YYYYMMDDHHMMSS_name.sql`.
Applied migrations are tracked in the `__drizzle_migrations` table.

---

### TanStack Router - File-Based Routing

#### Route Structure
Routes are defined in `frontend/routes/`:
```
frontend/routes/
├── __root.tsx      # Root layout (required - nav, footer, Outlet)
├── index.tsx       # Home page (/)
├── about.tsx       # About page (/about)
├── pricing.tsx     # Pricing page (/pricing)
└── users/
    ├── index.tsx   # Users list (/users)
    └── $userId.tsx # User detail (/users/:userId)
```

**Note:** The route tree is auto-generated. After creating/modifying files in `frontend/routes/`, the `route-tree.gen.ts` file is updated automatically.

#### Root Layout (__root.tsx)
```typescript
import { Outlet, createRootRoute, Link } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet /> {/* Child routes render here */}
      <footer>Footer content</footer>
    </div>
  );
}
```

#### Page Routes
```typescript
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

function AboutPage() {
  return <div>About us</div>;
}
```

#### Dynamic Routes ($param.tsx)
```typescript
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/users/$userId')({
  component: UserDetail,
});

function UserDetail() {
  const { userId } = Route.useParams();
  return <div>User: {userId}</div>;
}
```

#### Navigation
```typescript
import { Link, useNavigate } from '@tanstack/react-router';

// Declarative navigation
<Link to="/users">Users</Link>
<Link to="/users/$userId" params={{ userId: '123' }}>User 123</Link>

// With active styling
<Link to="/about" activeProps={{ className: 'font-bold' }}>About</Link>

// Programmatic navigation
const navigate = useNavigate();
navigate({ to: '/users/$userId', params: { userId: '123' } });
```

#### Setup (index.tsx)
```typescript
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './route-tree.gen';

const router = createRouter({ routeTree });

// In render:
<RouterProvider router={router} />
```

---

### React Patterns

#### Suspense with User Input
Use `useDeferredValue` to prevent suspense on every keystroke:
```typescript
const [search, setSearch] = useState("");
const deferredSearch = useDeferredValue(search);

const { data } = api.search.useSuspenseQuery({ query: { q: deferredSearch } });

<input value={search} onChange={(e) => setSearch(e.target.value)} />
```

or use `React.startTransition` / `useTransition` to handle the transition more explicitly:
```typescript
const [isPending, startTransition] = useTransition();
const [search, setSearch] = useState("");
const { data } = api.search.useSuspenseQuery({ query: { q: search } });

<button onClick={() => startTransition(() => setSearch("some query"))}>Apply search</button>
{isPending && <div>Loading...</div>}
{data && <div>{data.map((item) => <div key={item.id}>{item.name}</div>)}</div>}
```

---

### shadcn/ui Components & Theming

#### Examples:

**Import pattern:**
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

**Button variants and sizes:**
```tsx
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm" />  <Button size="lg" />  <Button size="icon" />
```

**Card composition:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>
```

**Dialog pattern:**
```tsx
<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

---

### CSS Variables (CRITICAL for Dark Mode)

The `styles.css` defines CSS variables that **automatically switch for dark mode**. Always use these instead of hardcoded colors.

**Semantic colors:**
- `bg-background` / `text-foreground` - Page base
- `bg-card` / `text-card-foreground` - Cards, elevated surfaces
- `bg-primary` / `text-primary-foreground` - Primary buttons, actions
- `bg-secondary` / `text-secondary-foreground` - Secondary elements
- `bg-muted` / `text-muted-foreground` - Subtle backgrounds, helper text
- `bg-accent` / `text-accent-foreground` - Highlights, hover states
- `bg-destructive` / `text-destructive-foreground` - Error/delete actions
- `border-border`, `border-input` - Borders
etc.

```tsx
// CORRECT - auto dark mode
<div className="bg-background text-foreground border border-border" />
<Card className="bg-card shadow-md" />

// WRONG - breaks dark mode
<div className="bg-white text-black border-gray-200" />
```

**Opacity modifiers on theme colors:**
```tsx
<div className="bg-primary/10 text-primary" />
<div className="bg-muted/50 border-border/50" />
```

**Customizing the theme (edit frontend/styles.css):**
- Colors are defined in `:root` (light) and `.dark` (dark mode)
- Always update both sections for consistency
- Use oklch() color format for best results

Example - changing the primary color to blue:
```css
:root {
  --primary: oklch(0.6 0.2 250);  /* Blue */
  --primary-foreground: oklch(0.98 0 0);
}
.dark {
  --primary: oklch(0.7 0.2 250);  /* Lighter blue for dark mode */
  --primary-foreground: oklch(0.1 0 0);
}
```

**Custom fonts (edit frontend/styles.css):**
Add Google Fonts import and define font variables:

```css
/* At the top of styles.css */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

@theme inline {
  --font-sans: 'Space Grotesk', system-ui, sans-serif;
}
```

Then use `font-sans` class in components, or apply globally:
```css
@layer base {
  body {
    @apply font-sans;
  }
}
```

Suggested fonts: Space Grotesk, Geist, IBM Plex Sans, Outfit, Sora
Monospace: JetBrains Mono, Fira Code, Space Mono

#### Color Convention

We use a simple `background` and `foreground` convention. The `background` suffix is omitted when used for the background color.

```css
--primary: oklch(0.205 0 0);
--primary-foreground: oklch(0.985 0 0);
```

```tsx
<div className="bg-primary text-primary-foreground">Hello</div>
```

#### Adding New Colors

Add colors to `:root` and `.dark`, then use `@theme inline` to expose them:

```css
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}

.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}

@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

Then use: `<div className="bg-warning text-warning-foreground" />`

---

### Browser Debugging (window.__builditnow)

In dev mode, all user file exports are available for debugging:
```javascript
// Access any exported component/function by file path
window.__builditnow.exports['app.tsx'].App
window.__builditnow.exports['api.ts'].client
window.__builditnow.exports['api.ts'].queryClient
window.__builditnow.exports['api.ts'].api
```

**Common debugging patterns:**
```javascript
// Invalidate queries to refresh data
const queryClient = window.__builditnow.exports['api.ts'].queryClient;
queryClient.invalidateQueries({ queryKey: ['getUsers'] });

// Make direct API call
const client = window.__builditnow.exports['api.ts'].client;
const result = await client.getUsers({});
console.log(result);
```


