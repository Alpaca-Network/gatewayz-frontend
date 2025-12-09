# Guest Chat Debugging Guide

## Issue
Non-authenticated users cannot load prior chat sessions when clicking them in the chat sidebar.

## Debugging Changes Deployed

### 1. Console Logging Added

**File: `src/components/chat-v2/ChatSidebar.tsx:131`**
```typescript
console.log('[ChatSidebar] Session selected:', sessionId, 'isAuthenticated:', isAuthenticated);
```

**File: `src/lib/hooks/use-chat-queries.ts:77, 83`**
```typescript
console.log('[useSessionMessages] Fetching messages for session:', sessionId, 'isAuthenticated:', isAuthenticated);
console.log('[useSessionMessages] Guest messages loaded:', messages.length, 'messages for session', sessionId);
```

### 2. Fixes Applied

✅ **DialogDescription accessibility warnings** - Fixed in ChatSidebar and SuccessPopup
✅ **Session click handler** - Added `stopPropagation` to prevent dropdown menu interference

## How to Check Railway Logs

### Option 1: Railway Dashboard (Easiest)
1. Go to https://railway.app
2. Select your project
3. Click on the frontend service
4. Go to **Deployments** tab
5. Click on the latest deployment
6. View **Logs** tab
7. Search for:
   - `[ChatSidebar]` - Session selection events
   - `[useSessionMessages]` - Message loading events
   - `Guest messages loaded` - Successful guest message retrieval

### Option 2: Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs in real-time
railway logs --follow

# Filter logs
railway logs | grep "ChatSidebar"
railway logs | grep "useSessionMessages"
```

## What to Look For

### Expected Flow (Working)
```
[ChatSidebar] Session selected: -1234567890 isAuthenticated: false
[useSessionMessages] Fetching messages for session: -1234567890 isAuthenticated: false
[useSessionMessages] Guest messages loaded: 2 messages for session -1234567890
```

### Problem Indicators

1. **Session not loading**:
   ```
   [ChatSidebar] Session selected: -1234567890 isAuthenticated: false
   [useSessionMessages] Fetching messages for session: -1234567890 isAuthenticated: false
   [useSessionMessages] Guest messages loaded: 0 messages for session -1234567890
   ```
   → Messages not found in localStorage

2. **Query not triggering**:
   ```
   [ChatSidebar] Session selected: -1234567890 isAuthenticated: false
   (no useSessionMessages log)
   ```
   → React Query not refetching (cache or enabled flag issue)

3. **Wrong session ID**:
   ```
   [ChatSidebar] Session selected: 123 isAuthenticated: false
   ```
   → Positive session ID for guest user (should be negative)

## Testing Steps

### 1. Test as Guest User
1. Open browser in **incognito/private mode**
2. Navigate to `/chat`
3. Send a message (creates session)
4. Open browser console (F12)
5. Click on the session in the sidebar
6. Check console for the log messages above

### 2. Check localStorage
```javascript
// In browser console
JSON.parse(localStorage.getItem('gatewayz_guest_sessions'))
JSON.parse(localStorage.getItem('gatewayz_guest_messages'))
```

Should show:
- Sessions array with negative IDs
- Messages object keyed by session ID

### 3. Verify in Railway Logs
After testing in browser:
1. Check Railway logs for the console.log output
2. Verify the flow matches "Expected Flow" above
3. Look for any errors or missing logs

## Common Issues & Solutions

### Issue 1: Messages Not Loading
**Symptom**: 0 messages loaded for valid session ID

**Possible Causes**:
- localStorage cleared
- Session ID mismatch
- Messages not being saved properly

**Debug**:
```javascript
// Check if messages exist
const sessionId = -1234567890; // Replace with actual ID
const messages = JSON.parse(localStorage.getItem('gatewayz_guest_messages'));
console.log('Messages for session:', messages[sessionId.toString()]);
```

### Issue 2: Query Not Refetching
**Symptom**: No useSessionMessages log appears

**Possible Causes**:
- React Query disabled (`enabled: false`)
- Stale cache returning without refetch
- sessionId not updating in Zustand store

**Debug**:
```javascript
// Check Zustand store
import { useChatUIStore } from '@/lib/store/chat-ui-store';
console.log('Active session ID:', useChatUIStore.getState().activeSessionId);
```

### Issue 3: Positive Session ID for Guest
**Symptom**: Guest user has positive session ID

**This should never happen**. Guest sessions always have negative IDs.

**Fix**: Check `useCreateSession` mutation in `use-chat-queries.ts:106-108`

## Next Steps After Debugging

Once you identify the issue from logs:

1. **If messages aren't loading**: Check `getGuestMessages()` in `guest-chat.ts`
2. **If query isn't triggering**: Check `enabled` flag and `staleTime` in `useSessionMessages`
3. **If session ID is wrong**: Check `handleSessionSelect` and Zustand state updates

## Removing Debug Logs

After fixing the issue, remove the console.log statements:

```bash
# In the files:
# - src/components/chat-v2/ChatSidebar.tsx:131
# - src/lib/hooks/use-chat-queries.ts:77, 83

# Commit the removal
git add .
git commit -m "chore: remove guest chat debugging logs"
git push
```

## Related Files

- `/root/repo/src/components/chat-v2/ChatSidebar.tsx` - Session selection UI
- `/root/repo/src/lib/hooks/use-chat-queries.ts` - Message loading logic
- `/root/repo/src/lib/guest-chat.ts` - Guest session/message storage
- `/root/repo/src/components/chat-v2/MessageList.tsx` - Message display
- `/root/repo/src/components/chat-v2/ChatLayout.tsx` - Main chat container

## Contact

If you need help interpreting the logs or debugging further, share:
1. The console logs from browser
2. The Railway deployment logs
3. localStorage contents (sessions and messages)
