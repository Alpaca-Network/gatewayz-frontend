# Referral Invite Links - Frontend Implementation Guide

## Overview

Instead of manually copying and pasting referral codes, users can share invite links that automatically pre-fill the referral code during registration.

**Example**:
- ❌ Old way: "Use my code: ABC12345"
- ✅ New way: "Sign up here: https://gatewayz.ai/register?ref=ABC12345"

## How It Works

```
1. Alice gets her invite link from the API
   → API returns: https://gatewayz.ai/register?ref=ABC12345

2. Alice shares the link with Bob

3. Bob clicks the link
   → Opens: https://gatewayz.ai/register?ref=ABC12345

4. Frontend reads the 'ref' parameter from URL
   → Extracts: ABC12345

5. Registration form pre-fills with the code
   → User sees the code already filled in

6. Bob submits registration
   → POST /auth/register with referral_code: "ABC12345"

7. Bonus applies automatically when Bob makes first purchase
```

## Backend API Changes

### 1. Get Referral Code (Updated)

**Endpoint**: `GET /referral/code`

**New Response**:
```json
{
  "referral_code": "ABC12345",
  "invite_link": "https://gatewayz.ai/register?ref=ABC12345",
  "share_message": "Join Gatewayz and get $10 in credits! Sign up here: https://gatewayz.ai/register?ref=ABC12345"
}
```

### 2. Get Referral Stats (Updated)

**Endpoint**: `GET /referral/stats`

**New Response**:
```json
{
  "referral_code": "ABC12345",
  "invite_link": "https://gatewayz.ai/register?ref=ABC12345",
  "total_uses": 2,
  "remaining_uses": 8,
  "max_uses": 10,
  "total_earned": 20.0,
  "current_balance": 20.0,
  "referred_by_code": null,
  "referrals": [...]
}
```

## Frontend Implementation

### 1. Display Invite Link to Users

```typescript
// Fetch user's referral info
const getReferralInfo = async (apiKey: string) => {
  const response = await fetch('http://localhost:8000/referral/code', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  const data = await response.json();
  /*
  {
    "referral_code": "ABC12345",
    "invite_link": "https://gatewayz.ai/register?ref=ABC12345",
    "share_message": "Join Gatewayz and get $10 in credits! Sign up here: https://gatewayz.ai/register?ref=ABC12345"
  }
  */

  return data;
};

// Display in UI
const ReferralSection = ({ apiKey }) => {
  const [referralData, setReferralData] = useState(null);

  useEffect(() => {
    getReferralInfo(apiKey).then(setReferralData);
  }, [apiKey]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralData.invite_link);
    alert('Invite link copied!');
  };

  const share = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Gatewayz',
        text: referralData.share_message,
        url: referralData.invite_link
      });
    }
  };

  return (
    <div>
      <h3>Your Referral Link</h3>
      <input
        value={referralData?.invite_link}
        readOnly
        onClick={(e) => e.target.select()}
      />
      <button onClick={copyLink}>Copy Link</button>
      <button onClick={share}>Share</button>

      <p>Or share your code directly: {referralData?.referral_code}</p>
    </div>
  );
};
```

### 2. Handle URL Parameter on Registration Page

```typescript
// app/register/page.tsx (Next.js example)

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    // Get 'ref' parameter from URL
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCode(refParam);
      console.log('Referral code from URL:', refParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = {
      username: e.target.username.value,
      email: e.target.email.value,
      auth_method: 'email',
      referral_code: referralCode || undefined // Include if exists
    };

    const response = await fetch('http://localhost:8000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    // Handle response...
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="username" placeholder="Username" required />
      <input name="email" type="email" placeholder="Email" required />

      <input
        name="referral_code"
        value={referralCode}
        onChange={(e) => setReferralCode(e.target.value)}
        placeholder="Referral Code (optional)"
      />
      {referralCode && (
        <p>✅ You'll get $10 bonus on your first $10+ purchase!</p>
      )}

      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### 3. React Example (without Next.js)

```typescript
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const RegisterPage = () => {
  const location = useLocation();
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    // Parse query string
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
    }
  }, [location]);

  // Rest of component...
};
```

### 4. Vanilla JavaScript Example

```javascript
// Get referral code from URL
const urlParams = new URLSearchParams(window.location.search);
const referralCode = urlParams.get('ref');

