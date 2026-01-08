# 🔴 Session Expiration - Troubleshooting Guide

## Problem: "Session Expired" Error Appearing for No Good Reason

---

## 🔍 Root Causes

### 1. **API Key Lost or Invalid** (Most Common)
- API key deleted from localStorage
- Browser cache cleared
- Private browsing mode
- Multiple browser tabs
- Browser tab refreshed

### 2. **Backend Session Timeout** (Server-Side)
- Backend invalidated the session
- User was inactive too long
- Server restarted, invalidated all sessions
- API key revoked or rotated

### 3. **Rate Limit Misidentified as Session Error** (Current Issue)
- 429 (Rate Limit) being confused with 403 (Unauthorized)
- Message says "Session Expired" but is actually a rate limit

### 4. **Privy Authentication Lost**
- Privy token expired
- User logged out from another tab
- Browser doesn't have permission to read wallet

---

## 🛠️ How to Fix

### **IMMEDIATE FIX** (Try First)

```javascript
// In browser console, run:
localStorage.removeItem('gatewayz_api_key');
localStorage.removeItem('gatewayz_user_data');
window.location.reload();
```

Then:
1. ✓ Wait for page to reload
2. ✓ Click "Login"
3. ✓ Authenticate again
4. ✓ Try sending message

---

## 🔎 Diagnostic Steps

### Step 1: Check if API Key Still Exists

```javascript
// In browser console:
const apiKey = localStorage.getItem('gatewayz_api_key');
console.log('API Key exists:', !!apiKey);
console.log('API Key preview:', apiKey ? apiKey.substring(0, 20) + '...' : 'NOT FOUND');
```

**Expected Output:**
```
API Key exists: true
API Key preview: gw_live_abc123def456...
```

**If "NOT FOUND":**
- → Session expired, need to re-login

### Step 2: Check if User Data Exists

```javascript
// In browser console:
const userData = localStorage.getItem('gatewayz_user_data');
console.log('User data:', userData ? 'EXISTS' : 'MISSING');
if (userData) {
  console.log('User:', JSON.parse(userData).display_name);
}
```

### Step 3: Check the Error Details

When you see "Session Expired":
1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for error message
4. Copy the exact error

**Common errors:**
- "API key required" → Re-login needed
- "Rate limit exceeded" → Wait 60 seconds, then retry
- "Invalid API key" → Session expired, re-login

### Step 4: Check Network Request

1. Open DevTools → **Network** tab
2. Send a message
3. Look at the request
4. Check **Response Status**:
   - `401` = Unauthorized (Session expired)
   - `403` = Forbidden (API key invalid)
   - `429` = Rate limited (Too many requests)
   - `500` = Server error

---

## 🚨 Root Cause Checklist

| Check | How to Test | If Found |
|-------|-------------|----------|
| **API Key Missing** | `localStorage.getItem('gatewayz_api_key')` | → Re-login |
| **API Key Invalid** | Network tab shows `401` | → Re-login |
| **Rate Limited** | Network tab shows `429` | → Wait 60s |
| **Server Error** | Network tab shows `500` | → Try again later |
| **Privy Token Expired** | Can't see Privy wallet picker | → Re-login |

---

## 📝 Code Issue Found

### **In `src/app/chat/page.tsx` (Lines 3017-3021):**

```typescript
// Handle API key validation errors (403)
if (errorMessage.includes('API key') || errorMessage.includes('403')) {
    toastTitle = "Session Expired";
    toastDescription = "Your session has expired. Please refresh the page and log in again.";
}
```

**Problem**: This catches ANY error containing "API key", including rate limit errors!

**Rate Limit Response Example:**
```json
{
  "error": "Rate Limit Exceeded",
  "message": "You've exceeded your API key rate limit"
}
```

This message contains "API key" so it's misidentified as a session expiration! 🐛

---

## 🔧 The Fix (To Be Applied)

