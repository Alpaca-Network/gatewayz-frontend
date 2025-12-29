# Complete Referral Feature Implementation Guide

## Overview

This guide documents the complete referral bonus system for Gatewayz Beta, including:
- Frontend UI components for showing referral bonuses to new users
- Backend email notification requirements for referrers
- Email confirmation tracking and dashboard integration
- Complete testing checklist

## Frontend Components (✅ COMPLETED)

### 1. Referral Bonus Dialog
**File**: `src/components/dialogs/referral-bonus-dialog.tsx`

Displays to new users when they sign up with a referral link.

**Triggers:**
- Checks for `localStorage['gatewayz_show_referral_bonus'] === 'true'`
- Only shows after 1.5 second delay for optimal UX
- Automatically dismisses after user interacts

**Features:**
- Prominently displays bonus amount earned
- Shows breakdown: $3 trial + $X bonus = total
- Explains how to maximize benefits (add payment, share link)
- Provides CTAs:
  - Explore Platform (dismiss)
  - Share & Earn (go to /settings/referrals)
  - Add Payment (go to /settings/credits)

**Design:**
- Emerald/teal color scheme (distinct from other dialogs)
- Dark mode support
- Responsive for mobile/desktop

### 2. Referral Confirmation Dialog (Optional)
**File**: `src/components/dialogs/referral-confirmation-dialog.tsx`

Optional dialog for referrers showing their referral was successfully recorded.

**Features:**
- Confirms new user signup
- Notifies about email sent to referrer
- Encourages sharing their referral link
- Links to full referral dashboard

**Usage:**
Can be integrated into `/settings/referrals` page to show when new referral appears in list.

## Backend Requirements

### Email Notification System

**When:** After new user successfully authenticates with referral code