if (referralCode) {
  // Pre-fill the form field
  document.getElementById('referral_code_input').value = referralCode;

  // Show success message
  document.getElementById('referral_message').textContent =
    '✅ You\'ll get $10 bonus on your first $10+ purchase!';
}

// Handle form submission
document.getElementById('register_form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = {
    username: document.getElementById('username').value,
    email: document.getElementById('email').value,
    auth_method: 'email',
    referral_code: document.getElementById('referral_code_input').value || undefined
  };

  const response = await fetch('http://localhost:8000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });

  // Handle response...
});
```

## UI/UX Recommendations

### Referral Dashboard

Show users their invite link prominently:

```
┌─────────────────────────────────────────────────┐
│ 🎁 Invite Friends & Earn                        │
├─────────────────────────────────────────────────┤
│ Share your link and get $10 for each friend    │
│ who makes a purchase!                           │
│                                                 │
│ Your Invite Link:                               │
│ ┌─────────────────────────────────────────┐     │
│ │ https://gatewayz.ai/register?ref=ABC123 │ 📋  │
│ └─────────────────────────────────────────┘     │
│ [Copy Link]  [Share]  [Send Email]              │
│                                                 │
│ Or share your code: ABC12345                    │
│                                                 │
│ Stats:                                          │
│ • 2 friends joined                              │
│ • $20 earned                                    │
│ • 8 invites remaining                           │
└─────────────────────────────────────────────────┘
```

### Registration Page

When user arrives via invite link:

```
┌─────────────────────────────────────────────────┐
│ 🎉 You've been invited to Gatewayz!            │
├─────────────────────────────────────────────────┤
│ Sign up and get $10 in credits!                │
│                                                 │
│ Username: [________________]                    │
│ Email:    [________________]                    │
│                                                 │
│ Referral Code: [ABC12345] ✅                    │
│ └─ You'll get $10 bonus on your first $10+     │
│    purchase!                                    │
│                                                 │
│ [Sign Up]                                       │
└─────────────────────────────────────────────────┘
```

## Social Sharing Integration

### Web Share API (Mobile)

```typescript
const shareInviteLink = async (inviteLink: string, message: string) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Join Gatewayz',
        text: message,
        url: inviteLink
      });
      console.log('Shared successfully');
    } catch (err) {
      console.log('Share cancelled or failed:', err);
    }
  } else {
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(inviteLink);
    alert('Link copied to clipboard!');
  }
};
```

### Share Buttons (Social Media)

```typescript
const ReferralShareButtons = ({ inviteLink, message }) => {
  const encodedLink = encodeURIComponent(inviteLink);
  const encodedMessage = encodeURIComponent(message);

  return (
    <div className="share-buttons">
      {/* Twitter */}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedLink}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on Twitter
      </a>

      {/* Facebook */}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on Facebook
      </a>

      {/* LinkedIn */}
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on LinkedIn
      </a>

      {/* Email */}
      <a
        href={`mailto:?subject=Join Gatewayz&body=${encodedMessage}`}
      >
        Share via Email
      </a>

      {/* WhatsApp */}
      <a
        href={`https://wa.me/?text=${encodedMessage}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on WhatsApp
      </a>

      {/* Copy Link */}
      <button
        onClick={() => {
          navigator.clipboard.writeText(inviteLink);
          alert('Link copied!');
        }}
      >
        Copy Link
      </button>
    </div>
  );
};
```

## Testing the Flow

### Test Script

```bash
#!/bin/bash

# 1. Get Alice's invite link
ALICE_API_KEY="gw_live_..."

ALICE_DATA=$(curl -s -X GET http://localhost:8000/referral/code \
  -H "Authorization: Bearer $ALICE_API_KEY")

echo "Alice's data:"
echo "$ALICE_DATA" | jq .

# Extract invite link
INVITE_LINK=$(echo "$ALICE_DATA" | jq -r '.invite_link')
echo ""
echo "Invite link: $INVITE_LINK"

# 2. Extract referral code from link
REFERRAL_CODE=$(echo "$INVITE_LINK" | grep -oP 'ref=\K[A-Z0-9]+')
echo "Referral code: $REFERRAL_CODE"

# 3. Register Bob using the code from the link
echo ""
echo "Registering Bob with referral code..."

BOB_DATA=$(curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"bob_invite_test\",
    \"email\": \"bob_invite@test.com\",
    \"auth_method\": \"email\",
    \"referral_code\": \"$REFERRAL_CODE\"
  }")

echo "Bob's data:"
echo "$BOB_DATA" | jq .

BOB_API_KEY=$(echo "$BOB_DATA" | jq -r '.api_key')
echo ""
echo "Bob API Key: $BOB_API_KEY"

# 4. Bob makes payment
echo ""
echo "Creating checkout for Bob..."

CHECKOUT=$(curl -s -X POST http://localhost:8000/api/stripe/checkout-session \
  -H "Authorization: Bearer $BOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd"}')

echo "Checkout URL:"
echo "$CHECKOUT" | jq -r '.url'

echo ""
echo "Complete the payment, then check Alice's stats:"
echo "curl -X GET http://localhost:8000/referral/stats -H \"Authorization: Bearer $ALICE_API_KEY\" | jq ."
```

## Environment Configuration

Make sure to set the `FRONTEND_URL` in your `.env` file:

```bash
# .env

# Development
FRONTEND_URL=http://localhost:3000

# Production
FRONTEND_URL=https://gatewayz.ai
```

The backend will use this to generate invite links with the correct domain.

## Analytics Tracking (Optional)

Track referral link clicks:

```typescript
// When user arrives via invite link
useEffect(() => {
  const refParam = searchParams.get('ref');
  if (refParam) {
    // Track the referral click
    analytics.track('Referral Link Clicked', {
      referral_code: refParam,
      source: document.referrer
    });
  }
}, [searchParams]);
```

## FAQ

### Q: What if user manually enters a code instead of using the link?
**A**: That's fine! Both methods work. The link just makes it easier by pre-filling the code.

### Q: Can users still share the code directly?
**A**: Yes! The API still returns the `referral_code` field, so users can copy/paste it if they prefer.

### Q: What happens if someone opens the link but doesn't register?
**A**: Nothing. The bonus only applies when they register AND make a $10+ purchase.

### Q: Can the URL parameter be something other than `ref`?
**A**: Yes, but you'll need to update the backend. Currently it generates `/register?ref=CODE`. You can customize this in `src/routes/referral.py`.

### Q: Should we validate the code when the page loads?
**A**: Optional. You can call `POST /referral/validate` to check if the code is valid before submission, but it's not required.

### Q: What if the frontend URL changes?
**A**: Update the `FRONTEND_URL` environment variable and redeploy. All new invite links will use the new domain.

## Migration from Old System

If you already have users sharing codes:

1. ✅ Old method still works (manual code entry)
2. ✅ Add invite link feature to UI
3. ✅ Gradually promote the new link-based sharing
4. ✅ Both methods work simultaneously

No breaking changes needed!

## Example API Responses

### GET /referral/code

```bash
curl -X GET http://localhost:8000/referral/code \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response**:
```json
{
  "referral_code": "ABC12345",
  "invite_link": "https://gatewayz.ai/register?ref=ABC12345",
  "share_message": "Join Gatewayz and get $10 in credits! Sign up here: https://gatewayz.ai/register?ref=ABC12345"
}
```

### GET /referral/stats

```bash
curl -X GET http://localhost:8000/referral/stats \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response**:
```json
{
  "referral_code": "ABC12345",
  "invite_link": "https://gatewayz.ai/register?ref=ABC12345",
  "total_uses": 2,
  "remaining_uses": 8,
  "max_uses": 10,
  "total_earned": 20.0,
  "current_balance": 30.0,
  "referred_by_code": null,
  "referrals": [
    {
      "user_id": 5,
      "username": "bob",
      "used_at": "2025-10-12T00:00:00Z",
      "bonus_earned": 10.0
    },
    {
      "user_id": 6,
      "username": "charlie",
      "used_at": "2025-10-12T00:10:00Z",
      "bonus_earned": 10.0
    }
  ]
}
```
