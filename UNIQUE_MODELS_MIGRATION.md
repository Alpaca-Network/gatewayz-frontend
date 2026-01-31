# Migration to /models/unique Endpoint

## Overview

Migrate frontend from client-side model deduplication to new backend `/models/unique` endpoint that provides deduplicated models with many-to-many provider relationships.

## Current State

### Current Data Flow
1. Frontend calls `/v1/models?gateway=all`
2. Backend returns ALL models from all providers (with duplicates)
3. Frontend performs complex deduplication in `page.tsx:57-130`
4. Frontend merges `source_gateways` arrays and `gateway_pricing` maps
5. Client displays with expandable rows showing providers

### Current Model Structure
```typescript
interface Model {
  id: string;                        // "openai/gpt-4-turbo"
  name: string;                      // "GPT-4 Turbo"
  provider_slug: string;             // "openai"
  source_gateways: string[];         // ["openrouter", "groq", "fireworks"]
  gateway_pricing: {                 // Manually merged on frontend
    openrouter: { prompt: "...", completion: "..." },
    groq: { prompt: "...", completion: "..." }
  }
}
```

### Issues with Current Approach
- ❌ Frontend performs expensive deduplication (100ms+ with 1000+ models)
- ❌ Complex normalization logic duplicated on frontend
- ❌ No provider health/performance data
- ❌ No "cheapest" or "fastest" provider insights
- ❌ Inconsistent deduplication across different pages

## Target State

### New Data Flow
1. Frontend calls `/models/unique`
2. Backend returns deduplicated models with provider arrays
3. Backend includes cheapest/fastest provider insights
4. Frontend directly renders without deduplication
5. Improved performance and consistency

### New Model Structure
```typescript
interface UniqueModel {
  id: string;                        // "gpt-4"
  name: string;                      // "GPT-4"
  description: string | null;
  context_length: number;
  architecture: {
    input_modalities: string[];
    output_modalities: string[];
  };
  provider_count: number;            // 3
  providers: Provider[];             // Array from many-to-many
  cheapest_provider: string;         // "groq"
  fastest_provider: string;          // "groq"
  cheapest_prompt_price: number;     // 0.025
  fastest_response_time: number;     // 950ms
  created?: number;
}

interface Provider {
  slug: string;                      // "groq"
  name: string;                      // "Groq"
  pricing: {
    prompt: string;                  // "0.025"
    completion: string;              // "0.05"
  };
  health_status: string;             // "healthy" | "degraded" | "down"
  average_response_time_ms: number;  // 950
}
```

## Implementation Plan

### Phase 1: Add New Service Function (models-service.ts)

**File**: `src/lib/models-service.ts`

```typescript
/**
 * Fetch unique models with provider arrays from /models/unique endpoint
 * This endpoint provides deduplicated models with many-to-many provider relationships
 */
export async function getUniqueModels(options?: {
  min_providers?: number;
  sort_by?: 'provider_count' | 'name' | 'cheapest_price';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ data: UniqueModel[], total?: number }> {
  // Implementation...
}
```

**Features**:
- Redis caching with stale-while-revalidate
- Retry logic with exponential backoff
- Client-side and server-side support
- Fallback to static models on error
- Error tracking integration

### Phase 2: Update TypeScript Interfaces

**File**: `src/types/models.ts` (new file)

```typescript
export interface Provider {
  slug: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  health_status: 'healthy' | 'degraded' | 'down';
  average_response_time_ms: number;
}

export interface UniqueModel {
  id: string;
  name: string;
  description: string | null;
  context_length: number;
  architecture: {
    input_modalities: string[];
    output_modalities: string[];
  } | null;
  supported_parameters: string[] | null;
  provider_count: number;
  providers: Provider[];
  cheapest_provider: string;
  fastest_provider: string;
  cheapest_prompt_price: number;
  fastest_response_time: number;
  created?: number;
  is_private?: boolean;
}

// Keep old Model interface for backwards compatibility during migration
export interface Model {
  // ... existing fields
}
```

### Phase 3: Update Models Page (app/models/page.tsx)

**Changes**:
1. Replace `getAllModels()` with `getUniqueModels()`
2. Remove `deduplicateModels()` function (no longer needed!)
3. Update `getAllModels()` implementation:

