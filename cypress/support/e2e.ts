// Import commands
import './commands'

// Global before hook to ensure clean state
beforeEach(() => {
  // Clear localStorage and sessionStorage before each test
  cy.clearLocalStorage()
  cy.clearAllSessionStorage()
})

// Cypress global configuration for E2E tests
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  // on certain expected errors (e.g., hydration warnings in dev mode)

  // Don't fail on hydration errors in development
  if (err.message.includes('Hydration')) {
    return false
  }

  // Don't fail on PostHog/Analytics errors
  if (err.message.includes('posthog') || err.message.includes('analytics')) {
    return false
  }

  // We still want to fail on other errors
  return true
})

// Add custom logging for debugging
Cypress.on('fail', (error, runnable) => {
  // Log additional context when tests fail
  cy.log('Test failed:', runnable.title)
  cy.log('Error:', error.message)
  throw error
})
