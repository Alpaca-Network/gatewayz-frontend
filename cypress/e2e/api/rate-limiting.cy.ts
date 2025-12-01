describe('Rate Limiting API', () => {
  beforeEach(() => {
    cy.mockAuth()
    cy.mockModelsAPI()
  })

  it('handles 429 rate limit error with retry', () => {
    let attempts = 0

    cy.intercept('POST', '**/api/chat/completions', (req) => {
      attempts++
      if (attempts === 1) {
        req.reply({
          statusCode: 429,
          body: {
            error: 'Rate limit exceeded',
            retry_after: 2,
          },
        })
      } else {
        req.reply({
          statusCode: 200,
          body: {
            id: 'chatcmpl-after-retry',
            choices: [{
              message: {
                role: 'assistant',
                content: 'Success after retry',
              },
            }],
          },
        })
      }
    }).as('rateLimitChat')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')
    cy.get('textarea, input[type="text"]').first().type('Test rate limit{enter}')

    // Wait for first rate-limited request
    cy.wait('@rateLimitChat')

    // Should show rate limit message or error
    cy.get('[role="alert"], .toast, [data-testid="error"]').should('exist')

    // Should retry and eventually succeed
    cy.wait('@rateLimitChat')
    cy.contains('Success after retry', { timeout: 10000 }).should('be.visible')
  })

  it('displays rate limit UI indicator', () => {
    cy.intercept('POST', '**/api/chat/completions', {
      statusCode: 429,
      body: {
        error: 'Too many requests',
        message: 'You have exceeded the rate limit',
      },
    }).as('rateLimitError')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')
    cy.get('textarea, input[type="text"]').first().type('Test{enter}')

    cy.wait('@rateLimitError')

    // Should show some form of error notification
    cy.get('body').should('contain.text', 'rate')
      .or('contain.text', 'limit')
      .or('contain.text', 'Too many')
  })

  it('respects retry-after header', () => {
    let requestTimestamps: number[] = []

    cy.intercept('POST', '**/api/chat/completions', (req) => {
      requestTimestamps.push(Date.now())

      if (requestTimestamps.length === 1) {
        req.reply({
          statusCode: 429,
          headers: {
            'retry-after': '2',
          },
          body: { error: 'Rate limit exceeded' },
        })
      } else {
        // Verify that at least 1 second has passed (allowing some margin)
        const timeDiff = requestTimestamps[1] - requestTimestamps[0]
        expect(timeDiff).to.be.greaterThan(1000)

        req.reply({
          statusCode: 200,
          body: {
            choices: [{
              message: {
                role: 'assistant',
                content: 'Success',
              },
            }],
          },
        })
      }
    }).as('retryAfterTest')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')
    cy.get('textarea, input[type="text"]').first().type('Test retry-after{enter}')

    // Wait for both requests
    cy.wait('@retryAfterTest')
    cy.wait('@retryAfterTest', { timeout: 15000 })

    cy.contains('Success', { timeout: 10000 }).should('be.visible')
  })

  it('handles multiple consecutive rate limits', () => {
    let attempts = 0

    cy.intercept('POST', '**/api/chat/completions', (req) => {
      attempts++
      if (attempts <= 2) {
        req.reply({
          statusCode: 429,
          body: { error: `Rate limit ${attempts}` },
        })
      } else {
        req.reply({
          statusCode: 200,
          body: {
            choices: [{
              message: {
                role: 'assistant',
                content: 'Finally succeeded',
              },
            }],
          },
        })
      }
    }).as('multipleRateLimits')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')
    cy.get('textarea, input[type="text"]').first().type('Test multiple limits{enter}')

    // Wait for all attempts
    cy.wait('@multipleRateLimits')
    cy.wait('@multipleRateLimits')
    cy.wait('@multipleRateLimits')

    cy.contains('Finally succeeded', { timeout: 15000 }).should('be.visible')
  })

  it('shows credit exhaustion message for authenticated users', () => {
    cy.mockAuth('basicUser') // Low credit user

    cy.intercept('POST', '**/api/chat/completions', {
      statusCode: 402,
      body: {
        error: 'Insufficient credits',
        credits_remaining: 0,
      },
    }).as('insufficientCredits')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')
    cy.get('textarea, input[type="text"]').first().type('Test credits{enter}')

    cy.wait('@insufficientCredits')

    // Should show credit-related message
    cy.get('body').should('contain.text', 'credit')
      .or('contain.text', 'balance')
      .or('contain.text', 'Insufficient')
  })
})
