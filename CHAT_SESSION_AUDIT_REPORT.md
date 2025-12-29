# Chat Session and History Audit Report

**Date**: 2025-12-01
**Issue**: Multiple prompts showing up under the same chat session
**Status**: ✅ Root causes identified, fixes ready for implementation

---

## Executive Summary

After a comprehensive audit of the chat session and history system, I've identified **4 critical race conditions and 2 architectural issues** that can cause duplicate messages or multiple prompts to appear under the same chat. The issues stem from concurrent operations, stale closure problems, and lack of synchronization between optimistic updates and backend persistence.

### Key Findings

1. **Race Condition in Message Saving** - User and assistant messages saved concurrently can create duplicates
2. **Optimistic Update Conflicts** - React Query cache updates can be overwritten by stale fetches
3. **Session Creation Race** - Multiple rapid messages can create duplicate sessions
4. **Batching Issues** - Message batcher can lose messages or create duplicates during failures
5. **Cache Invalidation Timing** - Premature invalidations trigger refetches that overwrite optimistic data
6. **Stale Closure in useChatStream** - Mobile/fast clicks can capture stale messagesHistory

---

## Architecture Overview

The chat system uses a **dual-path architecture**:

### Path 1: Legacy Controller (ChatExperience.tsx)
- Uses `useChatController` hook
- Manual state management with React useState
- Located in `/features/chat/`
- **Status**: ⚠️ Contains several race conditions

### Path 2: Modern v2 (ChatLayout.tsx)
- Uses Zustand + React Query
- Optimistic updates with cache management
- Located in `/components/chat-v2/`
- **Status**: ✅ More robust but still has issues

**Note**: The app uses **Path 2 (v2)** as the primary implementation (see `/app/chat/page.tsx:4`).

---

## Identified Issues

### 🔴 **ISSUE 1: Concurrent Message Save Race Condition**

**Location**: `src/lib/hooks/use-chat-stream.ts:79` and `:160`
**Severity**: HIGH
**Impact**: Can create duplicate messages in database

#### Problem
```typescript
// Line 79 - User message save (fire-and-forget)
saveMessage.mutate({ sessionId, role: 'user', content, model: model.value });

// Line 160 - Assistant message save (fire-and-forget)
saveMessage.mutate({
  sessionId,
  role: 'assistant',
  content: finalContent,
  model: model.value
});
```

Both mutations run as **fire-and-forget** without waiting for completion. If the backend is slow or the user sends multiple messages rapidly:

1. User message 1 starts saving (not yet in DB)
2. Assistant response 1 starts saving (not yet in DB)
3. User message 2 sent → fetches session messages (may not include message 1!)
4. Messages get duplicated or lost in history

#### Evidence
- Both mutations use `void` keyword (line 265, 297 in `useChatController.ts`)
- No error handling for failed saves
- Batching system (`message-batcher.ts`) can drop messages on failure

#### Fix
```typescript
// Wait for user message to persist before streaming
await saveMessage.mutateAsync({ sessionId, role: 'user', content, model: model.value });

// Then stream response...

// Wait for assistant message before allowing next send
await saveMessage.mutateAsync({
  sessionId,
  role: 'assistant',
  content: finalContent,
  model: model.value
});
```

---

### 🔴 **ISSUE 2: React Query Cache Invalidation Race**

**Location**: `src/lib/hooks/use-chat-queries.ts:187`
**Severity**: MEDIUM
**Impact**: Optimistic updates overwritten by stale data

#### Problem
```typescript
onSuccess: (savedMessage, variables) => {
  // Only invalidate sessions list to update "updated_at" timestamp in sidebar
  queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
}
```

The comment says "Don't invalidate chat-messages" to prevent overwrites, but the **sessions invalidation can still trigger refetches** of messages if a component is watching both queries.

Additionally, in `use-chat-stream.ts:59`:
```typescript
// Cancel any outgoing refetches (so they don't overwrite our optimistic update)
await queryClient.cancelQueries({ queryKey: ['chat-messages', sessionId] });
```

