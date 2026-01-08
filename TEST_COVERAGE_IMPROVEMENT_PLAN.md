# Test Coverage Improvement Plan

## Current State

**Overall Coverage:**
- Lines: 23.93% (4,784/19,989)
- Branches: 22.2% (2,799/12,607)
- Functions: 16.69% (591/3,540)

**Coverage by Directory:**
- `src/middleware.ts`: 0.0%
- `src/hooks`: 3.7% (64/1,752 lines, 33 files)
- `src/app` (pages/API routes): 15.0% (912/6,088 lines, 113 files)
- `src/features`: 16.7% (43/258 lines, 3 files)
- `src/components`: 23.0% (1,085/4,725 lines, 172 files)
- `src/context`: 29.3% (206/703 lines, 3 files)
- `src/lib`: 37.2% (2,347/6,303 lines, 87 files)
- `src/integrations`: 83.0% (127/153 lines, 2 files)

## Target Goals

**Phase 1 (Immediate - 2 weeks):**
- Overall coverage: 40%+
- Critical paths: 60%+
- API routes: 50%+

**Phase 2 (1 month):**
- Overall coverage: 60%+
- Critical paths: 80%+
- All new code: 80%+

**Phase 3 (2-3 months):**
- Overall coverage: 80%+
- All production code: 70%+

## Priority Areas (Ordered by Impact)

### 1. Critical API Routes (HIGH PRIORITY) ⚠️
**Impact:** These handle user data, authentication, payments, and core functionality

#### Payment & Billing
- [ ] `src/app/api/stripe/checkout/route.ts` - Payment processing
- [ ] `src/app/api/stripe/webhook/route.ts` - Stripe webhooks
- [ ] `src/app/api/stripe/customer/route.ts` - Customer management
- [ ] `src/app/api/stripe/portal/route.ts` - Subscription portal

#### Chat & AI Completions
- [ ] `src/app/api/chat/completions/route.ts` - OpenAI-compatible API
- [ ] `src/app/api/chat/sessions/route.ts` (0/97 lines) - Session management
- [ ] `src/app/api/chat/ai-sdk-completions/route.ts` - AI SDK integration
- [ ] `src/app/api/chat/search/route.ts` - Model search
- [ ] `src/app/api/chat/stats/route.ts` - Chat statistics

#### Authentication & User Management
- [ ] `src/app/api/auth/*/route.ts` - Authentication endpoints
- [ ] `src/app/api/user/api-keys/route.ts` - API key management
- [ ] `src/app/api/user/activity/route.ts` - Activity logging

#### Model Discovery
- [ ] `src/app/api/models/route.ts` - Model listing
- [ ] `src/app/api/gateways/route.ts` - Gateway management

### 2. Authentication & Session Management (HIGH PRIORITY) ⚠️
**Impact:** Core security and user experience

- [ ] `src/lib/auth/auth-service.ts` (0/158 lines) - Authentication service
- [ ] `src/context/gatewayz-auth-context-v2.tsx` (0/125 lines) - Auth context
- [ ] `src/hooks/use-auth.ts` - Auth hook
- [ ] `src/lib/privy.ts` - Privy configuration
- [ ] `src/components/providers/privy-provider.tsx` - Privy provider

### 3. Chat Functionality (HIGH PRIORITY) ⚠️
**Impact:** Core product feature

#### Streaming & Real-time Communication
- [ ] `src/hooks/chat/use-streaming.ts` (0/162 lines) - Streaming hook
- [ ] `src/lib/streaming/stream-chat.ts` - Chat streaming
- [ ] `src/lib/streaming.ts` - General streaming utilities
- [ ] `src/features/chat/useChatController.ts` (0/159 lines) - Chat controller

#### Message & Session Management
- [ ] `src/hooks/chat/use-sessions.ts` (0/121 lines) - Session management
- [ ] `src/hooks/chat/use-messages.ts` (0/104 lines) - Message management
- [ ] `src/lib/chat-history.ts` - Chat history service
- [ ] `src/lib/message-queue.ts` (0/162 lines) - Message queueing

#### Performance & Tracking
- [ ] `src/lib/chat-performance-tracker.ts` (0/126 lines) - Performance tracking
- [ ] `src/hooks/use-chat-stream.ts` - Chat stream hook

### 4. Model Management & Discovery (MEDIUM PRIORITY)
**Impact:** Core product feature

- [ ] `src/lib/models-service.ts` - Multi-gateway model fetching
- [ ] `src/lib/models-data.ts` - Model metadata
- [ ] `src/lib/model-sync-service.ts` (0/125 lines) - Model synchronization
- [ ] `src/hooks/use-model-health.ts` (0/115 lines) - Model health monitoring
- [ ] `src/hooks/useModelData.ts` - Model data hook

### 5. UI Components & Pages (MEDIUM PRIORITY)

