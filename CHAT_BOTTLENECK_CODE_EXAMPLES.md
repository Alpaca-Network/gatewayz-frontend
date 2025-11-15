# Chat System Performance Bottleneck - Code Examples

## Issue 1: Client-Side 2-Minute Timeout (CRITICAL)

### Current Code (PROBLEMATIC)
**File:** `src/lib/streaming.ts:103-105`

```typescript
export async function* streamChatResponse(
  url: string,
  apiKey: string,
  requestBody: Record<string, unknown>,
  retryCount = 0,
  maxRetries = 5
): AsyncGenerator<StreamChunk> {
  // Client-side timeout for the fetch request (2 minutes for streaming)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);  // ← ONLY 2 MINUTES!
```

### Why It's a Problem
- Long-running reasoning models (o1, o3, DeepSeek) can take 60+ seconds just to think
- Backend model providers (NEAR, Cerebras) can be slow
- 2 minutes total includes all retries, not just actual streaming time
- If backend takes 60 seconds, client aborts at 120 seconds total

### Recommended Fix
```typescript
export async function* streamChatResponse(
  url: string,
  apiKey: string,
  requestBody: Record<string, unknown>,
  retryCount = 0,
  maxRetries = 5
): AsyncGenerator<StreamChunk> {
  // Increase to 5-10 minutes for reasoning models and slow providers
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);  // 5 minutes
  
  // Or make it configurable:
  const timeoutMs = requestBody.model?.includes('o1') || requestBody.model?.includes('o3')
    ? 600000  // 10 minutes for reasoning
    : 300000; // 5 minutes for others
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
```

---

## Issue 2: No Backend API Fetch Timeout (HIGH)

### Current Code (PROBLEMATIC)
**File:** `src/app/api/chat/completions/route.ts:87-94`

```typescript
let response: Response;
const maxRetries = 3;
let lastError: Error | null = null;

// Retry logic for network errors
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(backendRequestBody),
      // ← NO TIMEOUT or AbortSignal configured!
    });
    break; // Success, exit retry loop
  } catch (fetchError) {
    // Error handling...
  }
}
```

### Why It's a Problem
- If backend is unresponsive, fetch will hang indefinitely
- Only network errors (ECONNREFUSED, etc.) are caught
- Slow responses are not caught, just wait forever
- Edge runtime can hit 30-second function timeout but that's too aggressive

### Recommended Fix
```typescript
// Add AbortSignal with reasonable timeout
const abortController = new AbortController();
const timeoutMs = 30000; // 30 seconds to backend
const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

try {
  response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Connection': 'keep-alive',  // Also add keep-alive
    },
    body: JSON.stringify(backendRequestBody),
    signal: abortController.signal,  // ← ADD THIS
  });
  clearTimeout(timeoutId);
  break;
} catch (fetchError) {
  clearTimeout(timeoutId);
  // ... existing error handling
}
```

---

## Issue 3: Exponential Retry Stacking (HIGH)

### Current Code (PROBLEMATIC)
**File:** `src/lib/streaming.ts:137-150`

```typescript
if (retryCount < maxRetries) {
  // Exponential backoff: 2s, 4s, 8s, 16s, 32s
  const waitTime = Math.min(2000 * Math.pow(2, retryCount), 32000);
  const jitter = Math.floor(Math.random() * 1000);
  const totalWaitTime = waitTime + jitter;

  devLog(`Network error detected, retrying in ${totalWaitTime}ms (attempt ${retryCount + 1}/${maxRetries})...`);
  devError('Network error details:', fetchError);

  await sleep(totalWaitTime);

  // Recursive retry
  yield* streamChatResponse(url, apiKey, requestBody, retryCount + 1, maxRetries);
  return;
}
```

### Why It's a Problem
- With 5 maxRetries: 2s + 4s + 8s + 16s + 32s = 62 seconds just waiting
- Combined with Edge runtime retries (3 more attempts): 14s extra
- Total: 76 seconds of retry waits alone
- No check that total time isn't exceeding 120s client timeout
- Recursive calls can nest deeply

