# Statsig Integration Guide

## Overview

Gatewayz uses Statsig for feature flags, A/B testing, and analytics. This document explains how Statsig is integrated in the frontend and how to use it.

## Architecture

### Client-Side Integration

The frontend uses the Statsig React SDK (`@statsig/react-bindings`) with the following plugins:
- **StatsigAutoCapturePlugin**: Automatically tracks page views and user interactions
- **StatsigSessionReplayPlugin**: Records user sessions for debugging and analysis

### Server-Side Integration

Analytics events are sent to the backend via Next.js API routes, which then forward them to the Gatewayz backend. The backend uses the Statsig Python SDK to log events to Statsig servers.

**Flow:**
```
Frontend (logAnalyticsEvent)
  → Next.js API (/api/analytics/events)
    → Gatewayz Backend (/v1/analytics/events)
      → Statsig Python SDK
        → Statsig Servers
```

## Setup

### 1. Environment Variables

Add the Statsig client key to your `.env.local`:

```bash
NEXT_PUBLIC_STATSIG_CLIENT_KEY=client-your-statsig-client-key
```

Get your client key from the [Statsig Console](https://console.statsig.com/).

### 2. Provider Configuration

The `StatsigProviderWrapper` is already included in the root layout (`src/app/layout.tsx`):

```tsx
<PrivyProviderWrapper>
  <StatsigProviderWrapper>
    {/* App content */}
  </StatsigProviderWrapper>
</PrivyProviderWrapper>
```

The provider automatically:
- Initializes the Statsig SDK with the client key
- Identifies users with their Privy ID or backend user ID
- Loads feature flags and experiments
- Enables auto-capture and session replay

## Usage

### Logging Analytics Events

Use the `logAnalyticsEvent` function from `src/lib/analytics.ts`:

```typescript
import { logAnalyticsEvent } from '@/lib/analytics';

// Log a simple event
await logAnalyticsEvent('button_clicked');

// Log an event with metadata
await logAnalyticsEvent('purchase_completed', {
  product_id: 'SKU_12345',
  price: 99.99,
  currency: 'USD'
});

// Log an event with value and metadata
await logAnalyticsEvent('add_to_cart', { item_name: 'Pro Plan' }, 'subscription_pro');
```

### Batch Event Logging

For multiple events, use `logAnalyticsEventBatch`:

```typescript
import { logAnalyticsEventBatch } from '@/lib/analytics';

await logAnalyticsEventBatch([
  {
    event_name: 'page_view',
    metadata: { page: '/models' }
  },
  {
    event_name: 'model_selected',
    value: 'gpt-4',
    metadata: { category: 'language' }
  }
]);
```

### Using Feature Flags

Use the Statsig React hooks to check feature flags:

```typescript
import { useGate, useConfig, useExperiment } from '@statsig/react-bindings';

function MyComponent() {
  // Check if a feature gate is enabled
  const { value: isNewFeatureEnabled } = useGate('new_feature');

  // Get a dynamic config
  const { config } = useConfig('my_config');
  const buttonColor = config.get('button_color', 'blue');

  // Get an experiment variant
  const { config: experiment } = useExperiment('pricing_test');
  const pricePoint = experiment.get('price', 9.99);

  return (
    <div>
      {isNewFeatureEnabled && <NewFeature />}
      <button style={{ backgroundColor: buttonColor }}>
        Buy for ${pricePoint}
      </button>
    </div>
  );
}
```

## API Endpoints

### POST /api/analytics/events

Log a single analytics event.

**Request:**
```json
{
  "event_name": "add_to_cart",
  "value": "SKU_12345",
  "metadata": {
    "price": "9.99",
    "item_name": "diet_coke_48_pack"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

### POST /api/analytics/batch

Log multiple analytics events in a batch.

**Request:**
```json
{
  "events": [
    {
      "event_name": "page_view",
      "metadata": { "page": "/chat" }
    },
    {
      "event_name": "message_sent",
      "value": "gpt-4",
      "metadata": { "tokens": 150 }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "events_logged": 2
}
```

## Backend Integration

The Gatewayz backend uses the Statsig Python SDK to forward events to Statsig servers.

### Backend Setup (Python)

```python
from statsig_python_core import Statsig, StatsigUser, StatsigOptions

# Initialize
options = StatsigOptions()
options.environment = "production"  # or "development"

statsig = Statsig("secret-key", options)
statsig.initialize().wait()

# Log events
statsig.log_event(
    user=StatsigUser(user_id),
    event_name="add_to_cart",
    value="SKU_12345",
    metadata={
        "price": "9.99",
        "item_name": "diet_coke_48_pack"
    }
)
```

## Troubleshooting

### No events appearing in Statsig

1. **Check environment variable**: Ensure `NEXT_PUBLIC_STATSIG_CLIENT_KEY` is set
2. **Check API key**: Verify user is logged in and API key is available in localStorage
3. **Check backend**: Verify backend is properly forwarding events to Statsig
4. **Check console**: Look for `[Analytics]` warnings in browser console

### User not identified

The provider automatically identifies users when:
- User logs in with Privy (preferred)
- User data is available in localStorage

If neither is available, the user is tracked as "anonymous".

### Events not batching

The `logAnalyticsEvent` function sends events immediately. Use `logAnalyticsEventBatch` for better performance when logging multiple events.

## Best Practices

1. **Event naming**: Use snake_case for event names (e.g., `button_clicked`, not `buttonClicked`)
2. **Metadata**: Keep metadata flat and JSON-serializable
3. **Values**: Use the `value` parameter for primary event data (e.g., model name, product ID)
4. **Error handling**: Analytics functions fail silently to avoid breaking the app
5. **Performance**: Use batch logging for multiple events
6. **Privacy**: Don't include PII in event metadata

## Resources

- [Statsig Documentation](https://docs.statsig.com/)
- [Statsig React SDK](https://docs.statsig.com/client/javascript-sdk)
- [Statsig Python SDK](https://docs.statsig.com/server/python-sdk)
- [Statsig Console](https://console.statsig.com/)
