# Authentication Test Coverage Strategy

This document outlines the comprehensive test coverage implemented to prevent authentication-related bugs, specifically targeting the GitHub OAuth signup issue that was fixed in PR #350.

## Overview

The signup flow is complex and involves multiple layers of interaction between Privy (auth provider), our context system, localStorage, and the backend API. To prevent regressions, we've implemented comprehensive tests across unit tests, integration tests, and E2E tests.

## Test Categories

### 1. Unit Tests - Account Type Normalization

**Location**: `src/integrations/privy/__tests__/auth-sync.test.ts`

These tests verify the core normalization logic that converts Privy account types to backend-compatible formats:

```typescript
✓ should normalize github_oauth account type to github
✓ should preserve google_oauth account type unchanged
✓ should handle mixed oauth accounts with github_oauth normalization
```

**Why These Tests Matter**:
- Prevent regression of the 422 validation error (github_oauth not recognized by backend)
- Ensure `google_oauth` isn't incorrectly normalized
- Test real-world scenario of users with multiple linked accounts

**Run**:
```bash
npm test -- src/integrations/privy/__tests__/auth-sync.test.ts
```

### 2. Full Unit Test Suite - Auth Sync

**Location**: `src/integrations/privy/__tests__/auth-sync.test.ts`

The complete test suite includes 28 tests covering:

- New user creation
- Existing user re-authentication
- API key management
- Referral code handling
- Error handling (422, 401, 429, 500)
- Wallet account filtering
- Empty account handling
- Network errors
- Logging and monitoring

**All 28 tests must pass before any auth-related changes are merged.**

**Run**:
```bash
npm test -- src/integrations/privy/__tests__/auth-sync.test.ts
```

### 3. E2E Tests - Account Type Mapping

**Location**: `e2e/auth-account-type-mapping.spec.ts`

Comprehensive E2E tests verifying the entire signup flow from browser perspective:

#### Authentication - Account Type Mapping
```
✓ API auth endpoint accepts github account type (not github_oauth)
✓ auth storage persists with correctly formatted account data
✓ can navigate to settings after authentication
✓ auth persists across page reloads with correct account data
✓ handles authentication errors gracefully
✓ multiple authentication attempts use consistent account types
```

#### OAuth Provider Compatibility
```
✓ supports email authentication
✓ auth context available on initial load
✓ maintains session during normal navigation
```

#### Regression Tests
```
✓ github_oauth normalization does not affect other features
✓ auth works after browser refresh
✓ auth error handling is robust
```

**Why These Tests Matter**:
- Verify the fix works in a real browser environment
- Test OAuth provider compatibility
- Ensure session persistence isn't broken
- Catch regression in related auth features

**Run**:
```bash
pnpm test:e2e -g "Account Type Mapping"
pnpm test:e2e:debug -g "Account Type Mapping"    # With debugging
pnpm test:e2e:headed -g "Account Type Mapping"   # With browser visible
```

### 4. Existing Integration Tests

**Location**: `src/__tests__/integration/auth-to-chat-flow.integration.test.ts`

Tests the complete auth → chat flow to ensure nothing breaks.

### 5. Existing Auth E2E Tests

**Location**: `e2e/auth.spec.ts` and related files

Comprehensive existing E2E tests covering:
- Public page accessibility
- Authentication state persistence
- Protected endpoints
- Session management
- Error handling
- Multiple tabs/windows

## Test Execution Strategy

### Local Development

Before committing auth changes:

```bash
# 1. Run unit tests for account type mapping
npm test -- src/integrations/privy/__tests__/auth-sync.test.ts

# 2. Run all auth unit tests
npm test -- --testPathPattern="auth"

# 3. Run E2E tests (local)
pnpm test:e2e -g "Account Type Mapping"

# 4. Type check
npx tsc --noEmit
```

### Pre-Merge Checklist

- [ ] All unit tests pass (28/28)
- [ ] TypeScript compilation succeeds (0 errors)
- [ ] E2E tests pass
- [ ] No new console errors or warnings
- [ ] Tested manually with real GitHub OAuth if possible

### CI/CD Pipeline

Tests are automatically run on:
1. **Pull Request Creation** - Run all auth tests
2. **Before Merge** - All tests must pass
3. **After Merge** - Full regression test suite

## Bug Prevention Patterns

### Pattern 1: Type Normalization

**Problem**: Frontend and backend use different type values
**Solution**: Normalize in auth-sync module before sending to backend
**Tests**: 3 unit tests verify all account types are correctly normalized

### Pattern 2: Account Filtering

**Problem**: Wallet accounts were being sent to backend that doesn't expect them
**Solution**: Filter out wallet accounts in `.map()` chain
**Tests**: Existing tests verify wallet accounts are filtered

### Pattern 3: Error Handling

**Problem**: HTTP errors (422, 500, etc.) could crash auth flow
**Solution**: Comprehensive error handling and logging
**Tests**: Tests for each HTTP status code (400, 401, 422, 429, 500)

### Pattern 4: State Persistence

**Problem**: Auth state could be lost on page reload
**Solution**: Persist to localStorage and sessionStorage
**Tests**: E2E tests verify persistence across reloads

## Test Metrics

As of the implementation of this strategy:

| Metric | Value |
|--------|-------|
| Unit Tests | 28 passing |
| E2E Tests | 12 new tests |
| Code Coverage | Account type mapping: 100% |
| TypeScript Errors | 0 |
| Bundle Size Impact | ~0% (tests only) |

## Maintenance Guidelines

### When Adding New Auth Features

1. Add unit tests to `src/integrations/privy/__tests__/auth-sync.test.ts`
2. Add E2E tests to `e2e/auth-account-type-mapping.spec.ts` or new file
3. Ensure all existing tests still pass
4. Update this document with new test categories

### When Fixing Auth Bugs

1. Create a failing test that reproduces the bug
2. Fix the bug to make the test pass
3. Add regression test to prevent future occurrences
4. Document the bug and fix here

### Test Review Checklist

Before approving auth-related PRs:

- [ ] Tests are comprehensive (not just happy path)
- [ ] Tests cover error cases
- [ ] Tests are deterministic (don't depend on timing)
- [ ] Tests have clear descriptions
- [ ] No test flakiness or timeouts
- [ ] Performance impact is acceptable

## Common Issues and Solutions

### Issue: Tests pass locally but fail in CI

**Solution**:
- Tests may be flaky due to timing
- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use reliable selectors with data-testid attributes

### Issue: Auth flow changed but tests didn't update

**Solution**:
- Update tests to match new flow
- Add new tests for new paths
- Ensure backward compatibility

### Issue: Tests are too slow

**Solution**:
- Consolidate related tests
- Use fixtures to pre-setup auth state
- Parallelize E2E tests

## Related Documentation

- `CLAUDE.md` - Main codebase documentation
- `BETA_AUTH_TRANSFER.md` - Session transfer implementation
- `.github/workflows/test.yml` - CI/CD test configuration
- PR #350 - Original GitHub OAuth fix

## Future Improvements

1. **Visual Regression Testing**: Add screenshot tests for auth flows
2. **Performance Testing**: Monitor auth response times
3. **Load Testing**: Verify auth scales during peak usage
4. **Cross-Browser Testing**: Test on multiple browsers and OS
5. **Mobile Testing**: Add mobile-specific auth tests

## Support

For questions about auth tests:
1. Check this document first
2. Review test comments in code
3. Check commit messages for context
4. Ask in #engineering Slack channel
