/// <reference types="cypress" />
/// <reference types="cypress-real-events" />

// Import shared fixtures
import authFixtures from '../../test-fixtures/auth.json'
import modelsFixtures from '../../test-fixtures/models.json'

// Mock authentication
Cypress.Commands.add('mockAuth', (userType: 'authenticatedUser' | 'basicUser' | 'maxUser' = 'authenticatedUser') => {
  const userData = authFixtures[userType]

  cy.window().then((win) => {
    win.localStorage.setItem('gatewayz_api_key', userData.api_key)
    win.localStorage.setItem('gatewayz_user_data', JSON.stringify(userData))
  })
})

// Mock models API
Cypress.Commands.add('mockModelsAPI', () => {
  cy.intercept('GET', '**/api/models*', {
    statusCode: 200,
    body: modelsFixtures,
  }).as('getModels')
})

// Mock chat API with simple response
Cypress.Commands.add('mockChatAPI', (response: string = 'Test response from assistant') => {
  cy.intercept('POST', '**/api/chat/completions', {
    statusCode: 200,
    body: {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4-turbo',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    },
  }).as('chatCompletion')
})

// Mock streaming chat API
Cypress.Commands.add('mockStreamingChatAPI', (response: string = 'Streaming response') => {
  cy.intercept('POST', '**/api/chat/completions', (req) => {
    const isStreaming = req.body.stream === true

    if (isStreaming) {
      req.reply({
        statusCode: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
        },
        body: `data: {"choices":[{"delta":{"content":"${response}"}}]}\n\ndata: [DONE]\n\n`,
      })
    } else {
      req.reply({
        statusCode: 200,
        body: {
          id: 'chatcmpl-test',
          choices: [{
            message: {
              role: 'assistant',
              content: response,
            },
          }],
        },
      })
    }
  }).as('streamingChat')
})

// Visual regression helper
Cypress.Commands.add('compareSnapshot', (name: string, options?: Partial<Cypress.ScreenshotOptions>) => {
  cy.screenshot(name, {
    capture: 'viewport',
    overwrite: false,
    ...options,
  })
})

// Wait for models to load (common pattern)
Cypress.Commands.add('waitForModels', (timeout: number = 10000) => {
  cy.get('[data-testid="model-card"], [role="article"]', { timeout }).should('exist')
})

// Wait for element to be visible and stable
Cypress.Commands.add('waitForStable', (selector: string, timeout: number = 5000) => {
  cy.get(selector, { timeout }).should('be.visible')
  cy.wait(300) // Wait for animations to complete
})

// Custom OR command for conditional assertions
Cypress.Commands.add(
  'or',
  { prevSubject: true },
  (subject, ...selectors: string[]) => {
    const matchedSelectors = []

    // Find the element from the current subject
    const $element = subject

    // Check each selector to see if it matches
    for (const selector of selectors) {
      if ($element.is(selector) || $element.find(selector).length > 0) {
        matchedSelectors.push(selector)
      }
    }

    // If at least one selector matched, return the subject
    // Otherwise fail the assertion
    if (matchedSelectors.length > 0) {
      return cy.wrap($element)
    } else {
      throw new Error(`Expected element to match one of: ${selectors.join(', ')}`)
    }
  }
)

// TypeScript declarations
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Mock authentication with a test user
       * @param userType - Type of user to mock (authenticatedUser, basicUser, maxUser)
       * @example cy.mockAuth('authenticatedUser')
       */
      mockAuth(userType?: 'authenticatedUser' | 'basicUser' | 'maxUser'): Chainable<void>

      /**
       * Mock the models API endpoint
       * @example cy.mockModelsAPI()
       */
      mockModelsAPI(): Chainable<void>

      /**
       * Mock the chat completions API endpoint
       * @param response - Response content to return
       * @example cy.mockChatAPI('Hello from AI')
       */
      mockChatAPI(response?: string): Chainable<void>

      /**
       * Mock streaming chat completions API
       * @param response - Response content to stream
       * @example cy.mockStreamingChatAPI('Streaming response')
       */
      mockStreamingChatAPI(response?: string): Chainable<void>

      /**
       * Take a screenshot for visual regression testing
       * @param name - Name for the screenshot
       * @param options - Screenshot options
       * @example cy.compareSnapshot('homepage')
       */
      compareSnapshot(name: string, options?: Partial<ScreenshotOptions>): Chainable<void>

      /**
       * Wait for models to load on the page
       * @param timeout - Timeout in milliseconds
       * @example cy.waitForModels(10000)
       */
      waitForModels(timeout?: number): Chainable<void>

      /**
       * Wait for element to be visible and stable (animations complete)
       * @param selector - CSS selector
       * @param timeout - Timeout in milliseconds
       * @example cy.waitForStable('[data-testid="modal"]')
       */
      waitForStable(selector: string, timeout?: number): Chainable<void>

      /**
       * Check if current subject matches any of the provided selectors
       * @param selectors - CSS selectors to check against
       * @example cy.get('body').or('.error', '.warning')
       */
      or(...selectors: string[]): Chainable<JQuery<HTMLElement>>
    }
  }
}

export {}
