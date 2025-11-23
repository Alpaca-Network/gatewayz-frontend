# Sentry Error Capture - Next Steps & Implementation Roadmap

## Phase 2: Component Error Tracking (Recommended)

### High Priority Components to Instrument

#### Chat Components (`src/components/chat/`)
These are critical for user experience. Failures directly impact chat functionality.

**1. ChatWindow.tsx**
```typescript
import { wrapComponentError } from '@/lib/sentry-utils';

export function ChatWindow({ sessionId, onError }) {
  const handleSendMessage = wrapComponentError(
    async (message) => {
      // Message sending logic
    },
    { componentName: 'ChatWindow', operation: 'handleSendMessage' }
  );

  const handleModelChange = wrapComponentError(
    (model) => {
      // Model change logic
    },
    { componentName: 'ChatWindow', operation: 'handleModelChange' }
  );

  // Use handlers in component
}
```

**2. MessageList.tsx**
```typescript
export function MessageList({ messages }) {
  const handleRegenerate = wrapComponentError(
    (messageId) => {
      // Regenerate logic
    },
    { componentName: 'MessageList', operation: 'handleRegenerate' }
  );

  const handleCopy = wrapComponentError(
    (content) => {
      // Copy logic
    },
    { componentName: 'MessageList', operation: 'handleCopy' }
  );
}
```

**3. ModelSelector.tsx**
```typescript
export function ModelSelector({ selectedModel, onSelect }) {
  const handleModelSelect = wrapComponentError(
    async (model) => {
      // Selection logic
    },
    { componentName: 'ModelSelector', operation: 'handleModelSelect' }
  );

  const handleSearch = wrapComponentError(
    (query) => {
      // Search logic
    },
    { componentName: 'ModelSelector', operation: 'handleSearch' }
  );
}
```

#### Models Components (`src/components/models/`)
These handle model discovery and browsing.

**1. ModelGrid.tsx**
```typescript
export function ModelGrid({ models, filters }) {
  const handleFilterChange = wrapComponentError(
    (filter, value) => {
      // Filter logic
    },
    { componentName: 'ModelGrid', operation: 'handleFilterChange' }
  );

  const handleModelClick = wrapComponentError(
    (model) => {
      // Click logic
    },
    { componentName: 'ModelGrid', operation: 'handleModelClick' }
  );
}
```

**2. ModelSearch.tsx**
```typescript
export function ModelSearch({ onSearchChange }) {
  const handleSearch = wrapComponentError(
    async (query) => {
      // Search logic
    },
    { componentName: 'ModelSearch', operation: 'handleSearch' }
  );

  const handleAutocomplete = wrapComponentError(
    (input) => {
      // Autocomplete logic
    },
    { componentName: 'ModelSearch', operation: 'handleAutocomplete' }
  );
}
```

**3. ModelFilter.tsx**
```typescript
export function ModelFilter({ onFilterChange }) {
  const handleContextChange = wrapComponentError(
    (context) => {
      // Context filter logic
    },
    { componentName: 'ModelFilter', operation: 'handleContextChange' }
  );

  const handlePriceChange = wrapComponentError(
    (min, max) => {
      // Price filter logic
    },
    { componentName: 'ModelFilter', operation: 'handlePriceChange' }
  );
}
```

#### Settings Components (`src/components/settings/`)
User account operations need error tracking.

**1. AccountSettings.tsx**
```typescript
export function AccountSettings() {
  const handleProfileUpdate = wrapComponentError(
    async (profileData) => {
      // Profile update logic
    },
    { componentName: 'AccountSettings', operation: 'handleProfileUpdate' }
  );

  const handlePasswordChange = wrapComponentError(
    async (oldPassword, newPassword) => {
      // Password change logic
    },
    { componentName: 'AccountSettings', operation: 'handlePasswordChange' }
  );
}
```

**2. CreditManagement.tsx**
```typescript
export function CreditManagement() {
  const handlePurchaseCredits = wrapComponentError(
    async (amount) => {
      // Purchase logic
    },
    { componentName: 'CreditManagement', operation: 'handlePurchaseCredits' }
  );

  const handleApplyPromoCode = wrapComponentError(
    async (code) => {
      // Promo code logic
    },
    { componentName: 'CreditManagement', operation: 'handleApplyPromoCode' }
  );
}
```

#### Authentication Components
**1. PrivyProvider.tsx**
```typescript
// Already has some error capture, enhance with:
const handleLoginSuccess = wrapComponentError(
  (user) => {
    // Post-login logic
  },
  { componentName: 'PrivyProvider', operation: 'handleLoginSuccess' }
);

const handleLogout = wrapComponentError(
  () => {
    // Logout logic
  },
  { componentName: 'PrivyProvider', operation: 'handleLogout' }
);
```