```typescript
async function getAllModels(): Promise<UniqueModel[]> {
  try {
    const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';
    if (isStaticExport) {
      return transformStaticToUniqueModels(staticModels);
    }

    const isCI = process.env.CI === 'true' && !process.env.VERCEL;
    if (isCI) {
      return transformStaticToUniqueModels(staticModels);
    }

    console.log('[Models Page] Fetching unique models from /models/unique');
    const startTime = Date.now();

    const result = await getUniqueModels({
      sort_by: 'provider_count',
      order: 'desc',
      limit: 1000
    });

    const duration = Date.now() - startTime;
    console.log(`[Models Page] Unique models fetched: ${result.data.length} models in ${duration}ms`);
    return result.data;
  } catch (error) {
    console.error('[Models Page] Failed to fetch unique models:', error);
    return transformStaticToUniqueModels(staticModels);
  }
}
```

4. Add helper function to transform static models:

```typescript
function transformStaticToUniqueModels(staticModels: any[]): UniqueModel[] {
  // Convert old static format to new UniqueModel format
  // Group by model name and create provider arrays
}
```

### Phase 4: Update Models Client (app/models/models-client.tsx)

**Changes**:

1. Update interface to use `UniqueModel`:
```typescript
interface ModelsClientProps {
  initialModels: UniqueModel[];
  isLoadingMore: boolean;
}
```

2. Update `GroupedModelTableRow` component:
```typescript
const GroupedModelTableRow = React.memo(function GroupedModelTableRow({
  model,
  isExpanded,
  onToggle
}: {
  model: UniqueModel;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const providers = model.providers;
  const hasMultipleProviders = model.provider_count > 1;

  // Display cheapest pricing (already calculated by backend!)
  const cheapestProvider = model.providers.find(p => p.slug === model.cheapest_provider);
  const inputCost = cheapestProvider?.pricing.prompt;
  const outputCost = cheapestProvider?.pricing.completion;

  // ... rest of component
});
```

3. Update `ProviderSubRow` to use new `Provider` type:
```typescript
const ProviderSubRow = React.memo(function ProviderSubRow({
  provider,
  isLast,
  isCheapest,
  isFastest
}: {
  provider: Provider;
  isLast: boolean;
  isCheapest: boolean;
  isFastest: boolean;
}) {
  return (
    <div className="...">
      <Badge className={provider.health_status === 'healthy' ? 'bg-green-600' : 'bg-yellow-600'}>
        {provider.name}
      </Badge>
      {isCheapest && <Badge variant="outline">Cheapest</Badge>}
      {isFastest && <Badge variant="outline">Fastest</Badge>}
      <div className="text-right">${provider.pricing.prompt}</div>
      <div className="text-right">${provider.pricing.completion}</div>
      <div className="text-right">{provider.average_response_time_ms}ms</div>
    </div>
  );
});
```

4. Update expanded rows to show all providers:
```typescript
{isExpanded && hasMultipleProviders && (
  <div className="border-t border-border/30">
    {model.providers.map((provider, index) => (
      <ProviderSubRow
        key={provider.slug}
        provider={provider}
        isLast={index === model.providers.length - 1}
        isCheapest={provider.slug === model.cheapest_provider}
        isFastest={provider.slug === model.fastest_provider}
      />
    ))}
  </div>
)}
```

### Phase 5: Update Filtering Logic

**File**: `app/models/models-client.tsx`

Update filtering to work with new `providers` array:

```typescript
const filteredModels = useMemo(() => {
  return searchFilteredModels.filter((model) => {
    // Gateway filter - check if any provider matches selected gateways
    const gatewayMatch = selectedGateways.length === 0 ||
      model.providers.some(p => selectedGateways.includes(p.slug));

    // Pricing filter - use cheapest_prompt_price (already calculated!)
    const priceMatch = (promptPricingRange[0] === 0 && promptPricingRange[1] === 10) ||
      (model.cheapest_prompt_price >= promptPricingRange[0] / 1000000 &&
       model.cheapest_prompt_price <= promptPricingRange[1] / 1000000);

    // ... other filters

    return gatewayMatch && priceMatch && /* other filters */;
  });
}, [/* dependencies */]);
```

### Phase 6: Update Sorting Logic

**File**: `app/models/models-client.tsx`

Simplify sorting with backend-provided fields:

```typescript
sorted.sort((a, b) => {
  switch (sortBy) {
    case 'popular':
      // Use provider_count (already calculated!)
      return b.provider_count - a.provider_count;
    case 'price-asc':
      // Use cheapest_prompt_price (already calculated!)
      return a.cheapest_prompt_price - b.cheapest_prompt_price;
    case 'price-desc':
      return b.cheapest_prompt_price - a.cheapest_prompt_price;
    // ... other cases
  }
});
```

