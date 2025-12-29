# Referral Email Notification Implementation

## Overview

This document outlines the implementation for sending email notifications to referrers when a referred user signs up through their referral link.

## Backend Implementation Required

The backend API (`https://api.gatewayz.ai`) needs to be updated to send an email notification to the referrer when a new user signs up with their referral code.

### Flow

1. **New User Signs Up with Referral Link**
   - User visits: `/signup?ref=REFERRAL_CODE`
   - Signs up through Privy authentication
   - Frontend sends auth request to `/api/auth` proxy

2. **Backend Auth Request**
   - Frontend POSTs to `/api/auth` with:
   ```json
   {
     "user": {
       "id": "privy_user_id",
       "created_at": 1234567890,
       "email": "newuser@example.com",
       "display_name": "New User",
       ...
     },
     "token": "privy_token",
     "is_new_user": true,
     "has_referral_code": true,
     "referral_code": "ABC123DEF456",
     "privy_user_id": "did_...",
     "trial_credits": 10
   }
   ```

3. **Backend Processing** (TO BE IMPLEMENTED)
   - Validate referral code exists
   - Find referrer user by referral code
   - Get referrer's email and display name
   - Send email notification to referrer with:
     - New user's name/email
     - Bonus amount credited
     - Link to referral dashboard
   - Record referral transaction in database
   - Return auth response with calculated credits to frontend

### Email Template

The referrer should receive an email similar to:

```
Subject: New Referral Signup - You Earned Bonus Credits!

Dear [REFERRER_NAME],

Great news! A new user has signed up using your referral link.

New User: [NEW_USER_NAME] ([NEW_USER_EMAIL])
Bonus Credits Earned: +$[BONUS_AMOUNT]
Total Referral Earnings: $[TOTAL_EARNED]

Their referral is now active and will appear in your Referral Dashboard.

View your referrals and earnings: https://beta.gatewayz.ai/settings/referrals

Thank you for helping grow the Gatewayz community!

Best regards,
The Gatewayz Team
```

## Frontend Implementation (Already Completed)

### Files Modified/Created

1. **New Component**: `src/components/dialogs/referral-bonus-dialog.tsx`
   - Displays bonus amount to new user
   - Shows them how much they received from referral
   - Prompts to share their own referral link

2. **Updated**: `src/app/layout.tsx`
   - Added `<ReferralBonusDialog />` component
   - Renders globally at root level

### Frontend Flow

1. **Signup Page** (`src/app/signup/page.tsx`)
   - Captures `?ref=CODE` from URL
   - Stores in localStorage: `gatewayz_referral_code`

2. **Authentication** (`src/context/gatewayz-auth-context.tsx`)
   - Includes referral code in auth request body
   - On success, sets flag: `localStorage['gatewayz_show_referral_bonus'] = 'true'`
   - Flag only set for new users with referral codes

3. **Bonus Dialog** (`src/components/dialogs/referral-bonus-dialog.tsx`)
   - Checks for `gatewayz_show_referral_bonus` flag
   - Calculates bonus: `total_credits - 10` (base trial)
   - Displays prominent popup showing:
     - Bonus amount
     - Total credits breakdown
     - How to maximize benefits
     - CTAs: Explore Platform, Share & Earn, Add Payment

