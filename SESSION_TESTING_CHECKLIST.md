# Session Creation & Chat Experience Testing Checklist

## 🎯 Pre-Release Testing

Complete this checklist before considering any changes production-ready.

---

## ✅ Core Functionality Tests

### 1. Session Management

- [ ] **Create Session**
  - [ ] Click "New Chat" creates untitled session
  - [ ] Session appears in sidebar immediately
  - [ ] Session ID follows format `api-XXX` or `local-XXX`
  - [ ] Can create multiple sessions without issues
  - [ ] Check console: `Create session - Making API request to createSession`

- [ ] **Load Sessions**
  - [ ] Previous sessions load on page visit
  - [ ] Sessions list shows correct count
  - [ ] Session titles and dates display correctly
  - [ ] Empty sessions don't show in sidebar
  - [ ] Check console: `Chat sessions - Loaded X sessions`

- [ ] **Switch Sessions**
  - [ ] Click session in sidebar switches view
  - [ ] Chat history loads for selected session
  - [ ] Model/message field reset appropriately
  - [ ] Active session highlighted in sidebar
  - [ ] Messages from old session no longer visible

- [ ] **Rename Session**
  - [ ] Can edit session title
  - [ ] Title updates in sidebar immediately
  - [ ] Title persists after page reload
  - [ ] Special characters handled correctly

- [ ] **Delete Session**
  - [ ] Can delete session from sidebar
  - [ ] Session removed from list
  - [ ] Switching to new session if deleted session was active
  - [ ] Confirmation dialog appears (if implemented)

---

### 2. Message Sending & Streaming

- [ ] **Send Message**
  - [ ] Message appears in chat when sent
  - [ ] Message field clears after sending
  - [ ] Loading indicator shows while waiting
  - [ ] Can't send empty messages
  - [ ] Can't send while previous message streaming

- [ ] **Streaming Response**
  - [ ] AI response streams in real-time
  - [ ] Response displays character by character
  - [ ] No garbled or duplicate text
  - [ ] Streaming completes without errors
  - [ ] Total response time tracked in console

- [ ] **Multiple Messages**
  - [ ] Can send message after first response completes
  - [ ] Chat history maintains correct order
  - [ ] All messages persist in session
  - [ ] No message overlap or duplication

- [ ] **Model Selection**
  - [ ] Can select different models
  - [ ] Selected model persists in UI
  - [ ] Model used in API request matches selection
  - [ ] Model indicator shows in message metadata

---

### 3. Auto-Send Feature

- [ ] **URL Parameter Detection**
  - [ ] Visit: `/chat?message=hello%20world`
  - [ ] Message field populated: "hello world"
  - [ ] Session created automatically
  - [ ] Message sent without clicking send button

- [ ] **Auto-Send Conditions**
  - [ ] Works only with authenticated user
  - [ ] Works only with valid API key
  - [ ] Works only with model selected
  - [ ] Works only when chat is ready (not loading)

- [ ] **Multiple URL Parameters**
  - [ ] `/chat?message=hello&model=gpt-4` - Auto-sends with specified model
  - [ ] Only message param processed (model param ignored if not supported)
  - [ ] Extra params don't break auto-send

- [ ] **Auto-Send Edge Cases**
  - [ ] Very long message: `/chat?message=` + 1000 chars
  - [ ] Special characters: `/chat?message=what%27s%20up%3F`
  - [ ] URL encoded characters decoded properly
  - [ ] Works on first page load (not just subsequent)

---

## 🚨 Error Handling Tests

### 4. Error Scenarios

- [ ] **Network Errors**
  - [ ] Disconnect network, send message
  - [ ] Error message displayed: "Could not connect to backend API"
  - [ ] Can retry after reconnecting
  - [ ] Console shows: "Network error" in error details

- [ ] **Timeout Errors**
  - [ ] Send message with very slow model
  - [ ] After 2 minutes: "Request timed out after 2 minutes"
  - [ ] Can retry or switch model
  - [ ] Session still accessible

- [ ] **Rate Limit (429) Errors**
  - [ ] Send many messages rapidly
  - [ ] Server retries automatically (up to 3 times)
  - [ ] Console shows: `[API Proxy] Retry attempt X/3`
  - [ ] If retries exhausted: "Rate limit exceeded"
  - [ ] Can retry after waiting