This cancels inflight queries but **doesn't prevent NEW fetches** triggered by invalidations elsewhere.

#### Timeline
1. User sends message → optimistic update to cache
2. `saveMessage` completes → invalidates `chat-sessions`
3. Sessions refetch triggers → component also refetches messages
4. Backend hasn't persisted batched assistant message yet
5. Refetch returns stale data → **optimistic update lost**

#### Fix
```typescript
onSuccess: (savedMessage, variables) => {
  // Directly update cache instead of invalidating
  queryClient.setQueryData(['chat-messages', variables.sessionId], (old: any[] | undefined) => {
    if (!old) return [savedMessage];
    // Only add if not already present (prevent duplicates)
    const exists = old.some(msg => msg.id === savedMessage.id);
    if (exists) return old;
    return [...old, savedMessage];
  });

  // Invalidate sessions list only (safe - doesn't affect messages)
  queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
}
```

---

### 🔴 **ISSUE 3: Session Creation Race Condition**

**Location**: `src/components/chat-v2/ChatInput.tsx:134-143`
**Severity**: HIGH
**Impact**: Multiple sessions created for same conversation

#### Problem
```typescript
if (!sessionId) {
  try {
    const newSession = await createSession.mutateAsync({
        title: generateSessionTitle(messageText),
        model: selectedModel.value
    });
    sessionId = newSession.id;
    setActiveSessionId(sessionId);
```