**2. SessionInitializer.tsx**
```typescript
export function SessionInitializer() {
  useEffect(() => {
    try {
      // Session transfer logic from main domain
      if (urlParams.token) {
        // Initialize session
      }
    } catch (error) {
      captureComponentError(error, {
        componentName: 'SessionInitializer',
        operation: 'session_transfer'
      });
    }
  }, []);
}
```

### Adding Error Boundaries

Create specialized error boundaries for feature sections:

```typescript
// src/components/error-boundaries/ChatErrorBoundary.tsx
import React from 'react';
import * as Sentry from '@sentry/nextjs';

export class ChatErrorBoundary extends React.Component {
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, {
      tags: {
        error_type: 'component_error',
        component_name: 'ChatErrorBoundary',
        boundary: 'chat_section',
      },
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state?.hasError) {
      return (
        <div className="error-container">
          <h2>Chat Error</h2>
          <p>There was an error loading the chat. Please try refreshing.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Repeat for:
- `ModelsErrorBoundary` - for model browser
- `RankingsErrorBoundary` - for analytics
- `SettingsErrorBoundary` - for settings pages

## Phase 3: Service Layer Instrumentation (Recommended)

### API Client (`src/lib/api.ts`)

```typescript
import { wrapServiceError } from '@/lib/sentry-utils';

export const api = {
  // Wrap all methods
  fetch: wrapServiceError(
    async (endpoint, options) => {
      // Fetch logic
    },
    { serviceName: 'API', operation: 'fetch' }
  ),

  post: wrapServiceError(
    async (endpoint, data, options) => {
      // POST logic
    },
    { serviceName: 'API', operation: 'post' }
  ),

  put: wrapServiceError(
    async (endpoint, data, options) => {
      // PUT logic
    },
    { serviceName: 'API', operation: 'put' }
  ),

  delete: wrapServiceError(
    async (endpoint, options) => {
      // DELETE logic
    },
    { serviceName: 'API', operation: 'delete' }
  ),
};
```

### Chat History Service (`src/lib/chat-history.ts`)

```typescript
export const ChatHistoryAPI = {
  getSessions: wrapServiceError(
    async (options) => {
      // Get sessions logic
    },
    { serviceName: 'ChatHistoryAPI', operation: 'getSessions' }
  ),

  createSession: wrapServiceError(
    async (title, model) => {
      // Create session logic
    },
    { serviceName: 'ChatHistoryAPI', operation: 'createSession' }
  ),

  getMessages: wrapServiceError(
    async (sessionId) => {
      // Get messages logic
    },
    { serviceName: 'ChatHistoryAPI', operation: 'getMessages' }
  ),

  addMessage: wrapServiceError(
    async (sessionId, message) => {
      // Add message logic
    },
    { serviceName: 'ChatHistoryAPI', operation: 'addMessage' }
  ),
};
```

### Models Service (`src/lib/models-service.ts`)

```typescript
export const ModelsService = {
  fetchModels: wrapServiceError(
    async (options) => {
      // Multi-gateway fetch with deduplication
    },
    { serviceName: 'ModelsService', operation: 'fetchModels' }
  ),

  searchModels: wrapServiceError(
    async (query, filters) => {
      // Search logic
    },
    { serviceName: 'ModelsService', operation: 'searchModels' }
  ),

  getModelDetails: wrapServiceError(
    async (modelId) => {
      // Details fetching
    },
    { serviceName: 'ModelsService', operation: 'getModelDetails' }
  ),
};
```

### Stripe Integration (`src/lib/stripe.ts`)

```typescript
export const StripeService = {
  createCheckoutSession: wrapServiceError(
    async (priceId, successUrl, cancelUrl) => {
      // Checkout session creation
    },
    { serviceName: 'StripeService', operation: 'createCheckoutSession' }
  ),

  getSubscriptionStatus: wrapServiceError(
    async (customerId) => {
      // Get subscription status
    },
    { serviceName: 'StripeService', operation: 'getSubscriptionStatus' }
  ),

  updateSubscription: wrapServiceError(
    async (subscriptionId, updates) => {
      // Update subscription
    },
    { serviceName: 'StripeService', operation: 'updateSubscription' }
  ),
};
```

### Analytics Service (`src/lib/analytics.ts`)

```typescript
export const AnalyticsService = {
  trackEvent: wrapServiceError(
    async (eventName, properties) => {
      // Event tracking
    },
    { serviceName: 'AnalyticsService', operation: 'trackEvent' }
  ),

  trackPageView: wrapServiceError(
    (path, properties) => {
      // Page view tracking
    },
    { serviceName: 'AnalyticsService', operation: 'trackPageView' }
  ),

  batchEvents: wrapServiceError(
    async (events) => {
      // Batch event sending
    },
    { serviceName: 'AnalyticsService', operation: 'batchEvents' }
  ),
};
```

## Phase 4: More API Routes (Recommended)

### User Management Routes
- `src/app/api/user/api-keys/route.ts` - API key CRUD
- `src/app/api/user/api-keys/[keyId]/route.ts` - Key deletion
- `src/app/api/user/activity/log/route.ts` - Activity logging

### Chat Routes
- `src/app/api/chat/completions/route.ts` - Chat completions
- `src/app/api/chat/sessions/[id]/route.ts` - Session detail/delete
- `src/app/api/chat/sessions/[id]/messages/route.ts` - Message operations

### Payment Routes
- `src/app/api/payments/route.ts` - Payment operations
- `src/app/api/stripe/webhook/route.ts` - Webhook handling
- `src/app/api/stripe/portal/route.ts` - Customer portal

### Model Routes
- `src/app/api/models/route.ts` - Already has some tracking, enhance it
- `src/app/api/chat/search/route.ts` - Model search
- `src/app/api/chat/stats/route.ts` - Chat statistics

## Example: Instrumenting a Complete Feature

Here's how to instrument the Chat feature end-to-end:

### 1. Component Level (ChatWindow.tsx)
```typescript
import { wrapComponentError, addUserActionBreadcrumb } from '@/lib/sentry-utils';