#### Critical Pages
- [ ] `src/app/settings/keys/page.tsx` (0/163 lines) - API keys management
- [ ] `src/app/settings/credits/page.tsx` (0/157 lines) - Credits management
- [ ] `src/app/models/models-client.tsx` (0/418 lines) - Model browser
- [ ] `src/app/checkout/page.tsx` - Checkout page
- [ ] `src/app/onboarding/page.tsx` (0/116 lines) - Onboarding flow

#### Complex Components
- [ ] `src/components/models/inline-chat.tsx` (0/133 lines) - Inline chat
- [ ] `src/components/layout/app-header.tsx` (0/111 lines) - App header
- [ ] `src/components/ui/sidebar.tsx` (0/131 lines) - Sidebar navigation
- [ ] `src/components/chat-v2/*` - Chat v2 components

### 6. Monitoring & Analytics (MEDIUM PRIORITY)

- [ ] `src/lib/redis-metrics.ts` (0/225 lines) - Redis metrics
- [ ] `src/hooks/use-web-vitals.ts` (0/99 lines) - Web vitals tracking
- [ ] `src/hooks/use-asset-tracking.ts` (0/96 lines) - Asset tracking
- [ ] `src/lib/analytics.ts` - Analytics service
- [ ] `src/app/api/vitals/route.ts` (0/106 lines) - Vitals API

### 7. Infrastructure & Utilities (LOW PRIORITY)

- [ ] `src/middleware.ts` (0/5 lines) - Next.js middleware
- [ ] `src/app/api/cache/invalidate/route.ts` (0/106 lines) - Cache invalidation
- [ ] `src/lib/preview-hostname-handler.ts` (0/100 lines) - Preview handling
- [ ] `src/hooks/*` - Remaining utility hooks

## Testing Strategy

### Unit Tests
**Focus:** Individual functions and components in isolation

**Tools:**
- Jest for test runner
- React Testing Library for component tests
- Mock service workers (MSW) for API mocking

**Coverage Target:** 60%+ for utility functions, 50%+ for components

### Integration Tests
**Focus:** Multi-component interactions and API flows

**Examples:**
- Auth flow: Login → Store credentials → API calls
- Chat flow: Create session → Send message → Stream response
- Payment flow: Select plan → Checkout → Webhook → Update subscription

**Coverage Target:** 80%+ for critical user paths

### API Route Tests
**Focus:** Request/response validation, error handling

**Pattern:**
```typescript
// src/app/api/[route]/__tests__/route.test.ts
describe('API Route: /api/[route]', () => {
  it('should handle valid requests')
  it('should validate input')
  it('should handle authentication')
  it('should handle errors gracefully')
  it('should return correct status codes')
})
```

**Coverage Target:** 70%+ for all API routes

### Hook Tests
**Focus:** State management and side effects

**Pattern:**
```typescript
// src/hooks/__tests__/use-[hook].test.ts
import { renderHook, act } from '@testing-library/react'

describe('useHook', () => {
  it('should initialize with default state')
  it('should update state correctly')
  it('should handle side effects')
  it('should clean up on unmount')
})
```

**Coverage Target:** 60%+ for custom hooks

### Component Tests
**Focus:** Rendering, user interactions, accessibility

**Pattern:**
```typescript
// src/components/__tests__/Component.test.tsx
describe('Component', () => {
  it('should render correctly')
  it('should handle user interactions')
  it('should be accessible')
  it('should handle loading/error states')
})
```

**Coverage Target:** 50%+ for UI components

## Implementation Phases

### Phase 1: Critical Path Testing (Week 1-2)
**Goal:** Protect critical functionality

1. **API Routes (Priority 1)**
   - Payment processing (Stripe)
   - Authentication endpoints
   - Chat completions API
   - Model listing API

2. **Authentication (Priority 2)**
   - Auth context and hooks
   - Session management
   - API key handling

3. **Chat Core (Priority 3)**
   - Message sending/receiving
   - Session management
   - Basic streaming

**Deliverables:**
- 50+ new test files
- Coverage: 40%+ overall, 60%+ for critical paths
- All payment flows tested
- All auth flows tested

### Phase 2: Feature Testing (Week 3-4)
**Goal:** Test main product features

1. **Chat Advanced Features**
   - Streaming with error recovery
   - Performance tracking
   - Message queue
   - Multi-model support

2. **Model Management**
   - Model discovery and sync
   - Health monitoring
   - Search functionality

3. **User Management**
   - Credits system
   - API keys CRUD
   - Activity logging

**Deliverables:**
- 40+ new test files
- Coverage: 60%+ overall
- All chat features tested
- Model management tested

### Phase 3: UI & Edge Cases (Week 5-8)
**Goal:** Comprehensive coverage

1. **Pages & Components**
   - Settings pages
   - Model browser
   - Dashboard components
   - Onboarding flow

