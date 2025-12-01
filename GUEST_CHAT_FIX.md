# Guest Chat "Failed to Create Session" Fix

## Problem

Unauthenticated users were getting a "Failed to create session" error when trying to use chat. The error occurred because:

1. Session creation API required authentication (API key)
2. Guest users don't have API keys
3. Chat streaming also required API keys
4. Message saving required authentication

## Root Cause

The application was designed with the assumption that all chat users would be authenticated. The guest chat feature was added later, but the underlying infrastructure (session creation, message streaming, message persistence) still required authentication.

## Solution

Implemented a **guest mode** that allows unauthenticated users to chat without backend persistence:

### 1. Client-Side Session Creation (use-chat-queries.ts)

**File**: `src/lib/hooks/use-chat-queries.ts`

**Changes**:
- Modified `useCreateSession()` to detect guest users
- For guests: Creates temporary client-side session with negative ID
- For authenticated users: Normal backend session creation

```typescript
// For guest users, create a temporary client-side session
if (!isAuthenticated) {
  const guestSessionId = -Date.now();
  return {
    id: guestSessionId,
    user_id: -1,
    title: title || 'Guest Chat',
    model: model || 'openai/gpt-3.5-turbo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    messages: []
  } as ChatSession;
}
```

### 2. Guest-Aware Streaming (use-chat-stream.ts)

**File**: `src/lib/hooks/use-chat-stream.ts`

**Changes**:
- Added guest mode detection
- Uses placeholder 'guest' API key for unauthenticated users
- Skips message persistence for guests (only stores in React Query cache)

```typescript
const { apiKey: storeApiKey, isAuthenticated } = useAuthStore.getState();
const apiKey = storeApiKey || getApiKey() || (isAuthenticated ? null : 'guest');

// Fire and forget save (only for authenticated users)
if (isAuthenticated) {
    saveMessage.mutate({ sessionId, role: 'user', content, model: model.value });
}
```

### 3. Guest API Key Support (chat completions endpoint)

**File**: `src/app/api/chat/completions/route.ts`

**Changes**:
- Detects guest requests (no API key or 'guest' placeholder)
- Uses special `GUEST_API_KEY` environment variable for backend requests
- Returns 403 error if guest key not configured

```typescript
const isGuestRequest = !apiKey || apiKey === 'guest';
if (isGuestRequest) {
  apiKey = process.env.GUEST_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Guest mode is not available. Please sign up to use chat.' },
      { status: 403 }
    );
  }
}
```

### 4. Environment Configuration

**File**: `.env.example`

**Added**:
```env
# Guest Mode API Key
# Used to allow unauthenticated users to send up to 10 chat messages
# This should be a special backend API key with limited rate limits
GUEST_API_KEY=your-guest-api-key
```

## How It Works

### Guest User Flow

```
1. User visits /chat (not logged in)
   ↓
2. Selects a model and types a message
   ↓
3. ChatInput checks guest limit (10 messages max)
   ↓
4. useCreateSession creates temporary client-side session (ID: -timestamp)
   ↓
5. useChatStream streams response using GUEST_API_KEY
   ↓
6. Messages stored in React Query cache (not backend)
   ↓
7. User can send up to 10 messages total
   ↓
8. After 10 messages, prompted to sign up
```

### Authenticated User Flow

```
1. User logs in via Privy
   ↓
2. Receives API key from backend
   ↓
3. useCreateSession creates backend session
   ↓
4. useChatStream uses user's API key
   ↓
5. Messages saved to backend database
   ↓
6. Session persists across devices/browser refreshes
```

## Technical Details

### Guest Session IDs

- Guest sessions use **negative timestamps** as IDs: `-Date.now()`
- This ensures no collision with real backend session IDs (positive integers)
- Allows distinguishing guest vs authenticated sessions

### Message Persistence

- **Guest**: Messages only stored in React Query cache (lost on page refresh)
- **Authenticated**: Messages saved to backend database via API

### Guest Limit Enforcement

- Client-side tracking via `localStorage['gatewayz_guest_message_count']`
- Incremented after each successful message
- Checked before allowing new messages
- Can be bypassed by clearing localStorage (acceptable for growth feature)

## Configuration Required

### Backend Setup

The backend must provide a `GUEST_API_KEY` that:
1. Has limited rate limits (e.g., 10 requests per hour per IP)
2. Only allows chat completion requests (no other endpoints)
3. Tracks usage for abuse prevention
4. Is distinct from regular user API keys

### Frontend Setup

Add to `.env.local`:
```env
GUEST_API_KEY=<get-from-backend-team>
```

Without this key, guest mode will return a 403 error.

## Testing Checklist

- [x] Guest user can access /chat page
- [ ] Guest user can select a model
- [ ] Guest user can send first message
- [ ] Messages stream properly for guests
- [ ] Guest counter increments after each message
- [ ] Warning appears at 3 messages remaining
- [ ] Blocking banner appears at 10 messages
- [ ] Guest cannot send 11th message
- [ ] Authenticated users bypass guest limits
- [ ] Guest sessions don't persist on refresh
- [ ] Auth user sessions persist on refresh

## Security Considerations

1. **Client-side limit**: Guest message limit is enforced client-side only
   - Can be bypassed by clearing localStorage
   - This is acceptable as a growth/UX feature, not security

2. **Backend rate limiting**: GUEST_API_KEY should have strict rate limits
   - Prevents abuse from malicious users
   - Protects backend from spam

3. **No data persistence**: Guest messages are ephemeral
   - Privacy benefit: no conversation history stored
   - Trade-off: Lost on page refresh

4. **IP-based tracking**: Backend should track guest API key usage by IP
   - Additional layer of abuse prevention
   - Recommended but not required

## Future Enhancements

1. **Convert guest → authenticated**: Save guest chat history after signup
2. **Server-side guest tracking**: IP-based message limits on backend
3. **Guest session persistence**: Store in IndexedDB for multi-tab support
4. **Better guest onboarding**: Show benefits of signing up earlier

## Files Modified

1. `src/lib/hooks/use-chat-queries.ts` - Guest session creation
2. `src/lib/hooks/use-chat-stream.ts` - Guest streaming + skip persistence
3. `src/app/api/chat/completions/route.ts` - Guest API key support
4. `.env.example` - Document GUEST_API_KEY

## Related Documentation

- `GUEST_CHAT_IMPLEMENTATION.md` - Original guest chat feature spec
- `src/lib/guest-chat.ts` - Guest limit tracking utilities
- `src/components/chat/guest-chat-counter.tsx` - UI component for guest counter
