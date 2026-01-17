# AI Chat App Template - Implementation Roadmap


**Playwright testing:**
```bash
# Inline code
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

---

## Todo List

### Phase 1: Setup & Auth

**Implementation:**
- [x] Create `backend/schema.ts` with Better Auth tables (user, session, account, verification) including `username` field
- [x] Create `backend/auth.ts` with Better Auth setup using `username` plugin
- [x] Create `frontend/auth-client.ts` with `signInWithUsername()` helper
- [x] Create `shared/types.ts` with `MessageMetadata` types
- [x] Create `backend/storage.ts` with OPFS file helpers (`readJsonFile`, `writeJsonFile`, `deleteJsonFile`)
- [x] Create `shared/contract.ts` with RPC endpoints
- [x] Create `frontend/routes/index.tsx` login page with username input
- [x] Create frontend boilerplate (`index.tsx`, `router.ts`, `api.ts`, `styles.css`, `routes/__root.tsx`, `routes/chat/index.tsx`)

**Verification:**
- [x] Run typecheck: `bun run typecheck:template ai-chatbot`
- [x] Run lint: `bun run lint:template ai-chatbot`
- [x] Test locally with serve script
- [x] Test: Sign in with new username creates account
- [x] Test: Sign in with existing username logs in
- [x] Test: Sign out redirects to login page

---

### Phase 2: Core Chat (File Storage)

**Implementation:**
- [x] Create `backend/chat-store.ts` with `createChat`, `loadChat`, `saveChat`, `getConversation`, `deleteChat`, `listChats`
- [x] Create `backend/router.ts` implementing the contract with file-based storage
- [x] Update `frontend/routes/chat/index.tsx` with full layout and sidebar
- [x] Create `frontend/routes/chat/new.tsx` to create new chat and redirect
- [x] Create `frontend/routes/chat/$id.tsx` placeholder for viewing conversations

**Verification:**
- [x] Run typecheck: `bun run typecheck:template ai-chatbot`
- [x] Run lint: `bun run lint:template ai-chatbot`
- [x] Test locally with serve script
- [x] Test: Create new conversation appears in sidebar
- [x] Test: Conversation list persists after page refresh
- [x] Test: Delete conversation removes from sidebar

---

### Phase 3: Streaming Messages

**Implementation:**
- [x] Create `backend/stream-store.ts` with `createResumableStream`, `resumeStream`, `deleteStreamFile`
- [x] Create `backend/chat-stream.ts` with `handleChatStream()` - POST `/chat` endpoint
- [x] Create `backend/chat-resume.ts` with `handleResumeStream()` - GET `/chat/:id/stream` endpoint
- [x] Create `backend/completion.ts` with `handleCompletion()` - POST `/chat/completion` endpoint
- [x] Create `backend/server.ts` entry point routing to auth, chat, and RPC handlers
- [x] Create `frontend/routes/chat/$id.tsx` chat view with `useChat` hook, `resume: true`, and token display

**Verification:**
- [x] Run typecheck: `bun run typecheck:template ai-chatbot`
- [x] Run lint: `bun run lint:template ai-chatbot`
- [x] Test locally with serve script
- [x] Test: Send message and receive streaming response
- [x] Test: Messages persist after page refresh
- [x] Test: Token usage displays on assistant messages

---

### Phase 4: Polish

**Implementation:**
- [ ] Add model selector dropdown in sidebar
- [ ] Add conversation deletion with confirmation
- [ ] Auto-generate titles from first user message
- [ ] Add keyboard shortcuts (Enter to send)
- [ ] Add loading states and error handling

**Verification:**
- [ ] Run typecheck: `bun run typecheck:template ai-chatbot`
- [ ] Run lint: `bun run lint:template ai-chatbot`
- [ ] Test locally with serve script
- [ ] Test: Model selector changes model for new chats
- [ ] Test: Conversation title updates from first message
- [ ] Test: Enter key sends message

---

### Phase 5: Full Integration Testing

**End-to-end flows:**
- [ ] Test complete auth flow (sign up → chat → sign out → sign in)
- [ ] Test multi-conversation flow (create multiple chats, switch between them)
- [ ] Test stream resumption (refresh page during AI response, verify it resumes)
- [ ] Test data persistence (all conversations and messages survive page refresh)
- [ ] Test error handling (network errors, invalid inputs)
- [ ] Test with different AI models