- [ ] **Model Not Found (404) Errors**
  - [ ] Try with invalid/missing model
  - [ ] Error: "Model not found or unavailable"
  - [ ] Fallback model automatically selected if available
  - [ ] Console shows fallback attempt

- [ ] **Server Errors (500)**
  - [ ] Simulate backend 500 error
  - [ ] Error displayed to user
  - [ ] Fallback model offered if applicable
  - [ ] Can switch model and retry

- [ ] **API Key Missing**
  - [ ] Clear localStorage, try to send message
  - [ ] Error: "API key required"
  - [ ] User prompted to authenticate/set key
  - [ ] Suggest viewing settings/API keys page

---

### 5. Authentication Tests

- [ ] **Login Flow**
  - [ ] Click login button
  - [ ] Privy modal opens
  - [ ] Can sign in with email/Google/wallet
  - [ ] Redirects to chat after login
  - [ ] API key automatically saved

- [ ] **Session Persistence**
  - [ ] Login, close browser
  - [ ] Reopen /chat
  - [ ] Already logged in (no login required)
  - [ ] Previous sessions loaded

- [ ] **Logout Flow**
  - [ ] Click logout in settings
  - [ ] User logged out
  - [ ] Redirects to login page
  - [ ] localStorage cleared
  - [ ] Can't access chat without re-login

- [ ] **API Key Management**
  - [ ] View API keys in settings
  - [ ] Can generate new key
  - [ ] Can revoke old key
  - [ ] New key works immediately
  - [ ] Old key stops working

---

## 📊 Performance Tests

### 6. Performance & Timing

- [ ] **Session Creation Speed**
  - [ ] Time to create new session: **< 1 second**
  - [ ] Console shows: `[API Proxy] Backend response time: XXXms`
  - [ ] Should be < 500ms for backend

