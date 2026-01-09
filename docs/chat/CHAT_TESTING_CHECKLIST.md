# Chat Testing Maintenance Checklist

Use this checklist to maintain, extend, and debug chat tests over time.

## Pre-Development

- [ ] Pull latest changes from main branch
- [ ] Run `pnpm install` to update dependencies
- [ ] Verify Playwright is installed: `pnpm list @playwright/test`
- [ ] Check playwright.config.ts is present

## During Development

### When Adding New Chat Features

- [ ] Identify what user action to test
- [ ] Choose correct test file:
  - [ ] Core feature → `chat.spec.ts`
  - [ ] Advanced/edge case → `chat-advanced.spec.ts`
  - [ ] Major feature → Create new file
- [ ] Use test template from `chat-test-examples.spec.ts`
- [ ] Write test with setup, act, assert pattern
- [ ] Use semantic selectors (role, text, aria-label)
- [ ] Include `test.beforeEach()` for setup
- [ ] Mock authentication with `setupMockAuth()`
- [ ] Run test locally: `pnpm test:e2e:ui -g "test name"`
- [ ] Verify test passes
- [ ] Check test coverage in test report

### When Modifying Chat UI

- [ ] Update element selectors in affected tests
- [ ] Run affected test suite: `pnpm test:e2e -g "Feature Name"`
- [ ] Update mock data if API contract changed
- [ ] Verify all tests still pass
- [ ] Update documentation if behavior changed

### When Changing Chat API

- [ ] Update mock responses in tests
- [ ] Update expected API endpoints
- [ ] Verify error handling tests
- [ ] Test rate limiting scenarios
- [ ] Check timeout handling

## Before Committing

- [ ] Run all chat tests: `pnpm test:e2e -g "Chat"`
- [ ] Run all E2E tests: `pnpm test:e2e`
- [ ] Check for console errors: Look for `[error]` in logs
- [ ] Verify no test.only() left in code
- [ ] Verify no test.skip() unless documented
- [ ] Run typecheck: `pnpm typecheck`
- [ ] Run linter: `pnpm lint`

## Pull Request Checklist

- [ ] All tests pass locally
- [ ] Added tests for new functionality
- [ ] Updated tests for changed functionality
- [ ] All tests documented clearly
- [ ] No flaky/intermittent tests
- [ ] Code follows patterns from chat-test-examples.spec.ts
- [ ] Selectors are semantic and robust
- [ ] No hardcoded timeouts (use wait conditions)
- [ ] Error handling tested
- [ ] Accessibility considered

## When Tests Fail Locally

### Step 1: Reproduce
- [ ] Run the specific test: `pnpm test:e2e:ui -g "test name"`
- [ ] Note error message
- [ ] Check if test is marked as `test.skip` or `test.only`

### Step 2: Investigate
- [ ] Open UI mode and step through test
- [ ] Check element selectors: `pnpm test:e2e:ui`
- [ ] Look for element count: Run debug and log selector matches
- [ ] Verify auth setup in beforeEach
- [ ] Check page navigation URL
- [ ] Look at network requests in Playwright Inspector

### Step 3: Fix
- [ ] Update selector if element changed
- [ ] Fix auth setup if missing
- [ ] Update API mock if endpoint changed
- [ ] Add proper wait condition
- [ ] Increase timeout if needed
- [ ] Mock missing API if needed

### Step 4: Verify
- [ ] Test passes: `pnpm test:e2e -g "fixed test"`
- [ ] Related tests still pass
- [ ] No other tests broken

## When Tests Fail on CI

### GitHub Actions Failure

- [ ] Click on failed test run
- [ ] Read error message in "Playwright test" step
- [ ] Download artifacts:
  - [ ] Screenshots: `test-results/**/test-failed-1.png`
  - [ ] Videos: `test-results/**/test-failed-1.webm`
  - [ ] Traces: `test-results/**/trace.zip`

### Common CI Issues

- [ ] **Timeout:** Increase timeout or improve wait conditions
- [ ] **Element not found:** Selector might be fragile, make more robust
- [ ] **Auth failure:** Verify setupMockAuth() is called
- [ ] **Network issue:** Mock API endpoint
- [ ] **Flaky test:** Add proper wait conditions, increase timeout

### Fix & Re-run

- [ ] Make code changes locally
- [ ] Run tests locally: `pnpm test:e2e`
- [ ] Push to branch
- [ ] Check CI passes
- [ ] Merge when green

## Regular Maintenance (Weekly)

- [ ] Check for any skipped tests: `grep -r "test.skip" e2e/`
- [ ] Review test report for failures
- [ ] Check for flaky tests (pass-fail-pass)
- [ ] Review any console errors in test logs
- [ ] Update selectors if UI changed
- [ ] Check Playwright updates available

## Regular Maintenance (Monthly)

- [ ] Review all test coverage
- [ ] Identify untested features
- [ ] Check for deprecated test patterns
- [ ] Update documentation if needed
- [ ] Review performance metrics
- [ ] Plan new tests for upcoming features

## Documentation Updates

When to update documentation:

- [ ] New test file created
  - [ ] Add to PLAYWRIGHT_CHAT_TESTING.md
  - [ ] Update summary in CHAT_TESTING_SUMMARY.md

- [ ] New test pattern discovered
  - [ ] Add example to chat-test-examples.spec.ts
  - [ ] Document in PLAYWRIGHT_CHAT_TESTING.md

- [ ] Process or tool changed
  - [ ] Update CHAT_TESTING_QUICK_START.md
  - [ ] Update relevant guide

- [ ] Best practice identified
  - [ ] Add to PLAYWRIGHT_CHAT_TESTING.md best practices
  - [ ] Update pattern examples

## Performance Monitoring

