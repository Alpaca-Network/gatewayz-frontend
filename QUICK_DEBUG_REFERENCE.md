# Quick Debug Reference Card

## 🚨 Quick Fixes

### "Chat not loading"
1. Check browser console for errors
2. Verify API key: `localStorage.getItem('gatewayz_api_key')`
3. Check auth status: Look for "[Auth]" logs in console
4. **Fix**: Hard refresh (`Ctrl+Shift+R`)

### "Auto-send not working"
1. Verify URL has `?message=hello`
2. Check console for: `[AutoSend] All conditions met!`
3. Look for error: "Request timed out" or "Rate limit exceeded"
4. **Fix**: Manually send message and check errors

### "Timeout after 2 minutes"
1. Model might be cold-starting
2. Check backend logs: `pm2 logs gatewayz-frontend`
3. Look for: `[API Proxy] Request timed out`
4. **Fix**: Retry after a minute, rate limit may have activated

### "Rate limit (429) error"
1. Too many requests to backend
2. Server should auto-retry (up to 3 times)
3. If retries exhausted, wait before trying again
4. **Fix**: Wait ~60 seconds and try again

---

## 🎯 Essential Console Logs to Check

| What | Log | What to Look For |
|------|-----|------------------|
| API Key | `Chat sessions - API Key found: true` | Should be TRUE |
| Sessions Loaded | `Chat sessions - Loaded X sessions` | X should be > 0 |
| Auth Complete | `[Auth] User authenticated` | Should appear |
| Auto-Send Ready | `[AutoSend] All conditions met!` | Should appear if URL has ?message= |
| API Call | `[API Proxy] POST request received` | Confirms backend received |
| Response Time | `[API Proxy] Backend response time: XXXms` | Should be < 5000ms |
| Streaming | `Streaming response received` | Confirms stream started |

---

## 🔍 Network Tab Debugging

### Check These Requests

1. **POST /api/chat/sessions** (Create session)
   - Status: Should be `200`
   - Response: `{ id: "api-123", title: "Untitled Chat", ... }`
   - Time: Should be < 1s

2. **POST /api/chat/completions** (Send message)
   - Status: Should be `200`
   - Response Type: `text/event-stream` (for streaming)
   - Time: Variable (5s to 2min depending on model)

3. **Failed Requests** (If any)
   - Look for status `429`, `500`, `504`
   - Check error response body for details
   - Example: `{ error: "Rate limit exceeded" }`

---

## 📋 State Snapshot Commands

Copy and paste these in browser console:

```javascript
// Check current state
JSON.stringify({
  apiKey: !!localStorage.getItem('gatewayz_api_key'),
  sessionCount: document.querySelectorAll('[data-session-id]').length,
  hasActiveSession: !!document.querySelector('[data-session-active]'),
  modelSelected: document.querySelector('[data-model-select]')?.value,
  messageFieldEmpty: document.querySelector('textarea')?.value.length === 0
}, null, 2)
```

```javascript
// Monitor performance
setInterval(() => {
  const entries = performance.getEntriesByType('measure');
  console.table(entries.map(e => ({
    name: e.name,
    duration: e.duration.toFixed(0) + 'ms'
  })));
}, 5000)
```

---

## 🔧 Environment Setup Checklist

**Before debugging, verify:**

- [ ] `.env.local` exists
- [ ] `NEXT_PUBLIC_PRIVY_APP_ID` is set
- [ ] `NEXT_PUBLIC_API_BASE_URL` is set (or defaults to `https://api.gatewayz.ai`)
- [ ] API key is available (from auth or localStorage)
- [ ] Backend is running and accessible

**Check with:**
```bash
# .env.local exists?
ls .env.local

# Backend accessible?
curl https://api.gatewayz.ai/health

# PM2 running?
pm2 list
```

---

## 📞 Getting Help

### Provide These Details

1. **Browser**: Chrome, Firefox, Safari, etc.
2. **Error Message**: Exact error text from console
3. **Console Logs**: Last 20 lines of console output
4. **Network Requests**: Screenshot of network tab
5. **Steps to Reproduce**: Exact steps to trigger issue
6. **Backend Status**: `pm2 status` output
7. **Recent Logs**: `pm2 logs gatewayz-frontend --lines 100`

### Example Bug Report Format

```
**Issue**: Chat not loading after login
**Browser**: Chrome 120 on Windows
**Error**: "Cannot find module '@/lib/performance-profiler'"
**Console Logs**:
  [Chat Page] Component mounted
  ❌ Error: Module not found
**Network**: GET /chat status 200, no API calls attempted
**Steps**:
  1. Navigate to /chat
  2. Login with Privy
  3. See blank page
**Fix Applied**: Cleared cache and hard refreshed
```

---

## 🚀 One-Click Debug Command

```bash
# Complete debug report
echo "=== ENVIRONMENT ===" && \
echo "API Base URL: ${NEXT_PUBLIC_API_BASE_URL}" && \
echo "Privy App ID: ${NEXT_PUBLIC_PRIVY_APP_ID:0:15}..." && \
echo "" && \
echo "=== PM2 STATUS ===" && \
pm2 status && \
echo "" && \
echo "=== RECENT LOGS (last 50 lines) ===" && \
pm2 logs gatewayz-frontend --lines 50
```

---

## 🎓 Learning Resources

- **Session Flow**: See `SESSION_CREATION_DEBUG_GUIDE.md`
- **API Routes**: `src/app/api/chat/completions/route.ts`
- **React Hooks**: `src/app/chat/page.tsx:1156-1400` (state initialization)
- **Error Handling**: `src/app/api/middleware/error-handler.ts`

---

**Last Updated**: 2025-01-17  
**Status**: Active  
**Maintained By**: Development Team