### Phase 7: Add New Features

**New sorting options**:
- Sort by fastest provider
- Sort by provider count
- Sort by health status

**New filters**:
- Filter by minimum provider count
- Filter by health status
- Filter by provider availability

**New UI elements**:
- Health status badges
- Response time indicators
- "Best price" and "Fastest" badges
- Provider comparison table

## Benefits

### Performance Improvements
- ⚡ **Eliminate client-side deduplication** (100ms+ saved)
- ⚡ **Backend-calculated insights** (no frontend computation)
- ⚡ **Simpler filtering logic** (use pre-calculated fields)
- ⚡ **Faster sorting** (use backend-provided scores)

### Data Quality
- ✅ **Consistent deduplication** across all pages
- ✅ **Health status tracking** per provider
- ✅ **Performance metrics** (response time)
- ✅ **Automatic cheapest/fastest identification**

### Developer Experience
- 🎯 **Simpler code** (remove 100+ lines of deduplication)
- 🎯 **Better types** (explicit Provider interface)
- 🎯 **Easier maintenance** (backend handles complexity)
- 🎯 **More features** (health, performance insights)

## Migration Strategy

### Option 1: Feature Flag (Recommended)
1. Implement new `/models/unique` fetch alongside existing logic
2. Add feature flag: `USE_UNIQUE_MODELS_ENDPOINT`
3. Test thoroughly in development
4. Enable for beta users
5. Monitor metrics (load time, error rate)
6. Gradually roll out to 100%
7. Remove old code after 2 weeks

### Option 2: Direct Migration
1. Implement all changes in a single PR
2. Test extensively locally
3. Deploy to production
4. Monitor closely
5. Rollback if issues

**Recommendation**: Use Option 1 (Feature Flag) for safer rollout

## Testing Checklist

- [ ] Models page loads without errors
- [ ] Multi-provider models show expandable rows
- [ ] Cheapest provider highlighted correctly
- [ ] Fastest provider highlighted correctly
- [ ] Health status badges display correctly
- [ ] Response time shown accurately
- [ ] Filtering works with new provider array
- [ ] Sorting works with new fields
- [ ] Search still works correctly
- [ ] Pagination works
- [ ] Mobile view displays correctly
- [ ] Table view works
- [ ] Card view works
- [ ] Performance improved (measure with DevTools)
- [ ] Error handling works (test with backend down)
- [ ] Static fallback works (test with no network)

## Rollout Plan

### Week 1
- [ ] Implement `getUniqueModels()` service function
- [ ] Add TypeScript interfaces
- [ ] Add feature flag
- [ ] Test locally

### Week 2
- [ ] Update models page to use new endpoint (behind flag)
- [ ] Update models-client component
- [ ] Add new UI features (health badges, response time)
- [ ] Internal testing

### Week 3
- [ ] Enable for beta users (10%)
- [ ] Monitor metrics and errors
- [ ] Fix any issues found
- [ ] Gather feedback

### Week 4
- [ ] Gradual rollout (25% → 50% → 75% → 100%)
- [ ] Performance monitoring
- [ ] Remove old code
- [ ] Update documentation

## Files to Modify

1. ✏️ `src/lib/models-service.ts` - Add `getUniqueModels()`
2. ✏️ `src/types/models.ts` - Add `UniqueModel` and `Provider` interfaces
3. ✏️ `src/app/models/page.tsx` - Use new endpoint, remove dedup logic
4. ✏️ `src/app/models/models-client.tsx` - Update to use `UniqueModel`
5. ✏️ `src/lib/config.ts` - Add feature flag
6. 📝 `CLAUDE.md` - Update documentation

## Backwards Compatibility

During migration, maintain backwards compatibility:

```typescript
// Type guard to check which format we have
function isUniqueModel(model: Model | UniqueModel): model is UniqueModel {
  return 'providers' in model && Array.isArray(model.providers);
}

// Adapter function
function adaptToUniqueModel(model: Model): UniqueModel {
  // Convert old format to new format
}
```

## Monitoring

Track these metrics before and after migration:

- **Page Load Time** (target: <1s)
- **Time to Interactive** (target: <2s)
- **Model Fetch Duration** (target: <500ms)
- **Error Rate** (target: <0.1%)
- **Cache Hit Rate** (target: >80%)

## Success Criteria

- ✅ Page load time improved by >20%
- ✅ No increase in error rate
- ✅ All features working correctly
- ✅ Health status displaying
- ✅ Provider comparison working
- ✅ Positive user feedback
