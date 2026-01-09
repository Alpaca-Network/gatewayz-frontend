# Sentry Quick Reference Card

Quick reference for using Sentry in the Gatewayz Beta application.

## Import

```typescript
import * as Sentry from '@sentry/nextjs';
const { logger } = Sentry;
```

## Exception Catching

### API Routes (Automatic)
```typescript
export async function POST(request: NextRequest) {
  try {
    // Your logic
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "API /api/your-route");
  }
}
```

### Manual Capturing
```typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { operation: 'name', user_id: userId },
    extra: { context: data },
    level: 'error',
  });
  throw error;
}
```

## Performance Tracking

### API Routes
```typescript
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/route' },
    async (span) => {
      span.setAttribute('param', value);
      const result = await operation();
      span.setAttribute('status', 'success');
      return NextResponse.json(result);
    }
  );
}
```

### UI Components
```typescript
const handleClick = () => {
  Sentry.startSpan(
    { op: 'ui.click', name: 'Button Click' },
    (span) => {
      span.setAttribute('user_id', userId);
      logger.info('User clicked button');
      doAction();
    }
  );
};
```

### Async Operations
```typescript
async function fetchData() {
  return Sentry.startSpan(
    { op: 'http.client', name: 'Fetch User Data' },
    async (span) => {
      const data = await fetch('/api/data');
      span.setAttribute('size', data.length);
      return data;
    }
  );
}
```

## Structured Logging

### Log Levels
```typescript
logger.trace('Verbose debug info', { detail: 'x' });
logger.debug(logger.fmt`Cache miss for ${key}`);
logger.info('Operation complete', { duration: 100 });
logger.warn('Rate limit near', { current: 90, max: 100 });
logger.error('Operation failed', { error: err.message });
logger.fatal('System critical', { reason: 'db_down' });
```

### Template Literals
```typescript
// ✅ Correct
logger.info(logger.fmt`User ${userId} action ${action}`);

// ❌ Wrong
logger.info(`User ${userId} action ${action}`);
```

### Structured Context
```typescript
logger.info('Payment processed', {
  transaction_id: 'txn_123',
  amount: 99.99,
  user_id: userId,
  duration_ms: elapsed,
});
```

## Common Operations

### op Values
- `http.server` - API routes
- `http.client` - External API calls
- `ui.click` - Button clicks
- `ui.submit` - Form submissions
- `ui.navigation` - Navigation events
- `db.query` - Database queries
- `cache.get` - Cache operations

### Span Attributes
```typescript
span.setAttribute('string_value', 'text');
span.setAttribute('number_value', 123);
span.setAttribute('boolean_value', true);
span.setAttribute('error', true); // On error
```

### Error Context
```typescript
Sentry.captureException(error, {
  tags: {
    component: 'ChatInterface',
    operation: 'send_message',
  },
  extra: {
    messageLength: msg.length,
    model: selectedModel,
  },
  level: 'error', // trace, debug, info, warning, error, fatal
});
```

## Testing

Visit these endpoints to test:
- `/api/sentry-test` - All tests
- `/api/sentry-test?type=error` - Error capture
- `/api/sentry-test?type=logging` - Logging
- `/api/sentry-test?type=spans` - Span tracking

## Best Practices

1. **Always add context** to errors and spans
2. **Use structured logging** instead of string interpolation
3. **Use `logger.fmt`** for template literals
4. **Don't log sensitive data** (passwords, API keys, PII)
5. **Add performance metrics** (duration, size, count)
6. **Use appropriate log levels** (info for normal, error for failures)
7. **Wrap UI interactions** with spans for tracking

## Documentation

- Full Guide: `SENTRY_INTEGRATION.md`
- Setup: `SENTRY_SETUP_SUMMARY.md`
- Implementation: `SENTRY_IMPLEMENTATION_COMPLETE.md`
- Example: `src/components/examples/sentry-example-component.tsx`