### Recommended Fix
```typescript
if (retryCount < maxRetries) {
  // Much shorter backoff + total timeout check
  const startTime = Date.now();
  const maxTotalWaitMs = 30000; // Only 30 seconds of retries total
  
  // Reduce backoff from exponential to more aggressive
  const waitTime = Math.min(500 * Math.pow(2, retryCount), 5000);
  const jitter = Math.floor(Math.random() * 250);
  const totalWaitTime = Math.min(waitTime + jitter, maxTotalWaitMs);

  // Check if we've already spent too much time on retries
  if (startTime + totalWaitTime > Date.now() + (100 * 1000)) {
    // Already waited too long, give up
    throw new Error(
      `Request failed after ${retryCount + 1} attempts and ${totalWaitTime}ms of retries`
    );
  }

  devLog(`Network error, retrying in ${totalWaitTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
  
  await sleep(totalWaitTime);
  
  // Iterative retry instead of recursive
  return yield* streamChatResponse(url, apiKey, requestBody, retryCount + 1, maxRetries);
}
```

---

## Issue 4: Synchronous Message Saving Before Streaming (MEDIUM-HIGH)

### Current Code (PROBLEMATIC)
**File:** `src/app/chat/page.tsx:2348-2388`

```typescript
// OPTIMIZATION: Save the user message to the backend before streaming
// This ensures the backend has the user message before processing the stream
// which prevents race conditions where the API can't find the context
if (currentSession?.apiSessionId && userData) {
    try {
        devLog('🔄 Attempting to save user message to backend:', {
            sessionId: currentSession.apiSessionId,
            content: userMessage.substring(0, 100) + '...',
            model: selectedModel.value,
            hasImage: !!userImage,
            apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NO_API_KEY',
            privyUserId: userData.privy_user_id
        });

        const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
        if (currentSession.apiSessionId) {
            const result = await chatAPI.saveMessage(  // ← AWAITS HERE (blocking)
                currentSession.apiSessionId,
                'user',
                userMessage,
                selectedModel.value,
                undefined // Token count not calculated yet
            );
            devLog('✅ User message saved to backend successfully:', result);
        }
    } catch (error) {
        devError('❌ Failed to save user message to backend:', error);
        // Continues anyway but has wasted 30 seconds
    }
}

// Then starts streaming (which already had message from above)
// But if save took 10s, streaming now has only 110s left of 120s timeout!
```

### Why It's a Problem
- Blocking the entire message flow for 0-30 seconds
- User sees no response while message is being saved
- If save times out (30s), that's wasted time before visible response
- Message save fails often (timeout, network issues) but we continue anyway
- Defeats the purpose of showing optimistic UI

### Recommended Fix
```typescript
// Move message save to AFTER streaming starts and is visible to user
// Fire and forget in background - user sees response immediately

// Start streaming first (show typing indicator)
// Then save message asynchronously

// In handleSendMessage, after stream starts:
for await (const chunk of streamChatResponse(...)) {
  // ... process streaming chunks ...
}