### Option 1: Check Response Status Code (Better)
```typescript
// Check the actual HTTP status code, not just message content
if (status === 401 || status === 403) {
    toastTitle = "Session Expired";
    toastDescription = "Your session has expired. Please refresh the page and log in again.";
}
else if (status === 429) {
    toastTitle = "Rate Limit Reached";
    toastDescription = "Too many requests. Please wait a moment before trying again.";
}
```

### Option 2: More Specific Text Matching (Current Fix)
```typescript
// Look for specific session error patterns
const isSessionError = 
    errorMessage.includes('Unauthorized') || 
    errorMessage.includes('401') ||
    errorMessage.includes('Invalid API key') ||
    (errorMessage.includes('API key') && !errorMessage.includes('rate limit'));

if (isSessionError) {
    toastTitle = "Session Expired";
    // ...
}
```

---

## 🔍 How to Reproduce the Bug

This is what causes the false "Session Expired" error:

1. Send many messages rapidly (triggers rate limit)
2. Backend returns: `{ error: "Your API key rate limit exceeded" }`
3. Code sees "API key" in the message
4. Shows "Session Expired" instead of "Rate Limited"
5. User confused (thinks their session expired, but it's just rate limiting)

---

## 📊 Error Type Reference

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| "Session Expired" (Real) | 401, 403 | API key invalid/expired | Re-login |
| "Session Expired" (False) | 429 | Rate limited | Wait & retry |
| "Rate limit exceeded" | 429 | Too many requests | Wait 60 seconds |
| "Server Error" | 500 | Backend issue | Try again later |
| "Model not found" | 404 | Invalid model | Select different model |

---

## ✅ Verification Steps

After fixing the code:

1. **Test Normal Flow**
   - Create chat
   - Send message
   - Verify works

2. **Test Session Expiration**
   - Clear API key: `localStorage.removeItem('gatewayz_api_key')`
   - Try to send message
   - Should show: "Session Expired"
   - Re-login should fix it

3. **Test Rate Limiting**
   - Send 100 messages rapidly
   - Should show: "Rate Limit Reached" (NOT "Session Expired")
   - Wait 60 seconds
   - Should work again

---

## 📋 Workaround (Until Fixed)

If you keep seeing "Session Expired":

1. **Don't panic** - Your session probably isn't actually expired
2. **Check Network tab** - See if it's actually a rate limit (429)
3. **Wait 60 seconds** - If rate limited, this will fix it
4. **Re-login if needed** - Only do this if API key is actually gone

---

## 🧪 Test Cases to Add

Add these tests to verify the fix works:

```typescript
test('Should show "Session Expired" on 401 error', () => {
  // Mock 401 response
  // Verify toast shows "Session Expired"
});

test('Should show "Rate Limit" on 429 error with API key in message', () => {
  // Mock 429 response with "Your API key rate limit exceeded"
  // Verify toast shows "Rate Limit Reached" (NOT "Session Expired")
});

test('Should not show "Session Expired" on rate limit errors', () => {
  // Mock rate limit error
  // Verify it shows rate limit message, not session expired
});
```

---

## 🎯 Summary

**Current Issue**: Rate limit errors (429) are being mislabeled as session expiration (401/403)

**Root Cause**: Code checks for "API key" string in error message, doesn't check HTTP status code

**Impact**: Users see confusing "Session Expired" message when they're actually rate limited

**Solution**: Check HTTP status code instead of error message text

**Status**: 🔴 NEEDS FIX

---

## 📞 Need Help?

1. Check: Are you really getting "Session Expired"?
   - Look at Network tab → check status code
   - Is it 401/403 or 429?

2. If it's 429:
   - This is rate limiting, not session expiration
   - Wait 60 seconds and try again

3. If it's 401/403:
   - Your session really did expire
   - Re-login to fix it

4. If something else:
   - Copy the exact error message
   - Check Network tab status code
   - Report with both details

---

**Created**: January 17, 2025  
**Status**: Issue Identified & Documented  
**Priority**: Medium (Confusing UX but not critical)

