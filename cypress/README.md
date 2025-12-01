# Cypress Testing Guide

## Overview

This project uses Cypress for **complementary** testing alongside Playwright:
- **Cypress**: Component testing, API edge cases, visual regression
- **Playwright**: Full E2E journeys, real authentication, production APIs
- **Jest**: Unit tests, API routes, pure functions

## Running Tests

### Component Tests
```bash
# Open Cypress UI
pnpm cypress:open

# Run component tests headless
pnpm cypress:component

# Run specific component test
pnpm cypress:component --spec "cypress/component/ui/button.cy.tsx"
```

### E2E Tests
```bash
# Run E2E tests
pnpm cypress:e2e

# Run with visible browser
pnpm cypress:headed

# Run specific E2E test
pnpm cypress:e2e --spec "cypress/e2e/api/chat-streaming.cy.ts"
```

### All Cypress Tests
```bash
pnpm test:cypress
```

## Test Structure

```
cypress/
├── component/          # Component tests
│   ├── ui/             # UI primitives (Button, Dialog, Select)
│   └── chat/           # Chat components
├── e2e/                # E2E tests
│   ├── api/            # API edge cases (streaming, rate limiting, auth errors)
│   └── visual/         # Visual regression (screenshots)
├── support/
│   ├── commands.ts     # Custom commands
│   ├── component.ts    # Component test setup
│   └── e2e.ts          # E2E test setup
└── fixtures/           # Test data (uses /test-fixtures/)
```

## Writing Tests

### Component Testing Pattern
```typescript
import { Component } from '@/components/ui/component'

describe('Component Name', () => {
  it('renders correctly', () => {
    cy.mount(<Component prop="value" />)
    cy.get('[role="button"]').should('exist')
  })

  it('handles interactions', () => {
    const onClickSpy = cy.spy().as('clickSpy')
    cy.mount(<Component onClick={onClickSpy} />)
    cy.get('button').click()
    cy.get('@clickSpy').should('have.been.calledOnce')
  })
})
```

### API Testing Pattern
```typescript
describe('API Test', () => {
  beforeEach(() => {
    cy.mockAuth()
  })

  it('handles API scenario', () => {
    cy.intercept('POST', '**/api/endpoint', {
      statusCode: 200,
      body: { data: 'test' },
    }).as('apiCall')

    cy.visit('/page')
    cy.wait('@apiCall')
    cy.contains('Expected result').should('be.visible')
  })
})
```

### Visual Regression Pattern
```typescript
describe('Visual Test', () => {
  beforeEach(() => {
    cy.mockAuth()
    cy.mockModelsAPI()
  })

  it('matches baseline', () => {
    cy.visit('/page')
    cy.waitForStable('main')
    cy.compareSnapshot('page-name')
  })

  it('matches responsive layouts', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 },
    ]

    viewports.forEach(({ name, width, height }) => {
      cy.viewport(width, height)
      cy.visit('/page')
      cy.waitForStable('main')
      cy.compareSnapshot(`page-${name}`)
    })
  })
})
```

## Custom Commands

### Authentication
```typescript
// Mock authenticated user (Pro tier, 10k credits)
cy.mockAuth('authenticatedUser')

// Mock basic tier user (100 credits)
cy.mockAuth('basicUser')

// Mock max tier user (50k credits)
cy.mockAuth('maxUser')
```

### API Mocking
```typescript
// Mock models API
cy.mockModelsAPI()

// Mock chat API with simple response
cy.mockChatAPI('Hello from AI')

// Mock streaming chat API
cy.mockStreamingChatAPI('Streaming response')
```

### Visual Testing
```typescript
// Take screenshot for visual regression
cy.compareSnapshot('screenshot-name')

// With custom options
cy.compareSnapshot('screenshot-name', {
  capture: 'fullPage',
  overwrite: false,
})
```

### Utilities
```typescript
// Wait for models to load
cy.waitForModels()

// Wait for element to be visible and stable (animations complete)
cy.waitForStable('selector')
```

## Shared Fixtures

Test data is in `/test-fixtures/`:
- `auth.json` - User authentication data (authenticatedUser, basicUser, maxUser)
- `models.json` - Model catalog data
- `chat-messages.json` - Chat message data

Import fixtures in tests:
```typescript
import authFixtures from '../../test-fixtures/auth.json'
import modelsFixtures from '../../test-fixtures/models.json'
```

## Selector Strategy

**Decision Tree**:
1. **Preferred**: Semantic selectors (`[role="button"]`, text content)
   ```typescript
   cy.get('[role="button"]')
   cy.contains('Submit')
   ```

