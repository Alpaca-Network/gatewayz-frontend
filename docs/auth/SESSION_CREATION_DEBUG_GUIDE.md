# Session Creation & Chat Experience Debug Guide

## 📋 Overview

This document outlines the session creation flow and provides debugging steps for chat experience issues.

## 🔄 Session Creation Flow

### Flow Diagram

```
User navigates to /chat
    ↓
ChatPageContent component mounts
    ↓
useEffect: loadChatSessions() - Load existing sessions
    ↓
Auto-detect message parameter in URL (?message=...)
    ↓
Set shouldAutoSend = true if message exists
    ↓
Wait for authentication (Privy)
    ↓
User authenticates or API key is available
    ↓
Create new session (Untitled Chat)
    ↓
Auto-send message to new session
    ↓
Stream response and display
```

## 🔧 Key Components

### 1. **Session Loading** (`loadChatSessions`)
- **Location**: `src/app/chat/page.tsx:251-287`
- **Responsibility**: Fetch existing sessions from API
- **Debug**: Check console for "Chat sessions - API Key found" log
- **Return**: Array of `ChatSession` objects with empty messages

### 2. **Session Creation** (`createNewChat`)
- **Location**: `src/app/chat/page.tsx:1801-1851`
- **Responsibility**: Create new untitled chat session
- **Key Logic**:
  - Check if untitled chat already exists
  - Prevent duplicate creation with `creatingSessionRef`
  - API call via `apiHelpers.createChatSession()`
  - Update sessions state immediately

### 3. **Auto-Send Mechanism**
- **Location**: `src/app/chat/page.tsx:2098-2150` (estimated)
- **Triggers**: When message param in URL AND session ready
- **Condition**: 
  - `shouldAutoSend` = true
  - `activeSessionId` exists
  - Message text not empty
  - Model selected
  - NOT loading/streaming

### 4. **Message Sending** (`handleSendMessage`)
- **Location**: `src/app/chat/page.tsx:2200+` (estimated)
- **Responsibility**: Send message and stream response
- **Flow**:
  1. Validate message and session
  2. Add user message to chat
  3. Call `/api/chat/completions`
  4. Stream response chunks
  5. Handle errors with fallback logic

---

## 🐛 Common Issues & Debug Steps

### Issue 1: Session Not Created
**Symptoms**: 
- "Untitled Chat" not appearing
- No `activeSessionId` set
- Stuck on loading screen

**Debug Steps**:
```javascript
// Check in browser console:
// 1. Is API key present?
localStorage.getItem('gatewayz_api_key')

// 2. Are sessions loaded?
// Look for: "Chat sessions - Loaded X sessions" in console

// 3. Is createNewChat being called?
// Look for: Console logs in createChatSession()

// 4. Check network tab
// POST /api/chat/sessions should be called
// Check response for error details
```

**Common Causes**:
- ❌ Missing API key
- ❌ Authentication not complete
- ❌ `creatingSessionRef` stuck at true
- ❌ Backend API error (500/429)

---

### Issue 2: Auto-Send Not Triggering
**Symptoms**:
- Message in URL but not auto-sent
- User has to click send manually
- No error messages

**Debug Steps**:
```javascript
// In browser console, look for these logs:
console.log('[AutoSend] Effect triggered:', {
    shouldAutoSend,
    activeSessionId,
    hasMessage,
    hasModel,
    loading,
    isStreamingResponse
});

// All these must be true:
✓ shouldAutoSend = true
✓ activeSessionId = "api-XXX"
✓ message.trim().length > 0
✓ selectedModel != null
✓ loading = false
✓ isStreamingResponse = false
```

**Common Causes**:
- ❌ Session not created before auto-send check
- ❌ `shouldAutoSend` flag reset too early
- ❌ Model not selected
- ❌ Still in loading state

---

### Issue 3: Chat Hanging/Timeout
**Symptoms**:
- Message sent but no response
- "Request timed out" error after 2 minutes
- Fallback attempting repeatedly

**Debug Steps**:
```javascript
// Check server logs for:
[API Proxy] Making fetch request to backend
[API Proxy] Response status: XXX
[API Proxy] Rate limit error (429)

// Check response time in Network tab:
// POST /api/chat/completions
// Response time should be < 2 minutes (120,000ms)

// Check if retry logic is working:
[API Proxy] Retry attempt 1/3 after XXXms delay
```

**Common Causes**:
- ❌ Backend API is slow/overloaded
- ❌ Model cold-start time
- ❌ Rate limit (429) not being retried properly
- ❌ Network connectivity issues

---

### Issue 4: Rate Limit Errors (429)
**Symptoms**:
- "Burst limit exceeded" error
- Request fails after retries
- Multiple attempts visible in logs

**Debug Steps**:
```javascript
// Check server logs:
[API Proxy] Rate limit error (429) on attempt X/Y
[API Proxy] Error detail: XXX
[API Proxy] Retry-After header: XXX

// Verify retry logic:
- Should retry up to 3 times
- Delay: 1000ms + exponential backoff
- Max delay: 10,000ms (burst) or 30,000ms

// Check if Retry-After header is respected
```

**Common Causes**:
- ❌ Backend has restrictive burst limits
- ❌ Too many requests from same IP
- ❌ Rate limit not being respected by backend

