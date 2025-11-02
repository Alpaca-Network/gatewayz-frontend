# Gatewayz Frontend - Refactoring Roadmap

Quick reference guide for implementing the duplication fixes identified in `DUPLICATION_ANALYSIS.md`.

## Quick Win Items (Start Here!)

### 1. Delete Duplicate Files (5 minutes)
**Impact:** 15-20KB reduction | **Effort:** 5 min | **Complexity:** Trivial

```bash
# Remove all "* 2.*" files
find src -name "* 2.*" -delete

# Remove backup files
rm src/app/chat/page.tsx.backup
rm src/app/models/[...name]/page.tsx.backup
rm src/app/models/[...name]/page-old.tsx
```

**Affected files:** 34 files (16 originally identified + 18 more found)
**Status:** [✅] COMPLETED

---

## Priority 1: High-Impact Items (Week 1)

### 2. Create API Route Middleware
**Impact:** 30-50KB reduction | **Effort:** 2-3 hours | **Complexity:** Medium

#### Task 2.1: Auth Middleware
Create `src/app/api/middleware/auth.ts`:
```typescript
export async function validateApiKey(request: NextRequest) {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return {
      key: '',
      error: NextResponse.json({ error: 'API key required' }, { status: 401 })
    };
  }
  return { key: apiKey };
}
```

**Apply to these files:**
- [✅] src/app/api/chat/sessions/route.ts
- [✅] src/app/api/chat/sessions/[id]/route.ts
- [✅] src/app/api/chat/sessions/[id]/messages/route.ts
- [✅] src/app/api/user/api-keys/route.ts
- [✅] src/app/api/user/api-keys/[keyId]/route.ts
- [✅] src/app/api/chat/stats/route.ts
- [✅] src/app/api/chat/search/route.ts
- [✅] src/app/api/user/activity/log/route.ts
- [✅] src/app/api/user/activity/stats/route.ts
- [✅] src/app/api/ranking/models/route.ts
- [✅] src/app/api/ranking/apps/route.ts
- [✅] src/app/api/stripe/customer/route.ts
- [✅] All 23 API routes refactored

**Status:** [✅] COMPLETED

#### Task 2.2: Error Handler Middleware
Create `src/app/api/middleware/error-handler.ts`:
```typescript
export function handleApiError(error: unknown, context: string = 'API') {
  console.error(`[${context}] Error:`, error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { error: errorMessage, details: String(error) },
    { status: 500 }
  );
}
```

**Apply to all 23 API route files**

**Status:** [✅] COMPLETED

---

### 3. Settings Page Hooks
**Impact:** 50-80KB reduction | **Effort:** 4-6 hours | **Complexity:** Medium

#### Task 3.1: useClientMounted Hook
Create `src/hooks/use-client-mounted.ts`:
```typescript
import { useState, useEffect } from 'react';

export function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
```

**Hook Created:** [✅] COMPLETED

**Apply to:**
- [ ] src/app/settings/keys/page.tsx
- [ ] src/app/settings/account/page.tsx
- [ ] src/app/settings/activity/page.tsx
- [ ] src/app/settings/credits/page.tsx

**Status:** [⏳] Ready for Phase 3

#### Task 3.2: useSettingsData Hook
Create `src/hooks/use-settings-data.ts`:
```typescript
import { useState, useEffect } from 'react';
import { makeAuthenticatedRequest, getApiKey } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function useSettingsData<T>(
  endpoint: string,
  options?: { onError?: (error: any) => void }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        setLoading(false);
        return;
      }

      try {
        const response = await makeAuthenticatedRequest(endpoint);
        if (response.ok) {
          setData(await response.json());
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        options?.onError?.(error);
        toast({ title: 'Error', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endpoint, toast, options]);

  return { data, loading };
}
```

**Hook Created:** [✅] COMPLETED

**Apply to:**
- [ ] src/app/settings/keys/page.tsx
- [ ] src/app/settings/activity/page.tsx
- [ ] src/app/settings/credits/page.tsx
- [ ] src/app/settings/referrals/page.tsx

**Status:** [⏳] Ready for Phase 3

#### Task 3.3: Extract SettingsSection Component
Create `src/components/settings/settings-section.tsx`:
```typescript
export const SettingsSection = ({
  title,
  description,
  descriptionDetail,
  children
}: {
  title: string;
  description: string;
  descriptionDetail?: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="md:col-span-1">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {descriptionDetail && (
        <p className="text-sm text-muted-foreground mt-2">{descriptionDetail}</p>
      )}
    </div>
    <div className="md:col-span-2">{children}</div>
  </div>
);
```

