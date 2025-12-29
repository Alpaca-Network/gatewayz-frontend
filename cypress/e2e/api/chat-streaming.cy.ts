describe('Chat Streaming API', () => {
  beforeEach(() => {
    cy.mockAuth()
    cy.mockModelsAPI()
  })

  it('handles streaming response', () => {
    cy.mockStreamingChatAPI('Hello world from streaming')

    cy.visit('/chat')

    // Wait for page to load
    cy.get('textarea, input[type="text"]').first().should('be.visible')

    // Type and send message
    cy.get('textarea, input[type="text"]').first().type('Test streaming{enter}')

    // Wait for streaming response
    cy.wait('@streamingChat')

    // Response should appear in chat
    cy.contains('Hello world from streaming', { timeout: 10000 }).should('be.visible')
  })

  it('handles interrupted stream with retry', () => {
    let streamInterrupted = false

    cy.intercept('POST', '**/api/chat/completions', (req) => {
      if (!streamInterrupted) {
        streamInterrupted = true
        req.reply({
          statusCode: 500,
          body: { error: 'Stream interrupted' },
        })
      } else {
        req.reply({
          statusCode: 200,
          body: {
            id: 'chatcmpl-retry',
            choices: [{
              message: {
                role: 'assistant',
                content: 'Retry successful',
              },
            }],
          },
        })
      }
    }).as('interruptedStream')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')
    cy.get('textarea, input[type="text"]').first().type('Test interruption{enter}')

    // Wait for first failed attempt
    cy.wait('@interruptedStream')

    // Should eventually show success after retry
    cy.contains('Retry successful', { timeout: 15000 }).should('be.visible')
  })

  it('handles empty streaming response gracefully', () => {
    cy.intercept('POST', '**/api/chat/completions', {
      statusCode: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: 'data: [DONE]\n\n',
    }).as('emptyStream')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')
    cy.get('textarea, input[type="text"]').first().type('Empty test{enter}')

    cy.wait('@emptyStream')

    // Should handle gracefully without crashing
    cy.get('textarea, input[type="text"]').first().should('be.visible')
  })

  it('displays streaming chunks progressively', () => {
    cy.intercept('POST', '**/api/chat/completions', (req) => {
      req.reply({
        statusCode: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: {"choices":[{"delta":{"content":"!"}}]}\n\ndata: [DONE]\n\n',
      })
    }).as('chunkedStream')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')
    cy.get('textarea, input[type="text"]').first().type('Test chunks{enter}')

    cy.wait('@chunkedStream')

    // Final combined message should appear
    cy.contains('Hello world!', { timeout: 10000 }).should('be.visible')
  })

  it('handles concurrent streaming requests', () => {
    let requestCount = 0
    cy.intercept('POST', '**/api/chat/completions', (req) => {
      requestCount++
      req.reply({
        statusCode: 200,
        body: {
          id: `chatcmpl-${requestCount}`,
          choices: [{
            message: {
              role: 'assistant',
              content: `Response ${requestCount}`,
            },
          }],
        },
      })
    }).as('concurrentChat')

    cy.visit('/chat')
    cy.get('textarea, input[type="text"]').first().should('be.visible')

    // Send first message
    cy.get('textarea, input[type="text"]').first().type('First message{enter}')
    cy.wait('@concurrentChat')
    cy.contains('Response 1', { timeout: 10000 }).should('be.visible')

    // Send second message
    cy.get('textarea, input[type="text"]').first().type('Second message{enter}')
    cy.wait('@concurrentChat')
    cy.contains('Response 2', { timeout: 10000 }).should('be.visible')
  })
})
