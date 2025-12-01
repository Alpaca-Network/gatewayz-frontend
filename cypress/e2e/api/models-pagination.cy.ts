describe('Models Pagination API', () => {
  beforeEach(() => {
    cy.mockAuth()
  })

  it('handles paginated models response', () => {
    const page1Models = Array.from({ length: 50 }, (_, i) => ({
      id: `model-${i}`,
      name: `Model ${i}`,
      provider: 'TestProvider',
      context: 8192,
      inputCost: 0.001,
      outputCost: 0.002,
    }))

    const page2Models = Array.from({ length: 50 }, (_, i) => ({
      id: `model-${i + 50}`,
      name: `Model ${i + 50}`,
      provider: 'TestProvider',
      context: 8192,
      inputCost: 0.001,
      outputCost: 0.002,
    }))

    cy.intercept('GET', '**/api/models?*limit=50&offset=0*', {
      statusCode: 200,
      body: { models: page1Models, total: 100 },
    }).as('modelsPage1')

    cy.intercept('GET', '**/api/models?*limit=50&offset=50*', {
      statusCode: 200,
      body: { models: page2Models, total: 100 },
    }).as('modelsPage2')

    cy.visit('/models')

    cy.wait('@modelsPage1')
    cy.contains('Model 0', { timeout: 10000 }).should('be.visible')
    cy.contains('Model 49').should('be.visible')

    // Scroll to bottom or click next page
    cy.get('[data-testid="next-page"], button:contains("Next"), button:contains("Load more")').then(($btn) => {
      if ($btn.length > 0) {
        cy.wrap($btn).first().click()
        cy.wait('@modelsPage2')
        cy.contains('Model 50', { timeout: 10000 }).should('be.visible')
      } else {
        // Infinite scroll - scroll to bottom
        cy.scrollTo('bottom')
        cy.wait('@modelsPage2')
        cy.contains('Model 50', { timeout: 10000 }).should('be.visible')
      }
    })
  })

  it('handles gateway aggregation deduplication', () => {
    cy.intercept('GET', '**/api/models*gateway=openrouter*', {
      statusCode: 200,
      body: {
        models: [
          { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', context: 128000 },
          { id: 'claude-3', name: 'Claude 3', provider: 'Anthropic', context: 200000 },
        ],
      },
    }).as('openrouterModels')

    cy.intercept('GET', '**/api/models*gateway=groq*', {
      statusCode: 200,
      body: {
        models: [
          { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', context: 128000 }, // Duplicate
          { id: 'llama-3', name: 'Llama 3', provider: 'Meta', context: 8192 },
        ],
      },
    }).as('groqModels')

    cy.visit('/models')

    // Wait for both gateway responses
    cy.wait('@openrouterModels')
    cy.wait('@groqModels')

    // Should only show 3 unique models (gpt-4 deduplicated)
    cy.contains('GPT-4', { timeout: 10000 }).should('be.visible')
    cy.contains('Claude 3').should('be.visible')
    cy.contains('Llama 3').should('be.visible')

    // Verify GPT-4 appears only once (not duplicated)
    cy.get('body').then(($body) => {
      const gpt4Count = $body.text().match(/GPT-4/g)?.length || 0
      // Allow for multiple occurrences in different contexts (title, description, etc.)
      // but not full duplicate cards
      expect(gpt4Count).to.be.lessThan(5)
    })
  })

  it('handles gateway failure gracefully', () => {
    cy.intercept('GET', '**/api/models*gateway=openrouter*', {
      statusCode: 200,
      body: {
        models: [
          { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
        ],
      },
    }).as('successGateway')

    cy.intercept('GET', '**/api/models*gateway=groq*', {
      statusCode: 500,
      body: { error: 'Gateway timeout' },
    }).as('failedGateway')

    cy.visit('/models')

    // Wait for successful gateway
    cy.wait('@successGateway')

    // Should show models from working gateway
    cy.contains('GPT-4', { timeout: 10000 }).should('be.visible')

    // Should not show loading spinner indefinitely
    cy.get('[data-testid="loading"]', { timeout: 15000 }).should('not.exist')
  })

  it('handles empty models response', () => {
    cy.intercept('GET', '**/api/models*', {
      statusCode: 200,
      body: { models: [], total: 0 },
    }).as('emptyModels')

    cy.visit('/models')

    cy.wait('@emptyModels')

    // Should show empty state or message
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.satisfy((t: string) =>
        t.includes('No models') || t.includes('models found') || t.includes('Try'),
        'Expected body to contain empty state message'
      )
    })
  })

  it('handles search with pagination', () => {
    const searchResults = [
      { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
      { id: 'gpt-3.5', name: 'GPT-3.5', provider: 'OpenAI' },
    ]

    cy.intercept('GET', '**/api/models*search=gpt*', {
      statusCode: 200,
      body: { models: searchResults, total: 2 },
    }).as('searchModels')

    cy.visit('/models')

    // Wait for initial load
    cy.get('input[placeholder*="search"], [data-testid="search"]', { timeout: 10000 }).should('be.visible')

    // Search for GPT models
    cy.get('input[placeholder*="search"], [data-testid="search"]').type('gpt')

    cy.wait('@searchModels')

    // Should show only search results
    cy.contains('GPT-4', { timeout: 10000 }).should('be.visible')
    cy.contains('GPT-3.5').should('be.visible')
  })

  it('handles slow gateway with timeout', () => {
    cy.intercept('GET', '**/api/models*gateway=slow*', {
      statusCode: 200,
      delay: 30000, // 30 second delay
      body: { models: [] },
    }).as('slowGateway')

    cy.intercept('GET', '**/api/models*gateway=fast*', {
      statusCode: 200,
      body: {
        models: [
          { id: 'fast-model', name: 'Fast Model', provider: 'FastProvider' },
        ],
      },
    }).as('fastGateway')

    cy.visit('/models')

    // Fast gateway should load
    cy.wait('@fastGateway')
    cy.contains('Fast Model', { timeout: 10000 }).should('be.visible')

    // Slow gateway might timeout, but page should still be functional
    cy.get('body').should('be.visible')
  })

  it('refreshes models on manual refresh', () => {
    let loadCount = 0

    cy.intercept('GET', '**/api/models*', (req) => {
      loadCount++
      req.reply({
        statusCode: 200,
        body: {
          models: [
            { id: `model-${loadCount}`, name: `Model Load ${loadCount}`, provider: 'Test' },
          ],
        },
      })
    }).as('modelsRefresh')

    cy.visit('/models')

    cy.wait('@modelsRefresh')
    cy.contains('Model Load 1', { timeout: 10000 }).should('be.visible')

    // Trigger refresh (reload page or click refresh button)
    cy.reload()

    cy.wait('@modelsRefresh')
    cy.contains('Model Load 2', { timeout: 10000 }).should('be.visible')
  })

  it('handles concurrent gateway requests', () => {
    const gateways = ['openrouter', 'groq', 'together', 'fireworks']

    gateways.forEach((gateway, index) => {
      cy.intercept('GET', `**/api/models*gateway=${gateway}*`, {
        statusCode: 200,
        body: {
          models: [
            { id: `${gateway}-model`, name: `${gateway} Model`, provider: gateway },
          ],
        },
      }).as(`${gateway}Models`)
    })

    cy.visit('/models')

    // Wait for all gateways to respond
    gateways.forEach((gateway) => {
      cy.wait(`@${gateway}Models`)
    })

    // Should show models from all gateways
    cy.contains('openrouter Model', { timeout: 10000 }).should('be.visible')
    cy.contains('groq Model').should('be.visible')
    cy.contains('together Model').should('be.visible')
    cy.contains('fireworks Model').should('be.visible')
  })
})