**Component Created:** [✅] COMPLETED

**Apply to:**
- [ ] src/app/settings/page.tsx
- [ ] src/app/settings/referrals/page.tsx
- [ ] src/app/settings/activity/page.tsx

**Status:** [⏳] Ready for Phase 3

---

## Priority 2: Medium-Impact Items (Week 2)

### 4. Consolidate API_BASE_URL
**Impact:** 2-3KB reduction | **Effort:** 1 hour | **Complexity:** Trivial

Update `src/lib/config.ts` to export all variants:
```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
export const CHAT_HISTORY_API_URL = process.env.NEXT_PUBLIC_CHAT_HISTORY_API_URL || API_BASE_URL;
export const BACKEND_URL = process.env.BACKEND_URL || API_BASE_URL;
```

**Apply to these 21 files:**
- [✅] All src/app/api files (import from config)
- [✅] All 23 API routes now use centralized config

**Status:** [✅] COMPLETED

---

### 5. Merge Stripe Webhook Routes
**Impact:** 30-40KB reduction | **Effort:** 2-3 hours | **Complexity:** Medium

**Current structure:**
- `src/app/api/stripe/webhook/route.ts` (134 lines)
- `src/app/api/payments/webhook/route.ts` (134 lines)
- 95% duplicate code

**Action:**
- [✅] Both webhooks refactored with middleware
- [✅] Error handling standardized
- [✅] Both routes use same pattern

**Status:** [✅] COMPLETED (Note: Both routes kept for backward compatibility)

---

### 6. Centralize Type Definitions
**Impact:** 3-5KB reduction | **Effort:** 1 hour | **Complexity:** Trivial

Create `src/lib/types.ts`:
```typescript
// API Key types
export interface ApiKey {
  id: number;
  api_key: string;
  key_name: string;
  // ... full definition
}

// Payment types
export interface StripePaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
  // ... full definition
}

// Activity types
export interface ActivityLogEntry {
  id: number;
  timestamp: string;
  // ... full definition
}

// Referral types
export interface ReferralTransaction {
  id: number;
  referee_email: string;
  // ... full definition
}
```

**Apply to:**
- [ ] src/app/settings/keys/page.tsx
- [ ] src/app/settings/account/page.tsx
- [ ] src/app/settings/activity/page.tsx
- [ ] src/app/settings/referrals/page.tsx

**Status:** [ ] Not Started

---

### 7. Extract Settings Page Components
**Impact:** 20-30KB reduction | **Effort:** 3-4 hours | **Complexity:** Medium

#### Component 7.1: EmptyState
Create `src/components/ui/empty-state.tsx`:
```typescript
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div className="text-center py-12 border border-border rounded-lg bg-muted/30">
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        {Icon}
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {action}
    </div>
  </div>
);
```

**Apply to:**
- [ ] src/app/settings/keys/page.tsx
- [ ] src/app/settings/credits/page.tsx
- [ ] src/app/settings/activity/page.tsx

**Status:** [ ] Not Started

#### Component 7.2: TableHeader
Create `src/components/ui/table-header.tsx`:
```typescript
export const TableHeader = ({
  columns
}: {
  columns: { label: string; hidden?: boolean }[];
}) => (
  <div className="bg-muted/50 px-4 py-3 border-b border-border">
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm font-medium text-foreground">
      {columns.map((col, i) => (
        <div key={i} className={col.hidden ? 'hidden lg:block' : ''}>
          {col.label}
        </div>
      ))}
    </div>
  </div>
);
```

**Apply to:**
- [ ] src/app/settings/keys/page.tsx
- [ ] src/app/settings/referrals/page.tsx
- [ ] src/app/settings/activity/page.tsx

**Status:** [ ] Not Started

#### Component 7.3: RemovableBadgeArray
Create `src/components/ui/removable-badge-array.tsx`:
```typescript
export const RemovableBadgeArray = ({
  items,
  onRemove
}: {
  items: string[];
  onRemove: (item: string) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {items.map(item => (
      <Badge key={item} variant="secondary" className="capitalize">
        {item}
        <button onClick={() => onRemove(item)} className="ml-2 hover:text-destructive">
          <X className="h-3 w-3" />
        </button>
      </Badge>
    ))}
  </div>
);
```

**Apply to:**
- [ ] src/app/settings/page.tsx (appears 2x: allowed + ignored providers)

**Status:** [ ] Not Started

---

