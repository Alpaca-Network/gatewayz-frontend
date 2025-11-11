# Logging System - Quick Start

## 🚀 TL;DR

```typescript
import { createLogger, UserImpact } from '@/lib/logger';

const logger = createLogger('MyService', ['my-tag']);

try {
  // Your code
} catch (error) {
  logger.error('Operation failed', error, {
    userImpact: UserImpact.HIGH,
    context: { additionalData: 'value' },
    tags: ['error-type'],
  });
}
```

## 📦 What You Get

✅ **Error Fingerprinting** - Identical errors group together automatically
✅ **Release Tracking** - Every log includes git SHA, version, environment  
✅ **User Context** - Automatic user ID, tier, session capture
✅ **Impact Assessment** - Prioritize by NONE/LOW/MEDIUM/HIGH/CRITICAL
✅ **Source Maps** - Debug production errors with original file names
✅ **Structured Logs** - Consistent format across all services

## 🎯 User Impact Levels

```typescript
UserImpact.NONE      // Analytics failure (user unaffected)
UserImpact.LOW       // Icon loading failed (minor glitch)
UserImpact.MEDIUM    // Search slower than expected
UserImpact.HIGH      // Chat feature broken (refresh works)
UserImpact.CRITICAL  // Auth failed (user blocked)
```

## 📝 Common Patterns

### API Route
```typescript
import { handleApiError, UserImpact } from '@/app/api/middleware/error-handler';

export async function POST(request: Request) {
  try {
    // Your logic
  } catch (error) {
    return handleApiError(error, 'API Name', {
      userImpact: UserImpact.HIGH,
      metadata: { key: 'value' },
    });
  }
}
```

### React Component
```tsx
import { ErrorBoundary } from '@/components/error-boundary';

<ErrorBoundary context="ComponentName">
  <YourComponent />
</ErrorBoundary>
```

### Service/Business Logic
```typescript
const logger = createLogger('ServiceName', ['service-tag']);

logger.info('Operation started', { userId });

logger.error('Operation failed', error, {
  userImpact: UserImpact.MEDIUM,
  context: { userId, operationId },
  tags: ['operation-error'],
});
```

## 🔍 Error Fingerprints

Identical errors get the same fingerprint:

```typescript
// Error 1: TypeError at line 42
// Error 2: TypeError at line 42
// Both get fingerprint: a3f2d8b9c1e5f6a7

// Benefits:
// - Group identical errors
// - Track frequency
// - Identify widespread issues
```

## 🏗️ Build Info

Automatically injected on every build:

```typescript
import { buildInfo } from '@/lib/build-info';

console.log(buildInfo.sha);         // '016160dfe8...'
console.log(buildInfo.version);     // '0.1.0'
console.log(buildInfo.environment); // 'production'
```

## 🛠️ Setup

Already done! Just use it:

```bash
# Build automatically injects version info
npm run build

# Manual injection (optional)
npm run inject-build-info
```

## 📊 Log Structure

Every log entry includes:

```typescript
{
  level: "error",
  message: "User-friendly description",
  timestamp: "2025-11-11T05:48:33.658Z",
  
  // Auto-added
  releaseSha: "016160dfe8c3f4b4f459110b4abad261ad74dd45",
  releaseVersion: "0.1.0",
  environment: "production",
  service: "gatewayz-beta",
  
  // Error details
  error: {
    name: "TypeError",
    message: "Cannot read property...",
    fingerprint: "a3f2d8b9c1e5f6a7",  // ← Groups identical errors
  },
  
  // Auto-captured
  user: { id, email, tier, sessionId },
  request: { url, path, userAgent },
  
  // Your data
  context: { yourCustomData: 'here' },
  tags: ['your', 'tags'],
  userImpact: "high",
}
```

## 🎨 Examples

See `examples/logging-usage-examples.ts` for:
- Chat service logging
- API error handling
- Payment processing (critical)
- Background tasks (low impact)
- Authentication errors
- Model API calls
- Database operations
- File uploads
- WebSocket connections
- React ErrorBoundary usage

## 📚 Full Documentation

- `LOGGING_INFRASTRUCTURE.md` - Complete guide
- `LOGGING_SUMMARY.md` - Implementation details
- `examples/logging-usage-examples.ts` - Code examples

## 🚨 Quick Rules

1. **Always use structured logging** (not console.log)
2. **Include user impact** for every error
3. **Add relevant context** (IDs, operation details)
4. **Use tags** for filtering
5. **Create context-specific loggers** per service

## ⚡ Zero Config Required

Everything is pre-configured:
- ✅ Logging service ready
- ✅ Build info auto-generated
- ✅ Error boundaries enhanced
- ✅ Analytics enriched
- ✅ Source maps enabled
- ✅ Documentation complete

Just import and use!

---

**Next Steps**: Deploy and start logging! 🎉