const handleSendMessage = wrapComponentError(
  async (message) => {
    addUserActionBreadcrumb('Message sent', {
      sessionId,
      messageLength: message.length,
    });
    // Send message logic
  },
  { componentName: 'ChatWindow', operation: 'handleSendMessage' }
);
```

### 2. Service Level (chat-history.ts)
```typescript
import { withAsyncErrorCapture } from '@/lib/sentry-utils';

export const addMessageToSession = async (sessionId, message) => {
  return await withAsyncErrorCapture(
    async () => {
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify(message),
      });
      return response.json();
    },
    {
      operationName: 'addMessageToSession',
      timeout: 30000,
      retries: 2,
    }
  );
};
```

### 3. API Route Level (chat/sessions/[id]/messages/route.ts)
```typescript
export async function POST(request, { params }) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'POST /api/chat/sessions/[id]/messages' },
    async (span) => {
      try {
        span.setAttribute('session_id', params.id);
        const body = await request.json();
        span.setAttribute('message_length', body.content?.length || 0);

        // Process message
        const result = await processMessage(body);

        span.setStatus('ok');
        span.setAttribute('tokens_used', result.tokens);
        return NextResponse.json(result);
      } catch (error) {
        span.setStatus('error');
        return handleApiError(error, 'Add Message API');
      }
    }
  );
}
```

## Recommended Implementation Order

1. **Week 1: Component Error Boundaries** (High impact, visible to users)
   - Add 5-6 error boundary components
   - Wrap major feature sections
   - Estimated: 8-10 hours

2. **Week 2: Chat & Models Components** (Critical components)
   - Instrument 6-8 chat components
   - Instrument 4-5 model components
   - Estimated: 12-15 hours

3. **Week 3: Service Layer** (Medium impact, important for debugging)
   - Wrap API client
   - Wrap chat history service
   - Wrap models service
   - Wrap Stripe service
   - Wrap analytics service
   - Estimated: 10-12 hours

4. **Week 4: More API Routes** (Comprehensive coverage)
   - Add span tracking to 8-10 more routes
   - Add comprehensive attributes
   - Estimated: 8-10 hours

## Estimated Total Effort

- **Phase 2 (Components):** 20-25 hours
- **Phase 3 (Services):** 10-12 hours
- **Phase 4 (API Routes):** 8-10 hours
- **Testing & Refinement:** 5-8 hours
- **Total:** ~45-55 hours (~1-2 weeks at moderate pace)

## Key Success Metrics

After full implementation, you should see:

1. **Error Detection**
   - Catch 95%+ of runtime errors
   - Every major user flow instrumented
   - All third-party integration errors captured

2. **Debugging Efficiency**
   - Full stack traces with breadcrumbs
   - User context for every error
   - Clear reproduction steps from breadcrumb trail

3. **Performance Insights**
   - Identify slow API routes
   - Track retry patterns
   - Monitor timeout frequency

## Resources & Examples

### In Repository
1. `src/lib/sentry-utils.ts` - Utility functions
2. `SENTRY_EXPANSION_GUIDE.md` - Full reference guide
3. `src/components/examples/sentry-example-component.tsx` - Component example
4. Updated hooks - Implementation examples

### Best Practices to Follow
1. Always include custom context
2. Sanitize sensitive data (passwords, keys, tokens)
3. Use appropriate wrapper for each layer
4. Test error capture with `/api/sentry-test`
5. Monitor Sentry dashboard for patterns

## Questions?

Refer to:
1. `SENTRY_EXPANSION_GUIDE.md` - Complete reference
2. `SENTRY_EXPANSION_SUMMARY.md` - What was done
3. Modified hook files - Real examples
4. Sentry documentation - SDK reference

---

**Next Phase:** Component Error Tracking
**Estimated Start:** Immediately after Phase 1 stabilizes
**Impact:** ~25% increase in error capture coverage (Phase 1 → Phase 4)