2. **Edge Cases & Error Handling**
   - Network failures
   - Rate limiting
   - Invalid inputs
   - Timeout scenarios

3. **Monitoring & Analytics**
   - Metrics tracking
   - Performance monitoring
   - Error reporting

**Deliverables:**
- 50+ new test files
- Coverage: 80%+ overall
- All pages tested
- Edge cases covered

## Test Infrastructure Improvements

### 1. Test Utilities & Helpers
Create shared testing utilities:

```typescript
// src/__tests__/utils/test-utils.tsx
// - renderWithProviders (Auth, Theme, Router)
// - mockApiResponse
// - mockStreamingResponse
// - createMockUser
// - createMockSession
```

### 2. MSW (Mock Service Worker)
Set up API mocking:

```typescript
// src/__tests__/mocks/handlers.ts
// - Mock all API routes
// - Support different response scenarios
// - Simulate errors and delays
```

### 3. Test Data Factories
Create realistic test data:

```typescript
// src/__tests__/factories/
// - userFactory.ts
// - modelFactory.ts
// - sessionFactory.ts
// - messageFactory.ts
```

### 4. Coverage Thresholds
Update `jest.config.mjs`:

```javascript
coverageThreshold: {
  global: {
    branches: 40,
    functions: 40,
    lines: 40,
    statements: 40
  },
  // Critical paths require higher coverage
  './src/app/api/stripe/**/*.ts': {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  },
  './src/lib/auth/**/*.ts': {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

### 5. CI/CD Integration
Update `.github/workflows/ci.yml`:

- ✅ Already uploads coverage to Codecov
- [ ] Add coverage threshold enforcement
- [ ] Add PR comment with coverage diff
- [ ] Block PRs that decrease coverage by >1%

### 6. Pre-commit Hooks
Add coverage checks to pre-commit:

```bash
# .husky/pre-commit
pnpm test --coverage --changedSince=HEAD~1
```

## Quick Wins (Can be done in 1-2 days)

1. **Add tests for existing well-tested utilities**
   - `/src/lib/utils.ts` - Helper functions
   - `/src/lib/tier-utils.ts` - Tier calculations
   - `/src/lib/config.ts` - Configuration

2. **Add tests for pure functions in models-service**
   - Model deduplication logic
   - Model filtering
   - Price calculations

3. **Add tests for simple components**
   - Button variations
   - Card components
   - Badge components

4. **Add tests for validation schemas**
   - Zod schemas
   - Form validators

**Expected Impact:** +5-10% coverage in 1-2 days

## Metrics & Tracking

### Daily Metrics
- Coverage percentage (overall)
- Coverage by directory
- Number of test files
- Number of test cases

### Weekly Goals
- Week 1: 30% → 40%
- Week 2: 40% → 45%
- Week 3: 45% → 50%
- Week 4: 50% → 60%

### Quality Metrics
- Test execution time (<5 min)
- Test flakiness (<1%)
- Code review turnaround (<24h)

## Resources & Tools

### Testing Libraries
- Jest - Test runner
- React Testing Library - Component testing
- @testing-library/user-event - User interactions
- MSW - API mocking
- @faker-js/faker - Test data generation

### Coverage Tools
- Istanbul/nyc - Coverage reporting
- Codecov - Coverage tracking & visualization
- lcov - Coverage format

### CI/CD
- GitHub Actions - Test automation
- Codecov GitHub App - PR comments

## Success Criteria

### Phase 1 (2 weeks)
- ✅ 40%+ overall coverage
- ✅ 60%+ coverage for payment APIs
- ✅ 60%+ coverage for auth flows
- ✅ 50%+ coverage for chat APIs
- ✅ All tests passing in CI

### Phase 2 (4 weeks)
- ✅ 60%+ overall coverage
- ✅ 80%+ coverage for critical paths
- ✅ All API routes have tests
- ✅ All hooks have tests

### Phase 3 (8 weeks)
- ✅ 80%+ overall coverage
- ✅ All pages have tests
- ✅ All components have tests
- ✅ Edge cases covered

## Next Steps

1. **Immediate (Today)**
   - ✅ Review this plan
   - [ ] Set up test infrastructure (MSW, factories, utils)
   - [ ] Start with payment API tests

2. **This Week**
   - [ ] Complete Phase 1 critical API tests
   - [ ] Set up coverage thresholds in Jest config
   - [ ] Update CI to enforce thresholds

3. **Next Week**
   - [ ] Begin Phase 2 feature testing
   - [ ] Add pre-commit coverage checks
   - [ ] Review and adjust based on learnings

## Notes

- **Focus on critical paths first** - Payment, Auth, Chat
- **Write realistic tests** - Test real-world scenarios, not just happy paths
- **Keep tests fast** - Use mocking, avoid real API calls
- **Make tests maintainable** - Use shared utilities, avoid duplication
- **Document patterns** - Create examples for common test scenarios

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Author:** Test Coverage Initiative