2. **When needed**: `data-testid` attributes
   ```typescript
   cy.get('[data-testid="chat-input"]')
   ```

3. **Avoid**: Brittle CSS classes/IDs that may change

## When to Use Cypress vs Playwright

### Use Cypress for:
✅ Component isolation testing
✅ Fast feedback on UI changes
✅ Visual debugging needed
✅ API mocking edge cases
✅ Visual regression testing

### Use Playwright for:
✅ Full E2E user journeys
✅ Real Privy authentication
✅ Production API testing
✅ Cross-browser testing
✅ Performance metrics

### Use Jest for:
✅ Unit tests (pure functions)
✅ API route testing
✅ Service layer testing
✅ Fastest feedback loop

## CI/CD

Cypress runs in GitHub Actions (`.github/workflows/cypress.yml`):
- **Component tests**: ~5 minutes
- **E2E tests**: ~8 minutes
- **Triggered on**: All PRs and pushes to main

Screenshots and videos are uploaded as artifacts on failure.

## Troubleshooting

### Test Fails Locally but Passes in CI
- Clear Cypress cache: `pnpm cypress cache clear`
- Ensure dev server is running: `pnpm dev`
- Check viewport size matches

### Visual Regression Failures
- Review screenshot diffs in `cypress/screenshots/`
- Update baseline: Delete old screenshot, re-run test
- Check for dynamic content (timestamps, random data)

### Flaky Tests
- Add explicit waits: `cy.wait('@alias')`
- Use `cy.waitForStable()` for animated elements
- Check for race conditions
- Use `cy.intercept` to control API timing

### Component Test Errors
- Ensure all dependencies are mocked (stores, context, etc.)
- Check console for hydration errors
- Verify import paths (`@/` alias works in Cypress config)

## Best Practices

### DO:
✅ Use semantic selectors first
✅ Mock authentication for all tests
✅ Wait for elements to be visible before interacting
✅ Use custom commands for common operations
✅ Write descriptive test names
✅ Clean up after tests (automatically handled by `beforeEach`)

### DON'T:
❌ Use arbitrary waits (`cy.wait(5000)`)
❌ Test implementation details
❌ Duplicate tests between Cypress and Playwright
❌ Ignore flaky tests
❌ Hard-code API responses (use fixtures)

## Examples

### Example 1: Component Test
```typescript
// cypress/component/ui/button.cy.tsx
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('handles click events', () => {
    const onClickSpy = cy.spy().as('clickSpy')
    cy.mount(<Button onClick={onClickSpy}>Click me</Button>)

    cy.get('button').click()
    cy.get('@clickSpy').should('have.been.calledOnce')
  })
})
```

### Example 2: API Test
```typescript
// cypress/e2e/api/chat-streaming.cy.ts
describe('Chat Streaming', () => {
  beforeEach(() => {
    cy.mockAuth()
  })

  it('handles streaming response', () => {
    cy.mockStreamingChatAPI('Hello world')

    cy.visit('/chat')
    cy.get('textarea').first().type('Test{enter}')
    cy.wait('@streamingChat')

    cy.contains('Hello world').should('be.visible')
  })
})
```

### Example 3: Visual Test
```typescript
// cypress/e2e/visual/chat-interface.cy.ts
describe('Chat Interface Visual', () => {
  beforeEach(() => {
    cy.mockAuth()
    cy.mockModelsAPI()
  })

  it('matches chat baseline', () => {
    cy.visit('/chat')
    cy.waitForStable('main')
    cy.compareSnapshot('chat-interface')
  })
})
```

## Configuration

### cypress.config.ts
- Project ID: `jwq6tx` (Cypress Cloud)
- Component tests: Webpack bundler with React 18
- E2E base URL: `http://localhost:3000`
- Retries: 2 in CI, 0 locally
- Timeouts: 10s command, 30s page load

### Environment Variables
- `CYPRESS_PROJECT_ID`: Cypress Cloud project ID
- `CYPRESS_RECORD_KEY`: Recording key (for CI)
- `CYPRESS_baseUrl`: Override base URL

## Resources

- [Cypress Documentation](https://docs.cypress.io)
- [Cypress Component Testing](https://docs.cypress.io/guides/component-testing/overview)
- [Cypress Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Playwright Comparison](../e2e/README.md) (if exists)

## Support

For issues or questions:
1. Check this README first
2. Review existing tests for examples
3. Check Cypress documentation
4. Ask in team chat or create GitHub issue