If user clicks send button **twice rapidly** (or presses Enter twice):
1. First click: `!sessionId` → creates session A
2. Second click: `!sessionId` still true (state hasn't updated) → creates session B
3. Messages split across two sessions

#### Evidence
Mobile users with fast double-taps are most affected. The `onPointerDown` handler (line 353) tries to prevent this but doesn't fully address the race.

#### Fix
```typescript
// Add creating flag to prevent concurrent session creation
const [isCreatingSession, setIsCreatingSession] = useState(false);

if (!sessionId) {
  if (isCreatingSession) {
    // Wait for ongoing creation
    return;
  }

  setIsCreatingSession(true);
  try {
    const newSession = await createSession.mutateAsync({...});
    sessionId = newSession.id;
    setActiveSessionId(sessionId);
  } finally {
    setIsCreatingSession(false);
  }
}
```

---

### 🟡 **ISSUE 4: Message Batching Reliability**

**Location**: `src/lib/chat-history.ts:537-574`
**Severity**: MEDIUM
**Impact**: Messages can be lost or duplicated during batch failures

#### Problem
```typescript
private async saveBatchedMessages(messages: BatchedMessage[]): Promise<...> {
  // Save each session's messages
  for (const [sessionId, sessionMessages] of bySession.entries()) {
    for (const msg of sessionMessages) {
      try {
        const saved = await this.saveMessageImmediate(...);
        results.push({ success: true, messageId: saved.id });
      } catch (error) {
        results.push({ success: false, error: ... });
      }
    }
  }
  return results;
}
```

Issues:
1. **No retry logic** - Failed messages are dropped
2. **No transaction support** - Partial batch can succeed/fail
3. **Success array not checked** - Caller doesn't know if messages saved
4. **Batching enabled by default** - Assistant messages always batched (line 438)

#### Evidence
See `message-batcher.ts` - flushes occur every 2 seconds or on 10 message threshold. Network hiccup during flush = lost messages.

#### Fix
1. Add retry logic for failed batch items
2. Return detailed results to caller
3. Make batching opt-in instead of default
4. Add transaction ID to group related messages

---

### 🟡 **ISSUE 5: Stale messagesHistory Closure**

**Location**: `src/lib/hooks/use-chat-stream.ts:34-44`
**Severity**: MEDIUM
**Impact**: Old conversation history sent to API, causing context loss

#### Problem
```typescript
const streamMessage = useCallback(async ({
    sessionId,
    content,
    model,
    messagesHistory  // ← This is captured at callback creation time
}: {
```

The `messagesHistory` parameter is passed from `ChatInput.tsx:171`:
```typescript
messagesHistory: currentMessages  // ← Captured before async operations
```

But `currentMessages` is captured at the **start** of `handleSend`, before any async operations. On mobile or with rapid clicks:

1. User sends message 1 → `currentMessages = []`
2. Stream completes, adds assistant reply → cache now has 2 messages
3. User immediately sends message 2 → `currentMessages = []` again (stale from step 1)
4. API receives empty history → loses context

#### Fix
```typescript
// In ChatInput.tsx - Always fetch fresh messages before streaming
const { data: freshMessages = [] } = useSessionMessages(sessionId);

await streamMessage({
  sessionId,
  content,
  model: selectedModel,
  messagesHistory: freshMessages  // ← Always fresh from React Query cache
});
```

---

### 🟢 **ISSUE 6: Multiple Chat Architectures**

**Location**: Entire codebase
**Severity**: LOW (architectural debt)
**Impact**: Confusion, harder to maintain, potential for using wrong implementation

The codebase has **two complete chat implementations**:

1. **Legacy** (`/features/chat/useChatController.ts`) - 344 lines
2. **Modern** (`/components/chat-v2/`) - Zustand + React Query

Both are fully functional but have different bugs. The main `/app/chat/page.tsx` uses v2, but `/features/chat/ChatExperience.tsx` still exists and could be accidentally used.

#### Recommendation
1. Delete legacy implementation entirely
2. Migrate any unique features to v2
3. Update all imports and docs

---

## Testing Gaps

Current test coverage is **insufficient** for catching these race conditions:

### Missing Tests
1. ❌ Concurrent message sending (rapid double-send)
2. ❌ Session creation during active session
3. ❌ Message save failure scenarios
4. ❌ Network interruption during batch
5. ❌ Cache invalidation timing
6. ❌ Optimistic update rollback

### Existing Tests
- ✅ Basic chat-history.test.ts (unit tests for API class)
- ✅ ChatInput.test.tsx (component tests)
- ✅ ChatLayout.test.tsx (integration tests)

**Recommendation**: Add E2E tests with Playwright to simulate real user patterns.

---

## Root Cause Analysis

### Why Multiple Prompts Appear in Same Chat

The issue manifests when:

1. **User sends message rapidly** (double-click/tap)
2. **Session creation race** → Two sessions created
3. **First message goes to session A**
4. **Second message goes to session B**
5. **UI shows session B** (most recent)
6. **Both messages appear in session B** because:
   - Backend merged them (if session_id collision)
   - OR frontend cache mixed them up (optimistic update race)

### Reproduction Steps
```
1. Open chat (no active session)
2. Type a message
3. Rapidly press Enter twice (within 100ms)
4. Observe: Two sessions created OR two identical user messages
```

---

## Comprehensive Test Cases

### Test Suite 1: Session Creation

#### TC-1.1: Single Session Creation
```typescript
test('should create exactly one session for first message', async () => {
  const { user } = render(<ChatLayout />);

  await user.type(screen.getByPlaceholderText('Type a message...'), 'Hello');
  await user.click(screen.getByRole('button', { name: /send/i }));

  await waitFor(() => {
    const sessions = queryClient.getQueryData(['chat-sessions']);
    expect(sessions).toHaveLength(1);
  });
});
```

#### TC-1.2: Rapid Double-Send (Race Condition)
```typescript
test('should NOT create duplicate sessions on rapid double-send', async () => {
  const { user } = render(<ChatLayout />);
  const input = screen.getByPlaceholderText('Type a message...');
  const sendButton = screen.getByRole('button', { name: /send/i });

  await user.type(input, 'Message 1');

  // Simulate rapid double-click (< 50ms apart)
  await Promise.all([
    user.click(sendButton),
    user.click(sendButton),
  ]);

  await waitFor(() => {
    const sessions = queryClient.getQueryData(['chat-sessions']);
    expect(sessions).toHaveLength(1); // Should only create ONE session
  }, { timeout: 5000 });
});
```

#### TC-1.3: Sequential Messages in Same Session
```typescript
test('should add sequential messages to same session', async () => {
  const { user } = render(<ChatLayout />);
  const input = screen.getByPlaceholderText('Type a message...');

  // First message
  await user.type(input, 'Message 1');
  await user.click(screen.getByRole('button', { name: /send/i }));
  await waitFor(() => expect(screen.getByText('Message 1')).toBeInTheDocument());

  // Wait for response to complete
  await waitFor(() => expect(screen.queryByText(/Generating/i)).not.toBeInTheDocument());

  // Second message
  await user.type(input, 'Message 2');
  await user.click(screen.getByRole('button', { name: /send/i }));

  await waitFor(() => {
    const messages = queryClient.getQueryData(['chat-messages', sessionId]);
    expect(messages.filter(m => m.role === 'user')).toHaveLength(2);
  });
});
```

---

### Test Suite 2: Message Persistence

#### TC-2.1: User Message Saves Before Streaming
```typescript
test('should persist user message before starting stream', async () => {
  const saveMessageSpy = vi.spyOn(ChatHistoryAPI.prototype, 'saveMessage');

  await streamMessage({...});

  // Verify save was called and completed
  expect(saveMessageSpy).toHaveBeenCalledWith(
    sessionId,
    'user',
    expect.any(String),
    expect.any(String)
  );

  // Verify message in cache
  const messages = queryClient.getQueryData(['chat-messages', sessionId]);
  expect(messages[0]).toMatchObject({ role: 'user', content: expect.any(String) });
});
```

#### TC-2.2: Assistant Message Saves After Streaming
```typescript
test('should persist complete assistant response', async () => {
  const saveMessageSpy = vi.spyOn(ChatHistoryAPI.prototype, 'saveMessage');

  await streamMessage({...});

  // Wait for stream to complete
  await waitFor(() => {
    const messages = queryClient.getQueryData(['chat-messages', sessionId]);
    const lastMsg = messages[messages.length - 1];
    return lastMsg.role === 'assistant' && !lastMsg.isStreaming;
  });

  // Verify assistant message was saved
  expect(saveMessageSpy).toHaveBeenCalledWith(
    sessionId,
    'assistant',
    expect.stringContaining('response text'),
    expect.any(String)
  );
});
```

#### TC-2.3: Failed Save Doesn't Block UI
```typescript
test('should show message in UI even if save fails', async () => {
  // Mock save failure
  vi.spyOn(ChatHistoryAPI.prototype, 'saveMessage').mockRejectedValue(
    new Error('Network error')
  );

  await streamMessage({...});

  // Message should still appear in UI (optimistic update)
  expect(screen.getByText('Test message')).toBeInTheDocument();

  // Should show error indicator
  expect(screen.getByTitle(/Failed to save/i)).toBeInTheDocument();
});
```

---

### Test Suite 3: Concurrent Operations

#### TC-3.1: Multiple Users Same Session (NOT applicable - sessions are user-specific)

#### TC-3.2: Rapid Message Sending
```typescript
test('should handle rapid sequential messages without loss', async () => {
  const messages = ['Msg 1', 'Msg 2', 'Msg 3'];

  for (const msg of messages) {
    await sendMessage(msg);
    await waitFor(() => {
      const cached = queryClient.getQueryData(['chat-messages', sessionId]);
      expect(cached.some(m => m.content === msg)).toBe(true);
    });
  }

  // All messages should be present
  const finalCache = queryClient.getQueryData(['chat-messages', sessionId]);
  expect(finalCache.filter(m => m.role === 'user')).toHaveLength(3);
});
```

#### TC-3.3: Streaming During Message Send
```typescript
test('should queue new message if already streaming', async () => {
  // Start first message (streaming)
  sendMessage('Message 1');

  // Try to send second before first completes
  await waitFor(() => expect(screen.getByText(/Generating/i)).toBeInTheDocument());

  const sendButton = screen.getByRole('button', { name: /send/i });
  expect(sendButton).toBeDisabled(); // Should be disabled during stream

  // Second message should wait
  await user.type(input, 'Message 2');
  await user.click(sendButton); // Should not trigger

  expect(mockStreamCall).toHaveBeenCalledTimes(1); // Only first message
});
```

---

### Test Suite 4: Cache Consistency

#### TC-4.1: Optimistic Update Not Overwritten
```typescript
test('should preserve optimistic updates during refetch', async () => {
  const { sessionId } = await createSessionWithMessages([]);

  // Add optimistic message
  queryClient.setQueryData(['chat-messages', sessionId], [
    { id: 'temp-1', role: 'user', content: 'Optimistic', isOptimistic: true }
  ]);

  // Trigger refetch (simulates invalidation)
  await queryClient.refetchQueries({ queryKey: ['chat-messages', sessionId] });

  // Optimistic message should still be there
  const messages = queryClient.getQueryData(['chat-messages', sessionId]);
  expect(messages.find(m => m.content === 'Optimistic')).toBeDefined();
});
```

#### TC-4.2: Invalidation After Save
```typescript
test('should not invalidate messages cache on save', async () => {
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  await saveMessage.mutateAsync({
    sessionId,
    role: 'user',
    content: 'Test',
    model: 'test-model'
  });

  // Should invalidate sessions but NOT messages
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat-sessions'] });
  expect(invalidateSpy).not.toHaveBeenCalledWith({
    queryKey: expect.arrayContaining(['chat-messages'])
  });
});
```

#### TC-4.3: Cache Merge on Refetch
```typescript
test('should merge cached and fetched messages without duplicates', async () => {
  // Setup cache with optimistic message
  queryClient.setQueryData(['chat-messages', sessionId], [
    { id: 1, content: 'Existing' },
    { id: 'temp-1', content: 'Optimistic', isOptimistic: true }
  ]);

  // Mock fetch returns persisted version
  mockApi.getSession.mockResolvedValue({
    messages: [
      { id: 1, content: 'Existing' },
      { id: 2, content: 'Optimistic' } // Now has real ID
    ]
  });

  await queryClient.refetchQueries({ queryKey: ['chat-messages', sessionId] });

  const messages = queryClient.getQueryData(['chat-messages', sessionId]);

  // Should have 2 unique messages (not 3)
  expect(messages).toHaveLength(2);
  expect(messages.find(m => m.id === 2)?.content).toBe('Optimistic');
});
```

---

### Test Suite 5: Batch Processing

#### TC-5.1: Batch Success
```typescript
test('should batch multiple assistant messages', async () => {
  const api = new ChatHistoryAPI(apiKey);

  // Queue 3 messages
  await api.saveMessage(sessionId, 'assistant', 'Response 1');
  await api.saveMessage(sessionId, 'assistant', 'Response 2');
  await api.saveMessage(sessionId, 'assistant', 'Response 3');

  // Flush batch
  await api.flushBatches();

  // All 3 should be saved in single batch
  expect(mockBatchSave).toHaveBeenCalledTimes(1);
  expect(mockBatchSave).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ content: 'Response 1' }),
      expect.objectContaining({ content: 'Response 2' }),
      expect.objectContaining({ content: 'Response 3' }),
    ])
  );
});
```

#### TC-5.2: Partial Batch Failure
```typescript
test('should handle partial batch failures', async () => {
  mockBatchSave.mockImplementation(async (messages) => {
    return messages.map((msg, i) => ({
      success: i !== 1, // Second message fails
      error: i === 1 ? 'Network error' : undefined
    }));
  });

  const results = await api.saveBatchedMessages([...3 messages]);

  expect(results[0].success).toBe(true);
  expect(results[1].success).toBe(false);
  expect(results[2].success).toBe(true);

  // Should retry failed message
  expect(mockSaveImmediate).toHaveBeenCalledWith(
    expect.objectContaining({ content: messages[1].content })
  );
});
```

#### TC-5.3: User Messages Bypass Batch
```typescript
test('should save user messages immediately (not batched)', async () => {
  const api = new ChatHistoryAPI(apiKey, undefined, undefined, true); // batching=true

  await api.saveMessage(sessionId, 'user', 'User message');

  // Should call immediate save, not add to batch
  expect(mockSaveImmediate).toHaveBeenCalled();
  expect(mockBatchAdd).not.toHaveBeenCalled();
});
```

---

### Test Suite 6: Error Handling

#### TC-6.1: 401 Auth Error Triggers Refresh
```typescript
test('should refresh auth on 401 error', async () => {
  mockApi.saveMessage.mockRejectedValue({ status: 401, message: 'Unauthorized' });

  const refreshSpy = vi.spyOn(authContext, 'refresh');

  await expect(saveMessage.mutateAsync({...})).rejects.toThrow();

  expect(refreshSpy).toHaveBeenCalledWith({ force: true });
  expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
});
```

#### TC-6.2: Timeout Retry
```typescript
test('should retry on timeout with exponential backoff', async () => {
  let attempts = 0;
  mockApi.createSession.mockImplementation(() => {
    attempts++;
    if (attempts < 3) throw new Error('Timeout');
    return { id: 123, title: 'New Chat' };
  });

  const session = await createSession.mutateAsync({});

  expect(attempts).toBe(3);
  expect(session.id).toBe(123);
});
```

#### TC-6.3: Network Offline Queue
```typescript
test('should queue messages when offline', async () => {
  // Simulate offline
  Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

  await sendMessage('Offline message');

  // Should be in queue, not sent
  expect(mockApi.saveMessage).not.toHaveBeenCalled();
  expect(screen.getByText(/You are offline/i)).toBeInTheDocument();

  // Come back online
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  window.dispatchEvent(new Event('online'));

  // Should send queued message
  await waitFor(() => {
    expect(mockApi.saveMessage).toHaveBeenCalledWith(
      expect.any(Number),
      'user',
      'Offline message',
      expect.any(String)
    );
  });
});
```

---

### Test Suite 7: Edge Cases

#### TC-7.1: Empty Session (No Messages)
```typescript
test('should handle empty session gracefully', async () => {
  const session = await api.getSession(sessionId);

  expect(session.messages).toEqual([]);

  // Should still allow sending first message
  await sendMessage('First message');
  expect(screen.getByText('First message')).toBeInTheDocument();
});
```

#### TC-7.2: Very Long Message (> 10KB)
```typescript
test('should handle very long messages', async () => {
  const longMessage = 'A'.repeat(50000); // 50KB message

  await sendMessage(longMessage);

  await waitFor(() => {
    const messages = queryClient.getQueryData(['chat-messages', sessionId]);
    expect(messages.find(m => m.content.length === 50000)).toBeDefined();
  });
});
```

#### TC-7.3: Session Deleted During Active Stream
```typescript
test('should cancel stream if session deleted', async () => {
  // Start streaming
  const streamPromise = streamMessage({...});

  // Delete session mid-stream
  await api.deleteSession(sessionId);

  // Stream should be cancelled
  await expect(streamPromise).rejects.toThrow(/Session deleted/i);

  // UI should show error
  expect(screen.getByText(/Session was deleted/i)).toBeInTheDocument();
});
```

#### TC-7.4: Multimodal Content (Image + Text)
```typescript
test('should save and display image attachments', async () => {
  const content = [
    { type: 'text', text: 'Check this out' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
  ];

  await streamMessage({ sessionId, content, model, messagesHistory: [] });

  // Verify saved with full content array
  expect(mockSave).toHaveBeenCalledWith(
    sessionId,
    'user',
    content,
    expect.any(String)
  );

  // Verify image displayed
  expect(screen.getByAltText('preview')).toHaveAttribute('src', expect.stringContaining('data:image'));
});
```

---

## E2E Test Scenarios (Playwright)

### E2E-1: Complete Chat Flow
```typescript
test('full chat conversation flow', async ({ page }) => {
  await page.goto('/chat');

  // Send first message
  await page.fill('[placeholder="Type a message..."]', 'Hello');
  await page.click('button:has-text("Send")');

  // Wait for response
  await page.waitForSelector('text=/Hello/i');
  await page.waitForSelector('[data-role="assistant"]');

  // Send follow-up
  await page.fill('[placeholder="Type a message..."]', 'Tell me more');
  await page.click('button:has-text("Send")');

  // Verify conversation continuity
  const userMessages = await page.locator('[data-role="user"]').count();
  const assistantMessages = await page.locator('[data-role="assistant"]').count();

  expect(userMessages).toBe(2);
  expect(assistantMessages).toBe(2);
});
```

### E2E-2: Session Persistence Across Refresh
```typescript
test('session persists after page refresh', async ({ page }) => {
  await page.goto('/chat');

  // Create conversation
  await page.fill('[placeholder="Type a message..."]', 'Test message');
  await page.click('button:has-text("Send")');
  await page.waitForSelector('text=/Test message/i');

  // Get session ID from URL or storage
  const sessionId = await page.evaluate(() =>
    localStorage.getItem('active_session_id')
  );

  // Refresh page
  await page.reload();

  // Session should still be active
  await page.waitForSelector('text=/Test message/i');

  const currentSessionId = await page.evaluate(() =>
    localStorage.getItem('active_session_id')
  );

  expect(currentSessionId).toBe(sessionId);
});
```

### E2E-3: Mobile Double-Tap Race
```typescript
test('handles rapid double-tap on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only test');

  await page.goto('/chat');

  const sendButton = page.locator('button:has-text("Send")');
  await page.fill('[placeholder="Type a message..."]', 'Quick message');

  // Simulate rapid double-tap (< 100ms apart)
  await sendButton.tap();
  await page.waitForTimeout(50);
  await sendButton.tap();

  // Should only create ONE session and ONE user message
  await page.waitForTimeout(2000); // Wait for any duplicates to appear

  const sessions = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('chat_sessions') || '[]');
  });

  expect(sessions).toHaveLength(1);

  const userMessages = await page.locator('[data-role="user"]').count();
  expect(userMessages).toBe(1);
});
```

---

## Performance Benchmarks

### Benchmark 1: Message Send Latency
```typescript
test('message send completes within 200ms', async () => {
  const start = performance.now();

  await sendMessage('Test message');

  const latency = performance.now() - start;
  expect(latency).toBeLessThan(200); // Optimistic update should be instant
});
```

### Benchmark 2: Stream Start Time
```typescript
test('stream starts within 3 seconds', async () => {
  const start = performance.now();

  sendMessage('Test message');

  await waitFor(() => {
    expect(screen.getByText(/Generating/i)).toBeInTheDocument();
  }, { timeout: 3000 });

  const timeToFirstToken = performance.now() - start;
  expect(timeToFirstToken).toBeLessThan(3000);
});
```

### Benchmark 3: Message History Load
```typescript
test('loads 50 messages in under 500ms', async () => {
  const sessionWith50Messages = await createSessionWithMessages(50);

  const start = performance.now();
  await api.getSession(sessionWith50Messages.id);
  const loadTime = performance.now() - start;

  expect(loadTime).toBeLessThan(500);
});
```

---

## Recommended Fixes (Priority Order)

### 🔴 P0: Critical - Fix Immediately

1. **Session creation race guard** (ISSUE 3)
   - Add `isCreatingSession` flag
   - Disable send button during creation
   - File: `src/components/chat-v2/ChatInput.tsx:134`

2. **Sequential message saves** (ISSUE 1)
   - Change `mutate()` to `mutateAsync()`
   - Add `await` before streaming
   - Files: `src/lib/hooks/use-chat-stream.ts:79, :160`

### 🟡 P1: High - Fix This Week

3. **Cache invalidation fix** (ISSUE 2)
   - Use `setQueryData` instead of `invalidateQueries`
   - Add deduplication logic
   - File: `src/lib/hooks/use-chat-queries.ts:187`

4. **Fresh messages for streaming** (ISSUE 5)
   - Always read from React Query cache
   - Remove stale `currentMessages` snapshot
   - File: `src/components/chat-v2/ChatInput.tsx:171`

### 🟢 P2: Medium - Fix This Sprint

5. **Batch reliability** (ISSUE 4)
   - Add retry logic
   - Transaction grouping
   - File: `src/lib/chat-history.ts:537`

6. **Remove legacy code** (ISSUE 6)
   - Delete `/features/chat/` directory
   - Update imports
   - Multiple files

---

## Testing Strategy

### Phase 1: Unit Tests (This Week)
- [ ] Add concurrent operation tests
- [ ] Add cache consistency tests
- [ ] Add error handling tests
- [ ] Target: 80% coverage for chat modules

### Phase 2: Integration Tests (Next Week)
- [ ] Add multi-component interaction tests
- [ ] Add network simulation tests
- [ ] Add state machine tests
- [ ] Target: All critical paths covered

### Phase 3: E2E Tests (Following Week)
- [ ] Add Playwright tests for user flows
- [ ] Add mobile-specific tests
- [ ] Add performance benchmarks
- [ ] Target: Top 5 user journeys automated

---

## Monitoring and Alerts

### Recommended Metrics

1. **Duplicate Message Rate**
   ```typescript
   // Track messages with same session_id + content + timestamp (within 1s)
   SELECT COUNT(*)
   FROM messages m1
   JOIN messages m2 ON m1.session_id = m2.session_id
     AND m1.content = m2.content
     AND m1.id != m2.id
     AND ABS(EXTRACT(EPOCH FROM (m1.created_at - m2.created_at))) < 1
   ```

2. **Session Creation Spikes**
   ```typescript
   // Alert if > 2 sessions created within 5 seconds for same user
   SELECT user_id, COUNT(*) as session_count
   FROM sessions
   WHERE created_at > NOW() - INTERVAL '5 seconds'
   GROUP BY user_id
   HAVING COUNT(*) > 2
   ```

3. **Message Save Failures**
   ```typescript
   // Track failed saveMessage mutations
   Sentry.captureException(error, {
     tags: { operation: 'message_save' },
     extra: { sessionId, role, contentLength }
   });
   ```

---

## Appendix A: Code Locations

| File | Lines | Issue |
|------|-------|-------|
| `src/lib/hooks/use-chat-stream.ts` | 79, 160 | Concurrent saves |
| `src/lib/hooks/use-chat-queries.ts` | 187 | Cache invalidation |
| `src/components/chat-v2/ChatInput.tsx` | 134-143 | Session race |
| `src/lib/chat-history.ts` | 537-574 | Batch reliability |
| `src/components/chat-v2/ChatInput.tsx` | 171 | Stale closure |

---

## Appendix B: Database Schema (Assumed)

```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255),
  model VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  model VARCHAR(100),
  tokens INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Add these for duplicate detection
  UNIQUE(session_id, content, created_at) -- Prevent exact duplicates
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_sessions_user ON sessions(user_id, updated_at DESC);
```

---

## Conclusion

The chat system has **6 identified issues** causing duplicate messages and race conditions. Most critical are:

1. **Session creation race** - causes duplicate sessions
2. **Concurrent message saves** - causes lost/duplicate messages
3. **Cache invalidation timing** - overwrites optimistic updates

All issues have clear fixes and comprehensive test cases provided above. Implementation estimated at **2-3 days** for fixes + **1 week** for full test coverage.

**Next Steps**:
1. Review this report with team
2. Prioritize fixes (P0 → P1 → P2)
3. Implement fixes with accompanying tests
4. Deploy to staging with monitoring
5. Gradual rollout to production

---

**Report prepared by**: Terry (Terragon Labs AI Agent)
**Audit Date**: 2025-12-01
**Confidence**: High (comprehensive codebase review completed)