4. **Referral Dashboard** (`src/app/settings/referrals/page.tsx`)
   - Fetches referral stats from `/referral/stats` API
   - Displays referral transactions in a table
   - Shows: email, status, reward amount, date
   - New referral should appear here automatically after backend processes it

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Signs Up with Referral                  │
│                   /signup?ref=ABC123DEF456                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Frontend: Capture & Store Referral Code             │
│         localStorage['gatewayz_referral_code'] = 'ABC123'       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           User Authenticates via Privy (Email/Google/etc)       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Frontend: POST /api/auth (proxy)                    │
│         Includes: referral_code, is_new_user, trial_credits     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│          Backend: POST /auth (Core Authentication)              │
│                                                                 │
│  1. Create new user account                                    │
│  2. Validate referral code exists                              │
│  3. Find referrer by code                                      │
│  4. Calculate bonus (typically $10)                            │
│  5. Record referral transaction                                │
│  6. Send email to referrer ⭐ (REQUIRED)                        │
│     - New user details                                         │
│     - Bonus amount                                             │
│     - Link to dashboard                                        │
│  7. Return auth response with:                                 │
│     - api_key                                                  │
│     - is_new_user: true                                        │
│     - credits: 20 (10 trial + 10 bonus)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│          Frontend: Auth Success, Set Bonus Flag                 │
│    localStorage['gatewayz_show_referral_bonus'] = 'true'       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Frontend: Redirect to Chat/Onboarding                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│        Frontend: Show Referral Bonus Dialog (1.5s delay)        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │      🎉 Referral Bonus Unlocked!                        │  │
│  │  Thank you for joining through a referral link          │  │
│  │                                                         │  │
│  │  Your Referral Bonus                                    │  │
│  │  +$3 in bonus credits                                   │  │
│  │  Plus your $3 in trial credits = $6 total               │  │
│  │                                                         │  │
│  │  [Explore Platform] [Share & Earn] [Add Payment]       │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         Referrer Receives Email Notification ⭐                 │
│                                                                 │
│  Subject: New Referral Signup - You Earned Bonus Credits!      │
│                                                                 │
│  New User: Jane Doe (jane@example.com)                          │
│  Bonus Credits Earned: +$10                                     │
│  Total Referral Earnings: $30                                   │
│                                                                 │
│  [View your referrals and earnings]                             │
└──────────────────────────────────────────────────────────────────┘
```

## Verification Checklist

### For Backend Team

- [ ] When new user signs up with referral code, validate code exists
- [ ] Find referrer user associated with code
- [ ] Send email notification to referrer with:
  - [ ] New user's name
  - [ ] New user's email
  - [ ] Bonus amount credited
  - [ ] Total referral earnings to date
  - [ ] Link to referral dashboard
- [ ] Create referral transaction record with:
  - [ ] referee_id (new user)
  - [ ] referee_email (new user)
  - [ ] status: 'completed' (assuming immediate activation)
  - [ ] reward_amount ($10 or configured amount)
  - [ ] created_at: now
- [ ] Return auth response with correct credit calculation

### For Frontend Verification

1. **Sign Up with Referral Link**
   ```
   https://beta.gatewayz.ai/signup?ref=REFERRAL_CODE
   ```

2. **Verify Bonus Dialog Appears**
   - Should appear 1.5 seconds after successful signup
   - Should show correct bonus amount
   - Should show total credits (trial + bonus)

3. **Verify Referral Dashboard**
   - Navigate to `/settings/referrals`
   - Bonus transaction should appear in the referral list
   - Status should be 'completed'
   - Reward amount should match displayed bonus

4. **Verify Referrer's Email**
   - Referrer should receive email notification
   - Email should contain:
     - New user's name/email
     - Bonus amount
     - Dashboard link

## API Response Structure

### Auth Response (Backend Returns)

```json
{
  "success": true,
  "message": "Authentication successful",
  "user_id": 12345,
  "api_key": "gw_sk_1234567890abcdef",
  "auth_method": "privy",
  "privy_user_id": "did_12345678",
  "is_new_user": true,
  "display_name": "Jane Doe",
  "email": "jane@example.com",
  "credits": 20,
  "timestamp": "2024-11-17T12:34:56Z",
  "tier": "basic"
}
```

### Referral Stats Response

```json
{
  "referral_code": "ABC123DEF456",
  "total_referrals": 5,
  "completed_referrals": 4,
  "total_earned": 40,
  "referrals": [
    {
      "id": 1,
      "referee_email": "jane@example.com",
      "status": "completed",
      "reward_amount": 10,
      "created_at": "2024-11-17T12:34:56Z",
      "completed_at": "2024-11-17T12:34:56Z"
    },
    {
      "id": 2,
      "referee_email": "john@example.com",
      "status": "pending",
      "reward_amount": 0,
      "created_at": "2024-11-18T10:20:30Z"
    }
  ]
}
```

## Notes

- Email should be sent BEFORE returning auth response (or asynchronously with retry logic)
- Bonus amount is configurable (typically $10, can be different per campaign)
- Referral transactions should appear in dashboard within seconds of completion
- Email should include clear branding and call-to-action to share their own referral link
- Consider rate limiting on referral signups to prevent abuse
- Implement verification that new user actually activates (e.g., makes first purchase) before marking as "completed"

## Testing Email Locally

For local development, the backend can:
1. Use a mock email service (console logging, Mailtrap, etc.)
2. Log email details to database/file for verification
3. Use a development email address to send test emails

## Future Enhancements

- [ ] Configurable bonus amounts per campaign
- [ ] Email templates with dynamic content
- [ ] Referral tier bonuses (earn more as you refer more)
- [ ] Email history in referral dashboard
- [ ] Referrer notifications for pending referrals that convert to paid
- [ ] Gamification: referral badges/achievements
