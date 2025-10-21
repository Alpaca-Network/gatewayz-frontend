# Subscription Tier System Implementation

## Overview

A comprehensive subscription tier system has been implemented to support three user tiers:
- **Basic**: Pay-per-use credits model (no recurring subscription)
- **Pro**: $15/month subscription
- **Max**: $75/month subscription (provides $150 in credits)

## Files Created

### 1. **src/lib/tier-utils.ts** - Core Tier Utilities
Contains all tier-related business logic and configuration:
- `TIER_CONFIG`: Configuration for each tier (pricing, allocation, subscription status)
- `getUserTier()`: Determines current user tier from auth data
- `hasActiveSubscription()`: Checks if user has active subscription
- `getSubscriptionRenewalDate()`: Gets next billing date
- `isSubscriptionExpiringsoon()`: Alerts if subscription expires within 7 days
- `canAccessModel()`: Determines if user can access tier-restricted models
- `formatTierInfo()`: Formats tier info for display
- `formatSubscriptionStatus()`: Human-readable subscription status

### 2. **src/hooks/use-tier.ts** - React Hook for Tier Access
Provides convenient access to tier and subscription information within React components:
```typescript
const {
  tier,                    // 'basic' | 'pro' | 'max'
  tierInfo,                // Formatted tier information
  hasSubscription,         // Boolean
  subscriptionStatus,      // 'active' | 'cancelled' | 'past_due' | 'inactive'
  renewalDate,             // Date object or null
  isExpiringSoon,          // Boolean
  canAccessModel,          // Function to check model access
  userData                 // Raw user data
} = useTier();
```

### 3. **src/components/tier/tier-info-card.tsx** - Subscription Information Card
Display component showing:
- Current tier badge (Basic/Pro/Max)
- Plan description and pricing
- Subscription status with icons
- Next billing date with expiration warnings
- Upgrade prompt for Basic tier users

### 4. **src/components/tier/model-tier-badge.tsx** - Model Access Indicator
Badge component that displays:
- Which tier can access a model
- Lock icon if user doesn't have access
- Visual distinction based on tier level

### 5. **src/components/tier/tier-access-guard.tsx** - Access Control Component
Component that gates features behind tier requirements:
- Shows content if user has access
- Displays upgrade prompt if user lacks access
- Customizable fallback content
- Link to billing/upgrade page

## Files Modified

### 1. **src/lib/api.ts**
Added type definitions for tier system:
- `UserTier` type: 'basic' | 'pro' | 'max'
- `SubscriptionStatus` type: 'active' | 'cancelled' | 'past_due' | 'inactive'
- Extended `AuthResponse` interface with tier fields
- Extended `UserData` interface with tier fields
- Updated `processAuthResponse()` to handle tier information

### 2. **src/lib/models-data.ts**
Enhanced Model interface:
- Added optional `requiredTier` field to restrict model access by tier
- Models without `requiredTier` are available to all users

### 3. **src/context/gatewayz-auth-context.tsx**
Updated API key upgrade function:
- Now preserves tier and subscription information during upgrade
- Includes tier data when upgrading temporary keys to permanent keys

### 4. **src/app/settings/credits/page.tsx**
Integration of tier system into credits page:
- Added `TierInfoCard` component display
- Added auth refresh trigger after successful payment
- Enables tier information updates after subscription purchases

## Data Flow

### Authentication Flow
1. User authenticates via Privy
2. Backend auth endpoint returns `AuthResponse` with tier information
3. `processAuthResponse()` saves tier/subscription data to localStorage
4. Auth context updates with new tier information
5. Components can now access tier via `useTier()` hook

### After Payment Flow
1. User completes Stripe payment for credits/subscription
2. Payment redirect back to `/settings/credits?session_id=...`
3. Page fetches fresh credits and transactions
4. **NEW**: `requestAuthRefresh()` dispatched to refresh auth state
5. Tier information updated in auth context and localStorage
6. UI components reflect new tier status

## Usage Examples

### Check User Tier
```typescript
import { useTier } from '@/hooks/use-tier';

export function MyComponent() {
  const { tier, tierInfo } = useTier();

  return <div>User is on {tierInfo.displayName} tier</div>;
}
```

### Gate Content Behind Tier
```typescript
import { TierAccessGuard } from '@/components/tier/tier-access-guard';

export function PremiumFeature() {
  return (
    <TierAccessGuard requiredTier="pro">
      <div>This is a Pro-only feature!</div>
    </TierAccessGuard>
  );
}
```

### Show Model Access Status
```typescript
import { ModelTierBadge } from '@/components/tier/model-tier-badge';

export function ModelCard({ model }) {
  return (
    <div>
      <h3>{model.name}</h3>
      <ModelTierBadge requiredTier={model.requiredTier} />
    </div>
  );
}
```

### Check Subscription Status
```typescript
const {
  hasSubscription,
  subscriptionStatus,
  renewalDate,
  isExpiringSoon
} = useTier();

if (isExpiringSoon) {
  // Show renewal warning
}
```

## Integration Points

### Backend Requirements
The backend API's `/auth` endpoint should return tier information:
```json
{
  "user_id": 123,
  "api_key": "gw_live_...",
  "credits": 500,
  "tier": "pro",
  "subscription_status": "active",
  "subscription_end_date": 1735689600,
  ...
}
```

### Stripe Integration
After successful payment, tier and subscription information should be updated:
- Credits incremented for pay-per-use purchases
- Tier set to 'pro' or 'max' for subscription purchases
- `subscription_status` set to 'active'
- `subscription_end_date` set to next renewal date (Unix timestamp)

## Key Design Decisions

1. **Client-side Tier Determination**: While tier is stored and returned by the backend, client-side utilities provide fallback logic based on subscription status
2. **Hierarchical Access**: Max tier > Pro tier > Basic tier. Higher tiers can always access lower tier features
3. **Optional Tier Requirements**: Models without `requiredTier` are accessible to all users
4. **Auth Refresh After Payment**: Payment success triggers auth refresh to ensure tier info is immediately updated without page reload
5. **TypeScript Safety**: Full type safety with proper interfaces for all tier-related data

## Testing Checklist

- [ ] Verify tier information displays correctly in settings/credits page
- [ ] Test tier-based model access restrictions
- [ ] Verify subscription status updates after payment
- [ ] Test TierAccessGuard component hides/shows content correctly
- [ ] Verify auth refresh triggered after successful payment
- [ ] Test tier information persists across page reloads
- [ ] Verify subscription expiration warnings appear
- [ ] Test model tier badge displays correctly
