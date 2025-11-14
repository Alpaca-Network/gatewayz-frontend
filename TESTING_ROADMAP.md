# Gatewayz Frontend Testing Roadmap

## Current Coverage Summary
- **Total Test Files:** 13
- **Tested Library Functions:** 4 of 19 (21%)
- **Tested Hooks:** 0 of 11 (0%)
- **Tested API Routes:** 1 of 28 (3.6%)
- **Tested Components:** 2 of 110+ (< 2%)

## Priority Matrix

### P0 - Critical (Must Have)
These tests protect revenue, security, and core functionality.

#### 1. Payment & Billing Logic
- [ ] `src/lib/__tests__/stripe.test.ts`
  - Test checkout redirect flow
  - Test error handling for payment failures
  - Test API key validation
  - Test user email sanitization

- [ ] `src/app/api/stripe/webhook/__tests__/route.test.ts`
  - Test payment_intent.succeeded event
  - Test checkout.session.completed event
  - Test customer.subscription.* events
  - Test webhook signature verification
  - Test duplicate event handling (idempotency)

#### 2. Authentication & Authorization
- [ ] `src/app/api/auth/__tests__/route.test.ts`
  - Test successful authentication (all providers)
  - Test new user creation flow
  - Test API key generation
  - Test token refresh
  - Test invalid credentials handling

- [ ] `src/context/__tests__/gatewayz-auth-context.test.tsx`
  - Test authentication state updates
  - Test login/logout flows
  - Test session persistence
  - Test cross-tab synchronization
  - Test 401 error handling

#### 3. Tier & Subscription Management
- [ ] `src/lib/__tests__/tier-utils.test.ts`
  - Test `getUserTier()` with various scenarios
  - Test `canAccessModel()` tier hierarchy
  - Test `hasActiveSubscription()` edge cases
  - Test `getSubscriptionRenewalDate()` conversion
  - Test `isSubscriptionExpiringSoon()` calculations
  - Test `formatTierInfo()` display logic

- [ ] `src/hooks/__tests__/use-tier.test.ts`
  - Test tier detection from user data
  - Test subscription status updates
  - Test access control checks
  - Test tier upgrade eligibility

#### 4. Chat Session Management
- [ ] `src/lib/__tests__/chat-history.test.ts`
  - Test ChatHistoryAPI.createSession()
  - Test ChatHistoryAPI.getSessions() with pagination
  - Test ChatHistoryAPI.saveMessage()
  - Test ChatHistoryAPI.deleteSession()
  - Test timeout handling
  - Test concurrent request handling
  - Test error recovery

- [ ] `src/app/api/chat/sessions/__tests__/route.test.ts`
  - Test GET /api/chat/sessions (list all)
  - Test POST /api/chat/sessions (create)
  - Test GET /api/chat/sessions/[id] (get one)
  - Test PUT /api/chat/sessions/[id] (update)
  - Test DELETE /api/chat/sessions/[id] (delete)
  - Test authorization checks

### P1 - High Priority (Should Have)
These tests ensure reliability of key features.

#### 5. API Routes
- [ ] `src/app/api/stripe/checkout/__tests__/route.test.ts`
- [ ] `src/app/api/stripe/portal/__tests__/route.test.ts`
- [ ] `src/app/api/user/api-keys/__tests__/route.test.ts`
- [ ] `src/app/api/user/me/__tests__/route.test.ts`
- [ ] `src/app/api/chat/stats/__tests__/route.test.ts`
- [ ] `src/app/api/chat/search/__tests__/route.test.ts`

#### 6. Core Hooks
- [ ] `src/hooks/__tests__/use-auth.test.ts`
- [ ] `src/hooks/__tests__/useModelData.test.ts`
- [ ] `src/hooks/__tests__/useAISDKChat.test.ts`
- [ ] `src/hooks/__tests__/useGatewayRouter.test.ts`
- [ ] `src/hooks/__tests__/use-toast.test.ts`

#### 7. Utility Functions
- [ ] `src/lib/__tests__/analytics.test.ts`
- [ ] `src/lib/__tests__/streaming.test.ts`
- [ ] `src/lib/__tests__/chat-stream-handler.test.ts`

### P2 - Medium Priority (Nice to Have)
These tests improve confidence in UI components.

#### 8. Critical UI Components
- [ ] `src/components/chat/__tests__/chat-interface.test.tsx`
- [ ] `src/components/chat/__tests__/message-list.test.tsx`
- [ ] `src/components/models/__tests__/model-selector.test.tsx`
- [ ] `src/components/models/__tests__/model-filter.test.tsx`
- [ ] `src/components/tier/__tests__/tier-access-guard.test.tsx`
- [ ] `src/components/tier/__tests__/tier-info-card.test.tsx`
- [ ] `src/components/layout/__tests__/user-nav.test.tsx`