- [ ] Check test execution time: `pnpm test:e2e -g "Chat" --reporter=json`
- [ ] Monitor for slow tests (>30s)
- [ ] Identify unnecessary waits
- [ ] Optimize API mocks
- [ ] Review browser resource usage

### If Tests Are Slow

- [ ] Profile with UI mode: `pnpm test:e2e:ui`
- [ ] Check for arbitrary timeouts
- [ ] Use proper wait conditions
- [ ] Mock external APIs
- [ ] Reduce test count if needed

## Debugging Toolkit

### Quick Debug Commands

```bash
# Run with UI (best for debugging)
pnpm test:e2e:ui -g "test name"

# Debug mode (step through)
pnpm test:e2e:debug -g "test name"

# Run headed (see browser)
pnpm test:e2e:headed -g "test name"

# View test report
npx playwright show-report

# List all tests
pnpm test:e2e --list

# Run with verbose output
pnpm test:e2e -g "Chat" --reporter=verbose
```

### Debug Code Patterns

```typescript
// Pause execution
await page.pause();

// Log element count
console.log(await element.count());

// Log text content
console.log(await element.innerText());

// Log page URL
console.log(page.url());

// List all matching elements
for (let i = 0; i < await elements.count(); i++) {
  console.log(await elements.nth(i).innerText());
}
```

## Test Data Management

- [ ] Keep test data realistic
- [ ] Update mock responses when API changes
- [ ] Verify localStorage test data
- [ ] Check session persistence
- [ ] Review cookie handling

## Accessibility Compliance

When adding tests:
- [ ] Verify semantic HTML structure
- [ ] Check ARIA labels present
- [ ] Test keyboard navigation
- [ ] Verify focus management
- [ ] Test screen reader compatibility

## Browser Coverage

Currently testing:
- [ ] Chromium ✓

Consider adding:
- [ ] Firefox (uncomment in playwright.config.ts)
- [ ] WebKit/Safari (uncomment in playwright.config.ts)

## Device Coverage

Currently testing viewports:
- [ ] Desktop (1920x1080) ✓
- [ ] Tablet (768x1024) ✓
- [ ] Mobile (375x667) ✓

## Integration Checklist

### With GitHub Actions CI

- [ ] Tests run automatically on PR
- [ ] Failures block merge
- [ ] Reports available in Actions tab
- [ ] Artifacts downloadable
- [ ] Retry logic working

### With Next.js Development Server

- [ ] Server starts before tests
- [ ] Server runs on localhost:3000
- [ ] Baseurl configured in playwright.config.ts
- [ ] Hot reload works during development

### With Version Control

- [ ] Test files in git
- [ ] Documentation in git
- [ ] No local-only test ignores
- [ ] CI configuration tracked

## Cleanup & Housekeeping

- [ ] Remove old test reports: `rm -rf playwright-report`
- [ ] Clear test results: `rm -rf test-results`
- [ ] Remove unused test files
- [ ] Archive outdated documentation
- [ ] Update file timestamps

## Rollback Procedures

If tests become unmanageable:

1. **Identify problem:**
   - [ ] Which tests are failing?
   - [ ] When did it start?
   - [ ] What changed?

2. **Restore working state:**
   - [ ] Check git history: `git log --oneline e2e/`
   - [ ] Restore previous version: `git checkout [hash] e2e/chat.spec.ts`
   - [ ] Test if working: `pnpm test:e2e`

3. **Gradual improvement:**
   - [ ] Keep tests passing
   - [ ] Add improvements incrementally
   - [ ] Monitor for regressions

## Knowledge Base

### Common Selectors
```typescript
page.locator('button').filter({ hasText: /send/i })
page.locator('[role="button"]')
page.locator('textarea, input[type="text"]').first()
page.locator('[aria-label="Send"]')
```

### Common Assertions
```typescript
await expect(element).toBeVisible()
await expect(page).toHaveURL(/\/chat/)
expect(value).toBe('expected')
```

### Common Waits
```typescript
await page.waitForLoadState('networkidle')
await expect(element).toBeVisible({ timeout: 5000 })
```

## Resources & Links

- **Main Guide:** `PLAYWRIGHT_CHAT_TESTING.md`
- **Quick Reference:** `CHAT_TESTING_QUICK_START.md`
- **Examples:** `e2e/chat-test-examples.spec.ts`
- **Summary:** `CHAT_TESTING_SUMMARY.md`
- **Playwright Docs:** https://playwright.dev
- **GitHub Actions:** Check repo Actions tab

## Questions & Support

### Where to find help:

1. Check documentation:
   - [ ] PLAYWRIGHT_CHAT_TESTING.md
   - [ ] CHAT_TESTING_QUICK_START.md
   - [ ] chat-test-examples.spec.ts

2. Use debugging tools:
   - [ ] `pnpm test:e2e:ui -g "test name"`
   - [ ] `npx playwright show-report`
   - [ ] Check Screenshots/videos

3. Review existing tests as examples

4. Check Playwright documentation

---

## Checklist Summary

Use this before each task:

| Task | Checklist |
|------|-----------|
| Add new test | Setup, Act, Assert pattern ✓ Mock auth ✓ Semantic selectors ✓ Test locally ✓ |
| Fix failing test | Reproduce ✓ Investigate ✓ Fix ✓ Verify ✓ |
| Modify feature | Update selectors ✓ Run tests ✓ Verify all pass ✓ |
| Pre-commit | All tests pass ✓ No console errors ✓ Typecheck ✓ Lint ✓ |
| CI failure | Download artifacts ✓ Reproduce locally ✓ Fix ✓ Verify ✓ |

---

**Last Updated:** 2024
**Maintained By:** Development Team
**Test Suite:** Chat Functionality
**Status:** Active