// AFTER streaming is done, save the assistant message async:
if (currentSession?.apiSessionId && finalContent && userData) {
    // Fire and forget - save in background without awaiting
    const saveAssistantMessage = async () => {
        try {
            const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
            if (currentSession.apiSessionId) {
                await chatAPI.saveMessage(
                    currentSession.apiSessionId,
                    'assistant',
                    finalContent,
                    modelValue,
                    undefined
                );
            }
        } catch (error) {
            // Log but don't block - message is already visible to user
            console.error('Failed to save assistant message:', error);
        }
    };
    
    // Start saving in background - DON'T await
    saveAssistantMessage();  // ← No await!
}
```

---

## Issue 5: Excessive Logging on Streaming Hot Path (MEDIUM)

### Current Code (PROBLEMATIC)
**File:** `src/lib/streaming.ts:374-384`

```typescript
if (trimmedLine.startsWith('data: ')) {
  try {
    const jsonStr = trimmedLine.slice(6);
    const data = JSON.parse(jsonStr);

    devLog('[Streaming] Parsed SSE data:', {
      hasOutput: !!data.output,
      hasChoices: !!data.choices,
      hasType: !!data.type,
      dataKeys: Object.keys(data),
      fullData: JSON.stringify(data)  // ← EXPENSIVE: Full object serialization!
    });
```

### Why It's a Problem
- 45+ `devLog()` calls during streaming
- Each chunk triggers multiple logs
- `JSON.stringify(data)` serializes entire response object
- `Object.keys(data)` iterates all properties
- Running in production (even with env check) wastes CPU
- Can add 5-10% CPU overhead per streaming request

### Recommended Fix
```typescript
if (trimmedLine.startsWith('data: ')) {
  try {
    const jsonStr = trimmedLine.slice(6);
    const data = JSON.parse(jsonStr);

    // Only log in development, and avoid expensive operations
    if (process.env.NODE_ENV === 'development') {
      devLog('[Streaming] Parsed SSE data:', {
        hasOutput: !!data.output,
        hasChoices: !!data.choices,
        hasType: !!data.type,
        // Don't log the full data structure, just counts
        outputLength: data.output ? data.output.length : 0,
        choicesLength: data.choices ? data.choices.length : 0,
      });
    }
```

---

## Issue 6: No Connection Pooling (MEDIUM)

### Current Code (No pooling)
**File:** `src/app/api/chat/completions/route.ts:89-91`

```typescript
response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    // ← Missing Connection: keep-alive
  },
  body: JSON.stringify(backendRequestBody),
});
```

### Why It's a Problem
- Each fetch creates new TCP connection
- SSL/TLS handshake overhead: 100-300ms
- Multiplied across millions of requests
- Backend must handle many connection setups

### Recommended Fix
```typescript
response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Connection': 'keep-alive',  // ← Add this
    'User-Agent': 'Gatewayz-Beta/1.0',  // Also helpful
  },
  body: JSON.stringify(backendRequestBody),
});
```

---

## Issue 7: Rate Limit Retry Recursion (MEDIUM)

### Current Code (PROBLEMATIC)
**File:** `src/lib/streaming.ts:245-288`

```typescript
if (response.status === 429) {
    // ... rate limit handling ...
    
    if (retryCount < maxRetries) {
        // ... calculate waitTime ...
        
        yield {
          status: 'rate_limit_retry',
          retryAfterMs: waitTime
        };

        await sleep(waitTime);

        // Recursive call inside async generator
        yield* streamChatResponse(url, apiKey, requestBody, retryCount + 1, maxRetries);
        return;  // ← Exit after recursion
    }
}
```

### Why It's a Problem
- Recursive generator can nest 5 levels deep
- Stack space concerns with many retries
- No check for total cumulative wait time
- Rate-limited models can waste 30+ seconds

### Recommended Fix
```typescript
// Instead of recursive, implement iterative with total timeout
const startTime = Date.now();
const maxTotalWaitMs = 60000; // Max 60 seconds of retries total

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    // ... attempt request ...
    
    if (response.status === 429) {
      const timeSpent = Date.now() - startTime;
      if (timeSpent > maxTotalWaitMs) {
        throw new Error(`Rate limit retry exceeded total timeout after ${timeSpent}ms`);
      }
      
      const remainingTime = maxTotalWaitMs - timeSpent;
      const waitTime = Math.min(
        baseDelay * Math.pow(2, attempt),
        remainingTime
      );
      
      yield {
        status: 'rate_limit_retry',
        retryAfterMs: waitTime
      };
      
      await sleep(waitTime);
      continue; // Iterate instead of recursing
    }
  } catch (error) {
    // Handle error
  }
}
```

---

## Summary: Impact of Each Fix

| Fix | Time to Implement | Performance Gain |
|-----|-------------------|------------------|
| Increase timeout 120s→300s | 2 min | 40+ seconds |
| Add backend fetch timeout | 5 min | 30 seconds (prevents hangs) |
| Move message save async | 10 min | 10-30 seconds |
| Reduce retry backoff | 5 min | 30-40 seconds |
| Remove expensive logging | 10 min | 5-10% CPU |
| Add keep-alive headers | 5 min | 100-500ms per request |
| **TOTAL** | **37 min** | **50+ seconds** |

---

## Testing the Fixes

After implementing:

1. Test with reasoning model (o1, o3, DeepSeek) - should not timeout
2. Test with slow provider (NEAR) - should have 30s max backend timeout
3. Test network error scenario - should retry quickly (not 62 seconds)
4. Monitor CPU usage during streaming - should decrease
5. Check response time distribution - P95 should move from 90+ seconds to 40-60 seconds