#### 9. Provider Components
- [ ] `src/components/providers/__tests__/privy-provider.test.tsx`
- [ ] `src/components/providers/__tests__/statsig-provider.test.tsx`
- [ ] `src/components/providers/__tests__/posthog-provider.test.tsx`

### P3 - Lower Priority
Integration and E2E tests for complete workflows.

#### 10. Integration Tests
- [ ] `src/__tests__/integration/auth-flow.test.ts`
  - Complete login → authenticated request → logout

- [ ] `src/__tests__/integration/chat-flow.test.ts`
  - Create session → send messages → view history → delete

- [ ] `src/__tests__/integration/payment-flow.test.ts`
  - Select plan → checkout → webhook → verify credits

- [ ] `src/__tests__/integration/subscription-flow.test.ts`
  - Upgrade tier → verify access → cancel → verify downgrade

#### 11. E2E Tests (Playwright)
- [ ] `e2e/auth.spec.ts` - Full authentication flow
- [ ] `e2e/chat.spec.ts` - Complete chat conversation
- [ ] `e2e/models.spec.ts` - Model discovery and selection
- [ ] `e2e/payments.spec.ts` - Checkout and payment
- [ ] `e2e/settings.spec.ts` - User settings management

## Testing Standards

### Unit Test Guidelines
```typescript
// ✅ Good: Test behavior, not implementation
it('should upgrade user to pro tier when payment succeeds', async () => {
  const user = createTestUser({ tier: 'basic' });
  await processPayment(user.id, 1500);
  const updatedUser = await getUser(user.id);
  expect(updatedUser.tier).toBe('pro');
});

// ❌ Bad: Testing internal details
it('should call updateUserTier with correct parameters', () => {
  const spy = jest.spyOn(service, 'updateUserTier');
  processPayment(123, 1500);
  expect(spy).toHaveBeenCalledWith(123, 'pro');
});
```

### Coverage Targets
- **Critical paths:** 90%+ coverage
- **Business logic:** 80%+ coverage
- **UI components:** 60%+ coverage
- **Overall target:** 70%+ coverage

### Test Organization
```
src/
├── lib/
│   ├── __tests__/
│   │   ├── tier-utils.test.ts
│   │   ├── stripe.test.ts
│   │   └── chat-history.test.ts
│   └── tier-utils.ts
├── hooks/
│   ├── __tests__/
│   │   ├── use-tier.test.ts
│   │   └── use-auth.test.ts
│   └── use-tier.ts
└── __tests__/
    └── integration/
        ├── auth-flow.test.ts
        └── payment-flow.test.ts
```

## Test Execution Commands

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/lib/__tests__/tier-utils.test.ts

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage

# Run E2E tests
pnpm exec playwright test

# Run specific E2E test
pnpm exec playwright test e2e/auth.spec.ts
```

## Success Metrics

### Week 1-2 (Critical Tests)
- [ ] All P0 tests implemented
- [ ] Payment webhook tests passing
- [ ] Authentication flow tested
- [ ] Tier logic fully covered

### Week 3-4 (API Routes)
- [ ] All critical API routes tested
- [ ] 50%+ API route coverage achieved

### Week 5-6 (Hooks)
- [ ] Core hooks tested (auth, tier, chat)
- [ ] Hook edge cases covered

### Week 7-8 (Components)
- [ ] Critical UI components tested
- [ ] Component interaction tests added

### Week 9 (Integration)
- [ ] 3+ integration test suites complete
- [ ] E2E tests for critical paths

### Final Goal (Week 10)
- [ ] 70%+ overall test coverage
- [ ] All P0 and P1 tests passing
- [ ] CI/CD pipeline with automated testing
- [ ] Test documentation complete

## Resources

### Testing Libraries
- **Jest** - Unit testing framework
- **React Testing Library** - Component testing
- **Playwright** - E2E testing
- **MSW (Mock Service Worker)** - API mocking (recommended addition)

### Helpful Patterns
- Use `@testing-library/react-hooks` for hook testing
- Use `jest.useFakeTimers()` for timeout/timer tests
- Use factories for test data generation
- Mock external services (Stripe, Privy, etc.)

## Notes

- Focus on testing **behavior**, not implementation details
- Prioritize tests that protect revenue and data integrity
- Write tests that fail when bugs are introduced
- Keep tests fast and isolated
- Avoid testing third-party library internals
