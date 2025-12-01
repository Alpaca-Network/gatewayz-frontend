describe('Chat Interface Visual Regression', () => {
  beforeEach(() => {
    cy.mockAuth()
    cy.mockModelsAPI()
  })

  it('matches empty chat baseline', () => {
    cy.visit('/chat')
    cy.waitForStable('main, [data-testid="chat-container"]')
    cy.compareSnapshot('chat-empty')
  })

  it('matches chat with messages baseline', () => {
    cy.mockChatAPI('This is a test response from the AI assistant.')

    cy.visit('/chat')
    cy.waitForStable('main')

    // Send a message
    cy.get('textarea, input[type="text"]').first().type('Hello AI{enter}')
    cy.wait('@chatCompletion')

    // Wait for response to appear
    cy.contains('This is a test response', { timeout: 10000 }).should('be.visible')
    cy.wait(500) // Wait for animations

    cy.compareSnapshot('chat-with-messages')
  })

  it('matches chat sidebar baseline', () => {
    cy.visit('/chat')
    cy.waitForStable('aside, [data-testid="chat-sidebar"]', 10000)
    cy.compareSnapshot('chat-sidebar')
  })

  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
  ]

  viewports.forEach(({ name, width, height }) => {
    it(`matches ${name} chat layout`, () => {
      cy.viewport(width, height)
      cy.visit('/chat')
      cy.waitForStable('main')
      cy.compareSnapshot(`chat-${name}`)
    })
  })

  it('matches chat input area baseline', () => {
    cy.visit('/chat')
    cy.waitForStable('textarea, input[type="text"]')
    cy.get('textarea, input[type="text"]').first().scrollIntoView()
    cy.wait(300)
    cy.compareSnapshot('chat-input-area')
  })

  it('matches chat with long message', () => {
    const longMessage = 'This is a very long message that spans multiple lines and tests how the chat interface handles lengthy content. '.repeat(5)
    cy.mockChatAPI(longMessage)

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().type('Long message test{enter}')
    cy.wait('@chatCompletion')

    cy.contains('This is a very long message', { timeout: 10000 }).should('be.visible')
    cy.wait(500)

    cy.compareSnapshot('chat-long-message')
  })

  it('matches chat loading state', () => {
    // Intercept with delay to capture loading state
    cy.intercept('POST', '**/api/chat/completions', (req) => {
      req.reply({
        delay: 2000,
        statusCode: 200,
        body: {
          choices: [{
            message: {
              role: 'assistant',
              content: 'Response',
            },
          }],
        },
      })
    }).as('delayedChat')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().type('Test{enter}')

    // Wait a bit to see loading state
    cy.wait(500)
    cy.compareSnapshot('chat-loading-state')
  })

  it('matches chat error state', () => {
    cy.intercept('POST', '**/api/chat/completions', {
      statusCode: 500,
      body: { error: 'Internal server error' },
    }).as('chatError')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().type('Error test{enter}')
    cy.wait('@chatError')

    // Wait for error message to appear
    cy.wait(1000)
    cy.compareSnapshot('chat-error-state')
  })
})