**What to send:**
1. Email to referrer with:
   - New user's name/email
   - Bonus amount credited
   - Total referral earnings to date
   - Link to referral dashboard (https://beta.gatewayz.ai/settings/referrals)
   - CTA to share their own referral link

2. Record referral transaction with:
   ```json
   {
     "referee_id": "new_user_id",
     "referee_email": "newuser@example.com",
     "status": "completed",
     "reward_amount": 10,
     "created_at": "2024-11-17T12:34:56Z"
   }
   ```

**Implementation Points:**

In the `/auth` endpoint when processing a new user with referral code:

```python
# Pseudocode - adapt to your backend language
if referral_code and is_new_user:
    # 1. Validate referral code
    referrer = find_user_by_referral_code(referral_code)

    # 2. Calculate bonus (typically $10)
    bonus_amount = 10

    # 3. Create referral transaction
    transaction = create_referral_transaction(
        referrer_id=referrer.id,
        referee_id=new_user.id,
        referee_email=new_user.email,
        status='completed',
        reward_amount=bonus_amount
    )

    # 4. Send email to referrer (async recommended)
    send_referrer_email(
        to=referrer.email,
        new_user_name=new_user.display_name,
        new_user_email=new_user.email,
        bonus_amount=bonus_amount,
        total_earned=calculate_total_referral_earnings(referrer.id)
    )

    # 5. Update referrer's total credits
    referrer.credits += bonus_amount

    # 6. Return auth response with new user's credits
    return {
        "success": true,
        "credits": new_user.initial_credits + bonus_amount,  # 10 + 10 = 20
        "is_new_user": true,
        ...
    }
```

### Email Template (Recommended)

```html
Subject: New Referral Signup - You Earned Bonus Credits!

Dear [REFERRER_NAME],

Congratulations! A new user has signed up using your referral link.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
New User Signup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name: [NEW_USER_NAME]
Email: [NEW_USER_EMAIL]
Joined: [DATE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Earnings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This Referral: +$[BONUS_AMOUNT]
Total Earned: $[TOTAL_EARNED]
Active Referrals: [REFERRAL_COUNT]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View your complete referral dashboard to track all your earnings:
[Button: View Referral Dashboard]

Or copy your link below to share with more people:
https://beta.gatewayz.ai/signup?ref=[REFERRER_CODE]

Thank you for helping grow the Gatewayz community!

Best regards,
The Gatewayz Team
```

## Data Flow

### Complete User Journey

```
┌─ User 1 (Referrer) ─────────────────────────────────────────────┐
│                                                                  │
│ 1. Sign up → Get referral code: ABC123                           │
│    localStorage['gatewayz_referral_code'] removed after auth     │
│                                                                  │
│ 2. Navigate to /settings/referrals                               │
│    API GET /referral/code → Returns: "ABC123"                   │
│    Shows referral link: /signup?ref=ABC123                       │
│                                                                  │
│ 3. Share link with friends                                       │
└────────────────────────────────────────────────────────────────────┘

┌─ User 2 (Referee) ─────────────────────────────────────────────┐
│                                                                  │
│ 1. Click referral link: /signup?ref=ABC123                       │
│    localStorage['gatewayz_referral_code'] = 'ABC123'             │
│                                                                  │
│ 2. Sign up through Privy (Email/Google/etc)                      │
│                                                                  │
│ 3. Frontend POST /api/auth with:                                 │
│    {                                                             │
│      "is_new_user": true,                                        │
│      "referral_code": "ABC123",                                  │
│      "has_referral_code": true,                                  │
│      "trial_credits": 10,                                        │
│      ...user data...                                             │
│    }                                                             │
│                                                                  │
│ 4. Backend processes:                                            │
│    - Validates ABC123 referral code                              │
│    - Finds referrer (User 1)                                     │
│    - Calculates bonus: $10                                       │
│    - Creates transaction: referee=User2, bonus=$3, status=ok     │
│    - Sends email to User 1 ⭐                                    │
│    - Returns: credits=6 (3 trial + 3 bonus)                      │
│                                                                  │
│ 5. Frontend:                                                     │
│    - Sets flag: localStorage['gatewayz_show_referral_bonus']     │
│    - Redirects to /chat or /onboarding                           │
│    - After 1.5s, shows ReferralBonusDialog                       │
│    - User sees: "You earned +$3 in bonus credits!"               │
└────────────────────────────────────────────────────────────────────┘

┌─ User 1 (Referrer) - Verification ──────────────────────────────┐
│                                                                  │
│ 1. Receives email notification:                                  │
│    Subject: New Referral Signup - You Earned Bonus Credits!     │
│    Content: User 2 signed up, +$10 earned, total=$10            │
│                                                                  │
│ 2. Clicks "View Referral Dashboard" link                         │
│                                                                  │
│ 3. Navigate to /settings/referrals                               │
│    API GET /referral/stats → Returns:                            │
│    {                                                             │
│      "referral_code": "ABC123",                                  │
│      "total_referrals": 1,                                       │
│      "completed_referrals": 1,                                   │
│      "total_earned": 10,                                         │
│      "referrals": [                                              │
│        {                                                         │
│          "id": 1,                                                │
│          "referee_email": "user2@example.com",                   │
│          "status": "completed",                                  │
│          "reward_amount": 10,                                    │
│          "created_at": "2024-11-17T12:34:56Z"                   │
│        }                                                         │
│      ]                                                           │
│    }                                                             │
│                                                                  │
│ 4. Dashboard shows:                                              │
│    - Total Referrals: 1                                          │
│    - Completed: 1                                                │
│    - Total Earned: $10                                           │
│    - Transaction list shows: user2@example.com | $10 | Completed │
└────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── components/dialogs/
│   ├── referral-bonus-dialog.tsx          ✅ NEW
│   ├── referral-confirmation-dialog.tsx   ✅ NEW (optional)
│   └── welcome-dialog.tsx                 (existing)
│
├── context/
│   └── gatewayz-auth-context.tsx          ✅ UPDATED (includes referral logic)
│
├── app/
│   ├── layout.tsx                         ✅ UPDATED (added dialog component)
│   ├── signup/page.tsx                    ✅ EXISTING (captures ref param)
│   ├── api/auth/route.ts                  ✅ EXISTING (proxy endpoint)
│   └── settings/referrals/page.tsx        ✅ EXISTING (dashboard)
│
└── lib/
    ├── api.ts                             ✅ EXISTING (API helpers)
    └── config.ts                          ✅ EXISTING (config)

REFERRAL_EMAIL_IMPLEMENTATION.md            ✅ NEW (backend guide)
REFERRAL_FEATURE_COMPLETE.md                ✅ NEW (this file)
```

## Testing Checklist

### Frontend Testing

- [ ] Sign up with referral link: `https://beta.gatewayz.ai/signup?ref=TEST_CODE`
- [ ] After signup, ReferralBonusDialog appears after ~1.5s
- [ ] Dialog shows correct bonus amount (should be > 10)
- [ ] Dialog shows total credits breakdown
- [ ] "Explore Platform" button dismisses dialog
- [ ] "Share & Earn" navigates to /settings/referrals
- [ ] "Add Payment" navigates to /settings/credits
- [ ] Bonus appears correctly in dashboard stats
- [ ] Dialog doesn't reappear after dismissal
- [ ] Test on mobile and desktop
- [ ] Test in both light and dark modes

### Backend Testing

- [ ] New user signup with referral code is recorded
- [ ] Referral transaction created in database
- [ ] Email notification sent to referrer with:
  - [ ] New user's name
  - [ ] New user's email
  - [ ] Bonus amount
  - [ ] Total earned
  - [ ] Dashboard link
- [ ] Referrer's credits updated
- [ ] Auth response includes correct credit calculation
- [ ] Referral appears in /referral/stats endpoint
- [ ] Transaction shows status as "completed"

### Integration Testing

1. **Setup**
   - Create test accounts for Referrer and Referee
   - Get Referrer's referral code from `/referral/code` endpoint

2. **Signup Flow**
   ```
   1. Referrer: Signup normally, note referral code
   2. Referee: Visit /signup?ref=[CODE]
   3. Referee: Complete signup
   ```

3. **Verification**
   ```
   Referee side:
   - Should see ReferralBonusDialog with bonus amount
   - Should see increased credits in dashboard

   Referrer side:
   - Should receive email notification
   - Should see new referral in /settings/referrals
   - Transaction should show "completed" status
   - Earned amount should increase
   ```

4. **Edge Cases**
   - Invalid referral code → should not show bonus
   - Existing user with referral code → should not show bonus
   - Multiple referrals → should accumulate earnings
   - Referrer viewing their own code → should work normally

## Monitoring & Logging

### Frontend Logging

The implementation includes console logging:
```javascript
console.log("[Auth] Captured referral code from URL:", urlRefCode);
console.log("[Auth] Final referral code:", referralCode);
console.log("Referral code cleared from localStorage after successful auth");
```

### Metrics to Track

- [ ] Signup rate via referral links
- [ ] Conversion rate (referral code → successful signup)
- [ ] Average referral bonus per user
- [ ] Email delivery rate
- [ ] Email open rate
- [ ] Referral link click-through rate
- [ ] Share rate (users who click "Share & Earn")

## Future Enhancements

1. **Tiered Bonuses**
   - Referrer earns more based on referee's spend
   - Example: +$10 for signup, +$5 for each $50 spent

2. **Leaderboard**
   - Show top referrers
   - Gamify the referral program

3. **Referral Campaigns**
   - Time-limited bonus campaigns
   - Seasonal bonuses
   - Milestone rewards

4. **Advanced Tracking**
   - Tracking pixel for external websites
   - Custom referral landing pages
   - A/B testing different bonus amounts

5. **Social Sharing**
   - Pre-written share templates for email/Twitter/LinkedIn
   - QR code for referral link
   - Social media integration

6. **Affiliate Program**
   - Partner affiliate links
   - Commission structure
   - Affiliate reporting dashboard

## Troubleshooting

### Issue: Referral bonus not showing
**Checklist:**
- [ ] User signed up with `?ref=CODE` parameter
- [ ] Referral code is valid (exists in backend)
- [ ] User is new user (not existing account)
- [ ] Backend processed referral and set flag correctly
- [ ] Check browser console for errors
- [ ] Check localStorage flags

### Issue: Email not sent to referrer
**Checklist:**
- [ ] Backend email service configured
- [ ] Referrer's email address is valid
- [ ] Backend referral transaction created
- [ ] Check email spam folder
- [ ] Check backend logs for email sending errors

### Issue: Referral not appearing in dashboard
**Checklist:**
- [ ] API `/referral/stats` endpoint returning data
- [ ] Referral transaction status is "completed"
- [ ] User has correct permissions to view
- [ ] Clear browser cache/localStorage
- [ ] Check network tab for API errors

## Support & Contact

For questions or issues:
- Frontend: Check browser console for error messages
- Backend: Check server logs for referral processing
- Deployment: Verify environment variables for email service
- API: Test endpoints with curl or Postman

## Deployment Checklist

- [ ] Frontend components committed and deployed
- [ ] Backend referral email service implemented
- [ ] Email templates configured
- [ ] Email service credentials set in environment
- [ ] Database migrations for referral transactions
- [ ] API endpoints tested
- [ ] Analytics tracking configured
- [ ] Error monitoring/alerting set up
- [ ] Load testing for referral spike
- [ ] Rollback plan in case of issues
- [ ] Monitoring dashboard set up
- [ ] Documentation updated
- [ ] Team notified of launch