## Priority 3: Nice-to-Have Items (Week 3)

### 8. Create Logger Utility
**Impact:** 2-3KB reduction | **Effort:** 1 hour | **Complexity:** Trivial

Create `src/lib/logger.ts`:
```typescript
export const apiLogger = {
  log: (context: string, message: string, data?: any) => {
    console.log(`[${context}] ${message}`, data);
  },
  error: (context: string, message: string, error?: any) => {
    console.error(`[${context}] ${message}`, error);
  },
  warn: (context: string, message: string, data?: any) => {
    console.warn(`[${context}] ${message}`, data);
  }
};
```

**Apply to all API routes (replace console calls)**

**Status:** [ ] Not Started

---

### 9. Extract Loading Spinner
**Impact:** 1-2KB reduction | **Effort:** 30 minutes | **Complexity:** Trivial

Create `src/components/ui/loading-spinner.tsx`:
```typescript
export const LoadingSpinner = ({ message }: { message?: string } = {}) => (
  <div className="text-center py-12 border border-border rounded-lg bg-card">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      {message && <p className="text-muted-foreground">{message}</p>}
    </div>
  </div>
);
```

**Apply to:**
- [ ] src/app/settings/keys/page.tsx
- [ ] src/app/settings/activity/page.tsx
- [ ] src/app/settings/credits/page.tsx

**Status:** [ ] Not Started

---

### 10. Create Tailwind Component Utilities
**Impact:** 5-15KB bundle reduction | **Effort:** 30-45 minutes | **Complexity:** Trivial

Add to `src/styles/globals.css`:
```css
@layer components {
  .settings-grid {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4;
  }
  
  .settings-empty-state {
    @apply text-center py-12 border border-border rounded-lg bg-muted/30;
  }
  
  .table-row-hover {
    @apply px-4 py-3 hover:bg-muted/50 dark:hover:bg-muted/30;
  }
  
  .table-header {
    @apply bg-muted/50 px-4 py-3 border-b border-border;
  }
  
  .loading-state {
    @apply text-center py-12 border border-border rounded-lg bg-card;
  }
}
```

**Update files to use classes:**
- [ ] src/app/settings/page.tsx
- [ ] src/app/settings/keys/page.tsx
- [ ] src/app/settings/activity/page.tsx
- [ ] src/app/settings/referrals/page.tsx

**Status:** [ ] Not Started

---

## Implementation Checklist

### Week 1 - Critical Wins
- [ ] Delete 16 duplicate files (5 min)
- [ ] Create API middleware directory (2-3h)
- [ ] Create useClientMounted hook (30 min)
- [ ] Create useSettingsData hook (1-2h)
- [ ] Extract SettingsSection component (1h)

**Expected Result:** 95-150KB reduction, improved API consistency

### Week 2 - Medium Impact
- [ ] Consolidate API_BASE_URL in all files (1h)
- [ ] Merge Stripe webhooks (2-3h)
- [ ] Create shared types file (1h)
- [ ] Extract EmptyState component (1h)
- [ ] Extract TableHeader component (1h)
- [ ] Extract RemovableBadgeArray component (1h)

**Expected Result:** Additional 50-80KB reduction, better maintainability

### Week 3 - Polish
- [ ] Create logger utility (1h)
- [ ] Extract LoadingSpinner component (30 min)
- [ ] Create Tailwind @layer components (45 min)

**Expected Result:** Additional 10-20KB reduction, better developer experience

---

## Testing Checklist

After each refactoring:
- [ ] Run build: `pnpm build`
- [ ] Check bundle size: `pnpm analyze` (if available)
- [ ] Test affected features manually
- [ ] Run tests: `pnpm test`
- [ ] Verify no TypeScript errors: `pnpm typecheck`

---

## Success Metrics

| Metric | Before | Target | Status |
|--------|--------|--------|--------|
| Source Duplication | 15-22% | <5% | [ ] |
| API Route Files | 23 | 23 (cleaner) | [ ] |
| Settings Pages | 7 (duplicated) | 7 (using shared components) | [ ] |
| Bundle Size | 40-60KB duplication | <20KB duplication | [ ] |
| Developer Velocity | Slower | +25-40% | [ ] |
| Consistency Score | 60% | 95%+ | [ ] |

---

## Notes

- Each task is independent and can be done in any order
- Start with "Quick Win" to build momentum
- Test frequently to catch issues early
- Update this roadmap as you complete tasks

**Questions?** Refer to `DUPLICATION_ANALYSIS.md` for detailed explanations and code examples.
