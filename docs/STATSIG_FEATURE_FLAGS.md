# Statsig Feature Flags Setup Guide

This guide explains how to use Statsig feature flags in the Gatewayz project using the Flags SDK.

## Overview

The project is configured with:
- `flags` SDK for feature flag management
- `@flags-sdk/statsig` adapter for Statsig integration
- Configuration in `/root/repo/flags.ts`

## Prerequisites

1. **Packages installed** (already done):
   ```bash
   npm install flags @flags-sdk/statsig
   ```

2. **Vercel project linked** (if using Vercel):
   ```bash
   vercel link
   ```

3. **Environment variables** (if using Vercel):
   ```bash
   vercel env pull
   ```

   Required environment variables:
   - `EDGE_CONFIG` - Automatically set by Vercel when Statsig integration is enabled
   - `STATSIG_SERVER_API_KEY` - Your Statsig server SDK key

## Configuration

The main configuration is in `flags.ts`:

```typescript
import { statsigAdapter, type StatsigUser } from "@flags-sdk/statsig";
import { flag, dedupe } from "flags/next";
import type { Identify } from "flags";

export const identify = dedupe((async () => ({
  userID: "1234", // Customize with actual user identification
  // Add custom attributes as needed
})) satisfies Identify<StatsigUser>);

export const createFeatureFlag = (key: string) => flag<boolean, StatsigUser>({
  key,
  adapter: statsigAdapter.featureGate((gate) => gate.value, {
    exposureLogging: true
  }),
  identify,
});
```

## Creating Feature Flags in Statsig

1. Open your Statsig dashboard (or click "Open in Statsig" from Vercel dashboard)
2. Navigate to **Feature Gates**
3. Click **Create New Gate**
4. Name your gate (e.g., `new_dashboard_ui`, `enable_beta_features`)
5. Configure targeting rules (optional)
6. Save the gate

## Usage Examples

### Example 1: Basic Feature Flag in Next.js Page

```typescript
// app/page.tsx
import { createFeatureFlag } from "../flags";

export default async function Page() {
  const showNewUI = await createFeatureFlag("new_dashboard_ui")();

  return (
    <div>
      {showNewUI ? (
        <NewDashboard />
      ) : (
        <LegacyDashboard />
      )}
    </div>
  );
}
```

### Example 2: API Route with Feature Flag

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createFeatureFlag } from '../../../flags';

export async function GET(req: NextRequest) {
  const useNewAlgorithm = await createFeatureFlag("use_new_algorithm")();

  if (useNewAlgorithm) {
    // Use new algorithm
    const result = await processWithNewAlgorithm();
    return NextResponse.json(result);
  } else {
    // Use legacy algorithm
    const result = await processWithLegacyAlgorithm();
    return NextResponse.json(result);
  }
}
```

### Example 3: Multiple Feature Flags

```typescript
// app/features/page.tsx
import { createFeatureFlag } from "../../flags";

export default async function FeaturesPage() {
  const [showBetaFeatures, enableAnalytics, useNewPricing] = await Promise.all([
    createFeatureFlag("beta_features")(),
    createFeatureFlag("enable_analytics")(),
    createFeatureFlag("new_pricing_model")(),
  ]);

  return (
    <div>
      {showBetaFeatures && <BetaFeaturesBanner />}
      {enableAnalytics && <AnalyticsTracker />}
      <PricingTable useNewModel={useNewPricing} />
    </div>
  );
}
```

### Example 4: Server Component with User Context

```typescript
// app/dashboard/page.tsx
import { createFeatureFlag } from "../../flags";

export default async function DashboardPage() {
  // The identify function in flags.ts should be customized to get real user data
  // For example, from authentication context, headers, or session

  const showPremiumFeatures = await createFeatureFlag("premium_features")();

  return (
    <div>
      <h1>Dashboard</h1>
      {showPremiumFeatures && <PremiumAnalytics />}
    </div>
  );
}
```

## Customizing User Identification

To properly target feature flags, customize the `identify` function in `flags.ts`:

```typescript
export const identify = dedupe((async () => {
  // Example: Get user from authentication context
  const session = await getSession();

  return {
    userID: session.user.id,
    email: session.user.email,
    custom: {
      plan: session.user.subscriptionPlan,
      organization: session.user.organizationId,
      region: session.user.region,
      createdAt: session.user.createdAt,
    }
  };
}) satisfies Identify<StatsigUser>);
```

## Targeting Rules in Statsig

You can create sophisticated targeting rules in Statsig based on user attributes:

- **User ID**: Target specific users
- **Email**: Target by email domain or specific addresses
- **Custom attributes**: Target by plan, organization, region, etc.
- **Percentage rollout**: Gradually roll out to X% of users
- **Environment**: Different flags for production, staging, development

## Best Practices

1. **Default to disabled**: New gates should default to disabled (off) to prevent accidental rollouts

2. **Use descriptive names**: Name gates clearly (e.g., `enable_new_checkout_flow` not `feature_123`)

3. **Keep flags temporary**: Remove flags after full rollout or deprecation of old code

4. **Test both states**: Always test your application with flags both enabled and disabled

5. **Use exposure logging**: Keep `exposureLogging: true` to track which users see which flags

6. **Document flags**: Keep a list of active flags and their purpose

7. **Clean up old flags**: Regularly review and remove flags that are no longer needed

## Monitoring and Analytics

Statsig provides analytics on:
- Flag exposure counts
- User segments affected
- Impact on key metrics (when configured)

Access these in the Statsig dashboard under **Metrics** and **Pulse**.

## Integration with Python Backend

If you need to use feature flags in the Python FastAPI backend, consider:

1. Using the Statsig Python SDK (`statsig` package)
2. Creating a similar wrapper in Python
3. Passing flag states from Next.js middleware to backend via headers
4. Using Statsig's HTTP API directly

Example Python integration:
```python
# pip install statsig
from statsig import statsig

statsig.initialize("server-secret-key")

def get_feature_flag(user_id: str, flag_name: str) -> bool:
    user = {"userID": user_id}
    return statsig.check_gate(user, flag_name)
```

## Troubleshooting

### Flags not working?

1. **Check environment variables**: Ensure `EDGE_CONFIG` is set
2. **Verify gate name**: Gate name in code must exactly match Statsig dashboard
3. **Check user identification**: Ensure `identify()` function returns valid user data
4. **Review Statsig targeting rules**: Make sure rules allow the test user
5. **Check Statsig status**: Visit status.statsig.com

### Local development

For local development, you can:
- Use Statsig's local overrides feature
- Set environment variables from `.env.local`
- Test with different user IDs in the `identify` function

## Additional Resources

- [Flags SDK Documentation](https://flags.vercel.dev/)
- [Statsig Documentation](https://docs.statsig.com/)
- [Statsig Adapter Documentation](https://flags.vercel.dev/adapters/statsig)
- [Feature Gate Best Practices](https://docs.statsig.com/guides/best-practices)

## Support

For issues with:
- **Flags SDK**: Check [Vercel Flags GitHub](https://github.com/vercel/flags)
- **Statsig integration**: Contact Statsig support or check their documentation
- **Project-specific issues**: Create an issue in the project repository