---

## 📊 Monitoring Dashboard

### Key Metrics to Track

| Metric | Expected | Alert If |
|--------|----------|----------|
| Session creation time | < 1s | > 3s |
| First message response | < 5s (TTFB) | > 10s |
| Full response time | < 30s | > 60s |
| Auto-send trigger | Immediate | > 2s delay |
| 429 error rate | < 5% | > 15% |

### Real-Time Logging

Add to chat page for detailed debugging:

```javascript
// Add to console during debugging:
window.debugChat = {
    getState: () => ({
        sessionId: activeSessionId,
        shouldAutoSend,
        loading,
        isStreaming: isStreamingResponse,
        model: selectedModel?.value,
        messageLength: message.length,
        sessionCount: sessions.length
    }),
    logPerformance: () => {
        const perfEntries = performance.getEntriesByType('measure');
        console.table(perfEntries);
    }
};

// Usage: window.debugChat.getState()
```

---

## 🚀 Performance Optimization Checklist

### Frontend
- [ ] Check if models are eagerly loaded (`useEagerModelPreload`)
- [ ] Verify session list is memoized properly
- [ ] Ensure no unnecessary re-renders (check React DevTools)
- [ ] Validate that state updates are batched

### Backend
- [ ] Check API response times (`X-Response-Time` header)
- [ ] Verify database query performance
- [ ] Monitor rate limit configuration
- [ ] Check for cold-start delays

### Network
- [ ] Enable gzip compression
- [ ] Use HTTP/2 connection
- [ ] Check DNS resolution time
- [ ] Minimize payload sizes

---

## 🔍 Console Log Mapping

### Expected Log Sequence (Happy Path)

```
1. [Chat Page] Component mounted
2. Chat sessions - API Key found: true
3. Chat sessions - Making API request to getSessions
4. Chat sessions - Loaded X sessions
5. [AutoSend] Effect triggered: { shouldAutoSend: false, ... }
6. [Auth] User authenticated via Privy
7. Create session - Making API request to createSession
8. [AutoSend] Session needed for auto-send, will be handled by session loading logic
9. [AutoSend] All conditions met! Sending message now...
10. [Chat API] Sending message request to /api/chat/completions
11. [API Proxy] POST request received
12. [API Proxy] Response status: 200
13. ✓ Message received and streamed
```

### Error Sequence Examples

**No API Key**:
```
Chat sessions - API Key found: false
Chat sessions - API Key preview: None
⚠️ No API key found, returning empty sessions
```

**Session Creation Failed**:
```
Create session - Making API request to createSession
❌ Error: Failed to create session
(Check network tab for backend error details)
```

**Timeout**:
```
[API Proxy] Making fetch request to backend
[API Proxy] Request timed out, not retrying
❌ Error: Request timed out after 2 minutes
```

---

## 📝 Testing Checklist

### Before Pushing Changes

- [ ] **Unit Tests**: Run `pnpm test`
- [ ] **Type Check**: Run `pnpm typecheck`
- [ ] **Build**: Run `pnpm build` (no errors)
- [ ] **Manual Testing**:
  - [ ] Create new chat
  - [ ] Auto-send with URL parameter
  - [ ] Send multiple messages
  - [ ] Switch between sessions
  - [ ] Rename session
  - [ ] Delete session
  - [ ] Model selection works
  - [ ] Streaming works
  - [ ] Error handling works

### After Deploying

- [ ] Monitor error logs for 1 hour
- [ ] Check performance metrics
- [ ] Verify rate limiting is working
- [ ] Test on different browsers
- [ ] Test on mobile

---

## 🔗 Related Files

- **Chat Page**: `src/app/chat/page.tsx`
- **API Route**: `src/app/api/chat/completions/route.ts`
- **Chat History API**: `src/lib/chat-history.ts`
- **Streaming Utility**: `src/lib/streaming.ts`
- **Config**: `src/lib/config.ts`

---

## 💡 Tips & Tricks

### Quick Debugging
```javascript
// Paste in console to get current state:
copy(JSON.stringify(window.debugChat.getState(), null, 2))

// Monitor network requests:
// DevTools → Network → Filter: "chat"

// Check localStorage:
Object.entries(localStorage).forEach(([k, v]) => 
  k.includes('gatewayz') && console.log(k, v)
)
```

### Performance Profiling
```javascript
// In DevTools Performance tab:
1. Press Record
2. Perform action (create session, send message)
3. Stop recording
4. Analyze flame graph for bottlenecks
```

### Network Debugging
```javascript
// Filter by type in Network tab:
- xhr/fetch → API requests
- media → Images/videos
- font → Fonts
- js → JavaScript files

// Check response headers:
- X-Response-Time: Server processing time
- Retry-After: Rate limit wait time
- Content-Type: Response format
```

---

## 🆘 When All Else Fails

1. **Clear cache**: `localStorage.clear()` + `sessionStorage.clear()`
2. **Hard refresh**: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
3. **Restart backend**: `pm2 restart gatewayz-frontend`
4. **Check .env.local**: Verify all environment variables are set
5. **View server logs**: `pm2 logs gatewayz-frontend | tail -100`

---

Generated: 2025-01-17

