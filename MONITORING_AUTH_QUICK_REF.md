# Monitoring API Authentication - Quick Reference

## TL;DR

✅ **Added optional authentication to monitoring APIs**
✅ **Fully backward compatible - no breaking changes**
✅ **Automatic fallback on auth errors**
✅ **Ready to deploy**

---

## Quick Start

### Import and Use

```typescript
// Import the service
import { monitoringService } from '@/lib/monitoring-service';
import { getApiKey } from '@/lib/api';

// Get API key (undefined if not logged in)
const apiKey = getApiKey() || undefined;

// Make authenticated request
const stats = await monitoringService.getHealthStats(apiKey);
```

### In React Components

```typescript
import { useModelHealthStats } from '@/hooks/use-model-health';
import { getApiKey } from '@/lib/api';

function MyComponent() {
  const apiKey = getApiKey() || undefined;
  const { stats, loading, error } = useModelHealthStats(apiKey);
  
  if (loading) return <div>Loading...</div>;
  return <div>Total Models: {stats?.total_models}</div>;
}
```

---

## API Reference

### Monitoring Service Methods

```typescript
// All methods accept optional apiKey as last parameter

monitoringService.getModelHealth(provider, model, apiKey?)
monitoringService.getHealthStats(apiKey?)
monitoringService.getModelHealthList(limit, offset, apiKey?)
monitoringService.getUnhealthyModels(errorThreshold, apiKey?)
monitoringService.getProviderSummary(provider, apiKey?)
monitoringService.getProviderList(apiKey?)
```

### Monitoring Hooks

```typescript
// All hooks accept optional apiKey parameter

useModelHealth(provider, model, apiKey?)
useModelHealthStats(apiKey?)
useModelHealthList(limit, offset, apiKey?)
useUnhealthyModels(errorThreshold, apiKey?)
useProviderSummary(provider, apiKey?)
useProviderList(apiKey?)
```

---

## Common Patterns

### Pattern 1: Simple Hook Usage

```typescript
const apiKey = getApiKey() || undefined;
const { stats } = useModelHealthStats(apiKey);
```

### Pattern 2: Service Call with Error Handling

```typescript
const apiKey = getApiKey() || undefined;

try {
  const health = await monitoringService.getModelHealth('openai', 'gpt-4', apiKey);
} catch (error) {
  console.error('Failed to fetch health:', error);
}
```

### Pattern 3: Conditional Authentication

```typescript
// Automatically uses auth if available
const apiKey = getApiKey() || undefined;
const stats = await monitoringService.getHealthStats(apiKey);
```

---

## Authentication Flow

```
User Logged In?
    ├─ Yes → Use API key → Request authenticated → Backend logs user
    └─ No  → No API key   → Request public       → Backend allows access

Invalid API Key?
    └─ Service automatically retries without auth → Request succeeds
```

---

## Files Modified

| File | Type | Change |
|------|------|--------|
| `src/lib/monitoring-service.ts` | NEW | Centralized monitoring service |
| `src/hooks/use-model-health.ts` | MODIFIED | Added `apiKey` parameter to all hooks |
| `src/app/model-health/page.tsx` | MODIFIED | Retrieves and passes API key |
| `src/components/model-health/unhealthy-models-alert.tsx` | MODIFIED | Added optional `apiKey` prop |

---

## Key Features

### 🔐 Optional Authentication
- Works with or without login
- No breaking changes
- Graceful degradation

### 🔄 Automatic Retry
- Invalid token? Retries without auth
- Seamless user experience
- No errors shown to user

### 📊 Future Ready
- Prepared for rate limiting
- Ready for access control
- Analytics enabled

### ✅ Type Safe
- Full TypeScript support
- Type checking passes
- IntelliSense support

---

## Testing Checklist

- [ ] Visit /model-health without logging in
- [ ] All metrics load correctly
- [ ] Log in and visit /model-health
- [ ] Network tab shows Authorization header
- [ ] Corrupt API key in localStorage
- [ ] Page still loads (warning in console)
- [ ] Run `pnpm typecheck` - passes

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Audit Trail** | Track user access to monitoring features |
| **Analytics** | Understand feature usage patterns |
| **Rate Limits** | Backend can set higher limits for auth users |
| **Access Control** | Ready for premium/admin features |
| **Future Proof** | Prepared for advanced features |

---

## Documentation

- **Full Details**: `MONITORING_AUTH_IMPLEMENTATION.md`
- **Summary**: `MONITORING_AUTH_SUMMARY.md`
- **Examples**: `MONITORING_AUTH_EXAMPLES.md`
- **This File**: Quick reference

---

## Need Help?

```typescript
// Basic pattern that works everywhere:
const apiKey = getApiKey() || undefined;
const data = await monitoringService.getYourData(apiKey);
```

---

**Status:** ✅ Complete and Ready
**Compatibility:** ✅ Fully Backward Compatible
**Type Check:** ✅ Passing
