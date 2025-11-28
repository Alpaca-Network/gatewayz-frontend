# Guest Chat & Referral Implementation

## Overview

This implementation adds guest mode functionality to the chat interface, allowing users to send up to 10 messages before being prompted to sign up. It also implements persistent referral code tracking that survives across sessions until the user signs up.

## Features Implemented

### 1. Guest Chat with 10-Message Limit

#### Files Created:
- `src/lib/guest-chat.ts` - Guest mode utilities

#### Key Functions:
- `getGuestMessageCount()` - Get current message count
- `incrementGuestMessageCount()` - Increment count after each message
- `hasReachedGuestLimit()` - Check if limit reached
- `getRemainingGuestMessages()` - Get remaining messages
- `resetGuestMessageCount()` - Clear count after signup
- `getGuestMessageLimit()` - Get the limit constant (10)

#### User Experience:
1. **Anonymous Access**: Users can access `/chat` without logging in
2. **Message Tracking**: Each sent message increments the guest counter
3. **Warnings**:
   - When 3 or fewer messages remain: Toast notification
   - When limit reached: Alert banner with sign-up button
4. **Blocking**: Cannot send messages once limit is reached
5. **Reset**: Counter resets when user signs up

### 2. Referral Code Storage

#### Files Created:
- `src/lib/referral.ts` - Referral tracking utilities

#### Key Functions:
- `getReferralCodeFromURL()` - Extract from URL params (`?ref=CODE`)
- `getStoredReferralCode()` - Get from localStorage
- `storeReferralCode(code, source)` - Save to localStorage
- `clearReferralCode()` - Remove after signup
- `getReferralCode()` - Get from URL or localStorage (URL takes priority)
- `initializeReferralTracking()` - Call on page load

#### User Experience:
1. **URL Detection**: Automatically captures `?ref=CODE` or `?referral=CODE`
2. **Persistent Storage**: Saved in localStorage until signup
3. **Cross-Session**: Works even if user closes browser and returns later
4. **Priority**: URL code overrides stored code
5. **Cleanup**: Cleared after successful signup

### 3. Files Modified

#### `/src/app/chat/page.tsx`
- Removed login requirement
- Added referral tracking initialization
- Allows guest mode access

#### `/src/components/chat-v2/ChatLayout.tsx`
- Removed authentication check
- Allows rendering for guest users

#### `/src/components/chat-v2/ChatInput.tsx`
- Added guest limit checking before sending
- Increments guest counter after successful send
- Shows warning notifications
- Displays limit-reached alert banner
- Sign-up button integration

#### `/src/context/gatewayz-auth-context.tsx`
- Integrated referral utilities
- Uses `getReferralCode()` for consistent tracking
- Clears referral code after signup
- Resets guest message count after signup

## Technical Implementation

### Guest Mode Flow

```
1. User visits /chat (not logged in)
   ↓
2. Can send up to 10 messages
   ↓
3. Each message increments localStorage counter
   ↓
4. At 3 remaining: Toast warning
   ↓
5. At limit: Show banner + block sends
   ↓
6. User clicks "Sign up"
   ↓
7. After auth: Counter resets
```

### Referral Code Flow

```
1. User visits: /chat?ref=FRIEND123
   ↓
2. Code stored in localStorage
   ↓
3. User browses site, closes browser
   ↓
4. Returns days later to /chat
   ↓
5. Code still in localStorage
   ↓
6. User signs up
   ↓
7. Code sent to backend in auth request
   ↓
8. Code cleared from localStorage
```

### LocalStorage Keys

- `gatewayz_guest_message_count` - Guest message counter (integer)
- `gatewayz_referral_code` - Referral code string
- `gatewayz_referral_source` - Source of referral (e.g., "url", "manual")

## Testing Checklist

### Guest Chat Tests

- [ ] Can access `/chat` without login
- [ ] Can send first message as guest
- [ ] Counter increments after each message
- [ ] Warning toast appears at 3 remaining
- [ ] Warning toast appears at 2 remaining
- [ ] Warning toast appears at 1 remaining
- [ ] Alert banner shows when limit reached
- [ ] Cannot send 11th message
- [ ] Sign-up button in banner works
- [ ] Counter persists across page refreshes
- [ ] Counter resets after successful signup

### Referral Code Tests

- [ ] Code captured from `?ref=CODE` in URL
- [ ] Code captured from `?referral=CODE` in URL
- [ ] Code persists in localStorage
- [ ] Code survives browser close/reopen
- [ ] URL code overrides stored code
- [ ] Code sent in auth request on signup
- [ ] Code cleared after successful signup
- [ ] Works on any page with `?ref=CODE`
- [ ] Code stored even before visiting /chat

### Integration Tests

- [ ] Guest can use chat with referral link
- [ ] Guest sees warnings with referral code stored
- [ ] Signup with referral clears both guest count and code
- [ ] Multiple referral links work (last one wins)
- [ ] Guest limit works without referral code
- [ ] Referral works for authenticated users (shouldn't store)

## Edge Cases Handled

1. **No localStorage**: Functions handle `window === undefined`
2. **Invalid count**: Defaults to 0
3. **Concurrent tabs**: Each tab reads from localStorage
4. **Auth during chat**: Resets counter mid-session
5. **Multiple referral codes**: Last URL param wins
6. **Empty referral code**: Not stored
7. **Auth failure**: Keeps guest state intact

## Future Enhancements

1. Add server-side guest tracking (IP-based)
2. Show remaining count in UI header
3. Add "Sign up for unlimited chat" CTA in welcome screen
4. Track guest conversion rate (analytics)
5. Add referral bonus notification after signup
6. Allow guest to save chat history after signup

## API Integration

The referral code is already integrated into the auth request in `buildAuthRequestBody()`:

```typescript
{
  referral_code: referralCode ?? null,
  has_referral_code: !!referralCode,
  // ... other fields
}
```

Backend should:
1. Accept `referral_code` field in auth request
2. Associate with new user account
3. Award referral bonuses as configured
4. Track referral analytics

## Security Considerations

1. **Client-side only**: Guest limit is enforced client-side (can be bypassed)
2. **LocalStorage clearing**: User can clear and get 10 more messages
3. **Not a security feature**: This is UX/growth, not access control
4. **Server validation**: Backend should implement rate limiting
5. **Referral validation**: Backend should validate referral codes

## Deployment Notes

1. No environment variables needed
2. No database changes required (backend handles referral storage)
3. Works in all browsers with localStorage support
4. No breaking changes to existing auth flow
5. Backward compatible with existing users