- [ ] **Session Loading Speed**
  - [ ] Time to load 10 sessions: **< 2 seconds**
  - [ ] Time to load 50 sessions: **< 5 seconds**
  - [ ] Lazy-load message data (don't load all on startup)

- [ ] **Message Response Time**
  - [ ] Time to first byte (TTFB): **< 5 seconds**
  - [ ] Streaming starts quickly (not buffering entire response)
  - [ ] Full response time varies by model (5s to 2min is acceptable)

- [ ] **UI Responsiveness**
  - [ ] Sidebar switches sessions instantly (< 100ms)
  - [ ] Message field responsive to typing
  - [ ] Model dropdown opens quickly
  - [ ] No lag when streaming text

- [ ] **Memory Usage**
  - [ ] Keep chat open for 1 hour
  - [ ] Memory usage stays under 200MB
  - [ ] No memory leaks (check DevTools Memory tab)
  - [ ] Chat still responsive after long session

---

## 🧪 Browser Compatibility Tests

### 7. Cross-Browser Testing

Test on each browser at least once:

- [ ] **Chrome/Chromium**
  - [ ] Latest version
  - [ ] Create session ✓
  - [ ] Send message ✓
  - [ ] Stream response ✓
  - [ ] Error handling ✓

- [ ] **Firefox**
  - [ ] Latest version
  - [ ] Create session ✓
  - [ ] Send message ✓
  - [ ] Stream response ✓
  - [ ] Error handling ✓

- [ ] **Safari**
  - [ ] Latest version
  - [ ] Create session ✓
  - [ ] Send message ✓
  - [ ] Stream response ✓
  - [ ] Error handling ✓

- [ ] **Edge**
  - [ ] Latest version
  - [ ] Create session ✓
  - [ ] Send message ✓
  - [ ] Stream response ✓
  - [ ] Error handling ✓

---

## 📱 Mobile Testing

### 8. Mobile Experience

- [ ] **iPhone (Safari)**
  - [ ] Sidebar opens/closes
  - [ ] Chat area readable
  - [ ] Keyboard doesn't hide message input
  - [ ] Send button accessible

- [ ] **Android (Chrome)**
  - [ ] Sidebar opens/closes
  - [ ] Chat area readable
  - [ ] Streaming display properly
  - [ ] Model selection works

- [ ] **Tablet (iPad/Android)**
  - [ ] Layout adapts well
  - [ ] Split view (sidebar + chat) usable
  - [ ] Responsive design correct

---

## 🔍 Console & Network Monitoring

### 9. Developer Tools Tests

- [ ] **No Console Errors**
  - [ ] Open DevTools Console
  - [ ] Complete full flow (create session → send message → receive response)
  - [ ] No red error icons
  - [ ] No TypeScript errors
  - [ ] No unhandled promise rejections

- [ ] **Network Requests**
  - [ ] POST `/api/chat/sessions` - 200 (< 1s)
  - [ ] POST `/api/chat/completions` - 200 (< 5s TTFB)
  - [ ] GET network requests optional only

- [ ] **Request Headers**
  - [ ] Authorization header present
  - [ ] Content-Type: application/json
  - [ ] User-Agent present
  - [ ] No sensitive info in headers

- [ ] **Response Headers**
  - [ ] Content-Type correct (application/json or text/event-stream)
  - [ ] X-Request-ID present
  - [ ] X-Response-Time present
  - [ ] Cache headers appropriate

---

## 📝 Code Quality Tests

### 10. Code & Build Quality

- [ ] **TypeScript Compilation**
  - [ ] Run: `pnpm typecheck`
  - [ ] No type errors
  - [ ] No type warnings

- [ ] **ESLint/Linting**
  - [ ] Run: `pnpm lint`
  - [ ] No critical errors
  - [ ] Warnings reviewed and acceptable

- [ ] **Build Success**
  - [ ] Run: `pnpm build`
  - [ ] Completes without errors
  - [ ] Build time reasonable (< 3 minutes)

- [ ] **Test Suite**
  - [ ] Run: `pnpm test`
  - [ ] All tests pass
  - [ ] No skipped tests
  - [ ] Coverage adequate (> 70% for critical paths)

---

## 🚀 Production Pre-Flight Checklist

### 11. Final Checks Before Deploy

- [ ] **All tests passing**: ✓ Unit, integration, e2e
- [ ] **No console errors**: ✓ Verified in multiple browsers
- [ ] **Performance acceptable**: ✓ All timing targets met
- [ ] **Mobile tested**: ✓ Works on iOS and Android
- [ ] **Error handling verified**: ✓ All error paths tested
- [ ] **Code reviewed**: ✓ Changes reviewed by team
- [ ] **Documentation updated**: ✓ README, guides updated
- [ ] **Changelog updated**: ✓ Version, changes noted
- [ ] **No sensitive data**: ✓ No API keys in code
- [ ] **Monitoring in place**: ✓ Error tracking, performance monitoring

---

## 📋 Test Results Template

```markdown
## Test Session: [DATE]

**Tester**: [NAME]
**Build Version**: [COMMIT HASH]
**Browser**: [BROWSER] [VERSION]
**OS**: [OS] [VERSION]

### Results

- [ ] Session Creation: ✓ PASS / ✗ FAIL
- [ ] Message Sending: ✓ PASS / ✗ FAIL
- [ ] Streaming: ✓ PASS / ✗ FAIL
- [ ] Auto-Send: ✓ PASS / ✗ FAIL
- [ ] Error Handling: ✓ PASS / ✗ FAIL

### Issues Found

1. [Issue description]
   - Steps: [How to reproduce]
   - Expected: [What should happen]
   - Actual: [What actually happened]

### Performance Metrics

- Session creation: XXXms
- TTFB: XXXms
- Full response: XXXms

### Sign-Off

- All tests passed: YES / NO
- Ready for production: YES / NO
- Approval: [NAME] [DATE]
```

---

## 🎯 Quick Test Run (5 minutes)

If you only have 5 minutes, run this:

1. **✓ Create Session**: Click "New Chat"
2. **✓ Send Message**: Type "Hello" and send
3. **✓ Wait for Response**: Verify streaming works
4. **✓ Check Console**: Verify no errors
5. **✓ Network Tab**: Verify 200 status codes

If all 5 items pass, basic functionality works! ✅

---

**Last Updated**: 2025-01-17  
**Test Environment**: Local + Staging  
**Approval Required**: Before Production Deploy

