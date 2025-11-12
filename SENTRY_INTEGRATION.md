# Sentry Integration Guide

This guide explains how Sentry is integrated into the Gatewayz Beta application for error tracking, performance monitoring, and structured logging.

## Table of Contents

1. [Configuration](#configuration)
2. [Exception Catching](#exception-catching)
3. [Performance Tracing](#performance-tracing)
4. [Structured Logging](#structured-logging)
5. [Best Practices](#best-practices)

## Configuration

### Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Sentry Error Tracking & Performance Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

### Configuration Files

Sentry is configured in three main files:

1. **`sentry.client.config.ts`** - Client-side configuration with Session Replay and console logging
2. **`sentry.server.config.ts`** - Server-side configuration with console logging (loaded via `instrumentation.ts`)
3. **`sentry.edge.config.ts`** - Edge runtime configuration (loaded via `instrumentation.ts`)

All configurations enable:
- Structured logging via `enableLogs: true`
- Automatic console logging integration
- Performance tracing

### Next.js Integration

The `next.config.ts` file wraps the Next.js config with `withSentryConfig()` to enable:
- Source map uploads
- Automatic instrumentation
- Tunnel route for ad-blocker circumvention (`/monitoring`)
- Vercel Cron Monitors

## Exception Catching

### Centralized Error Handler

All API routes use the centralized error handler in `src/app/api/middleware/error-handler.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

export function handleApiError(error: unknown, context: string = 'API'): NextResponse {
  console.error(`[${context}] Error:`, error);

  // Capture exception in Sentry with context
  Sentry.captureException(error, {
    tags: {
      context,
      error_type: 'api_error',
    },
    level: 'error',
  });

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  return NextResponse.json(
    {
      error: errorMessage,
      details: String(error)
    },
    { status: 500 }
  );
}
```

### Usage in API Routes

```typescript
export async function POST(request: NextRequest) {
  try {
    // Your API logic here
    const result = await doSomething();
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "API /api/your-route");
  }
}
```

### Manual Exception Catching

For specific error handling with additional context:

```typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      operation: 'user_registration',
      user_id: userId,
    },
    extra: {
      requestData: sanitizedData,
    },
    level: 'error',
  });
  throw error;
}
```

## Performance Tracing

### API Route Instrumentation

Example from `src/app/api/models/route.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'GET /api/models',
    },
    async (span) => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const gateway = searchParams.get('gateway');
        const limit = searchParams.get('limit');

        // Add request parameters as span attributes
        span.setAttribute('gateway', gateway || 'none');
        if (limit) {
          span.setAttribute('limit', parseInt(limit));
        }

        const data = await getModelsForGateway(gateway, limit ? parseInt(limit) : undefined);

        // Add success metrics to span
        span.setAttribute('models_count', Array.isArray(data) ? data.length : 0);
        span.setAttribute('status', 'success');

        return NextResponse.json(data);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            api_route: '/api/models',
            error_type: 'model_fetch_error',
          },
        });

        span.setAttribute('error', true);
        span.setAttribute('error_message', error instanceof Error ? error.message : 'Unknown error');

        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to fetch models' },
          { status: 500 }
        );
      }
    }
  );
}
```

### UI Component Instrumentation

Example for tracking button clicks:

```typescript
'use client';

import * as Sentry from '@sentry/nextjs';

function SubmitButton() {
  const handleClick = () => {
    Sentry.startSpan(
      {
        op: 'ui.click',
        name: 'Submit Button Click',
      },
      (span) => {
        const formData = getFormData();
        const userId = getCurrentUserId();

        // Add metrics to the span
        span.setAttribute('form_fields_count', formData.length);
        span.setAttribute('user_id', userId);

        try {
          submitForm(formData);
          span.setAttribute('status', 'success');
        } catch (error) {
          span.setAttribute('error', true);
          Sentry.captureException(error);
        }
      }
    );
  };

  return <button onClick={handleClick}>Submit</button>;
}
```

### Async Operations

Example for tracking API calls from the client:

```typescript
async function fetchUserData(userId: string) {
  return Sentry.startSpan(
    {
      op: 'http.client',
      name: `GET /api/users/${userId}`,
    },
    async (span) => {
      span.setAttribute('user_id', userId);

      try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();

        span.setAttribute('status_code', response.status);
        span.setAttribute('data_size', JSON.stringify(data).length);

        return data;
      } catch (error) {
        span.setAttribute('error', true);
        Sentry.captureException(error);
        throw error;
      }
    }
  );
}
```

## Structured Logging

### Logger Setup

Sentry logger is initialized automatically through the configuration files. Import and use it in your code:

```typescript
import * as Sentry from '@sentry/nextjs';
const { logger } = Sentry;
```

### Logger Levels

Sentry provides different log levels with automatic severity mapping:

```typescript
// Trace - Lowest level, verbose debugging
logger.trace('Starting database connection', { database: 'users' });

// Debug - Detailed debugging information
logger.debug(logger.fmt`Cache miss for user: ${userId}`);

// Info - General informational messages
logger.info('Updated profile', { profileId: 345 });

// Warn - Warning messages (potential issues)
logger.warn('Rate limit reached for endpoint', {
  endpoint: '/api/results/',
  isEnterprise: false,
});

// Error - Error messages
logger.error('Failed to process payment', {
  orderId: 'order_123',
  amount: 99.99,
});

// Fatal - Critical errors that might cause system failure
logger.fatal('Database connection pool exhausted', {
  database: 'users',
  activeConnections: 100,
});
```

### Template Literals with `logger.fmt`

Use `logger.fmt` to safely include variables in structured logs:

```typescript
const userId = '12345';
const action = 'login';

// ✅ Correct - Variables are properly extracted
logger.info(logger.fmt`User ${userId} performed ${action}`);

// ❌ Incorrect - Variables are embedded in string
logger.info(`User ${userId} performed ${action}`);
```

### Structured Context

Add structured context to logs for better searchability:

```typescript
logger.info('Payment processed', {
  // Transaction details
  transaction_id: 'txn_123',
  amount: 99.99,
  currency: 'USD',

  // User context
  user_id: userData.user_id,
  tier: userData.tier,

  // Request context
  endpoint: '/api/payments',
  method: 'POST',

  // Performance metrics
  duration_ms: Date.now() - startTime,
});
```

### API Route Logging Example

```typescript
import * as Sentry from '@sentry/nextjs';
const { logger } = Sentry;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'POST /api/checkout',
    },
    async (span) => {
      try {
        const body = await request.json();

        logger.info('Checkout initiated', {
          tier: body.tier,
          user_id: body.user_id,
        });

        const result = await processCheckout(body);

        logger.info('Checkout completed', {
          tier: body.tier,
          user_id: body.user_id,
          duration_ms: Date.now() - startTime,
          success: true,
        });

        return NextResponse.json(result);
      } catch (error) {
        logger.error('Checkout failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration_ms: Date.now() - startTime,
        });

        Sentry.captureException(error, {
          tags: { api_route: '/api/checkout' },
        });

        return handleApiError(error, 'Checkout API');
      }
    }
  );
}
```

## Best Practices

### 1. Always Use Context

Add context to errors and spans for easier debugging:

```typescript
Sentry.captureException(error, {
  tags: {
    component: 'ChatInterface',
    operation: 'send_message',
    model: selectedModel,
  },
  extra: {
    messageLength: message.length,
    hasImage: !!image,
  },
});
```

### 2. Use Appropriate Log Levels

- **trace/debug**: Development and troubleshooting
- **info**: Normal application flow
- **warn**: Potential issues, degraded functionality
- **error**: Errors that are handled but should be investigated
- **fatal**: Critical errors requiring immediate attention

### 3. Structured Data Over String Interpolation

```typescript
// ✅ Good - Structured and searchable
logger.info('User login', {
  user_id: userId,
  method: authMethod,
  duration_ms: loginDuration,
});

// ❌ Bad - Unstructured string
logger.info(`User ${userId} logged in via ${authMethod} in ${loginDuration}ms`);
```

### 4. Add Performance Metrics

Track timing and resource usage:

```typescript
const startTime = Date.now();

Sentry.startSpan({ op: 'db.query', name: 'fetch_users' }, async (span) => {
  const users = await db.query('SELECT * FROM users');

  span.setAttribute('row_count', users.length);
  span.setAttribute('duration_ms', Date.now() - startTime);

  return users;
});
```

### 5. Sanitize Sensitive Data

Never log passwords, API keys, or PII:

```typescript
// ✅ Good - Sanitized
logger.info('Authentication successful', {
  user_id: user.id,
  email: maskEmail(user.email), // j***@example.com
});

// ❌ Bad - Contains sensitive data
logger.info('Authentication successful', {
  user_id: user.id,
  password: user.password, // NEVER LOG THIS
  api_key: user.api_key,   // NEVER LOG THIS
});
```

### 6. Console Logging Integration

Console methods are automatically captured by Sentry:

```typescript
// These are automatically sent to Sentry as structured logs
console.log('Info message');
console.warn('Warning message');
console.error('Error message');
```

However, prefer using the Sentry logger for better structure:

```typescript
// ✅ Better - More structured
logger.info('Operation completed', { operation: 'sync', duration: 1000 });

// ⚠️ OK - Automatically captured but less structured
console.log('Operation completed: sync took 1000ms');
```

## Testing Sentry Integration

### 1. Test Error Tracking

Create a test API route:

```typescript
// src/app/api/sentry-test/route.ts
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    throw new Error('Test error from Sentry integration');
  } catch (error) {
    Sentry.captureException(error, {
      tags: { test: true },
    });
    return NextResponse.json({ error: 'Test error sent to Sentry' }, { status: 500 });
  }
}
```

Visit `/api/sentry-test` and check your Sentry dashboard.

### 2. Test Logging

```typescript
import * as Sentry from '@sentry/nextjs';
const { logger } = Sentry;

logger.info('Test log from Sentry integration', {
  test: true,
  timestamp: Date.now(),
});
```

### 3. Verify Performance Tracking

Check the Performance section in your Sentry dashboard to see:
- API route response times
- Database query durations
- External API call latencies

## Additional Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Structured Logging](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/custom-instrumentation/)
- [Sentry Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)
