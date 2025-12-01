describe('Model Cards Visual Regression', () => {
  beforeEach(() => {
    cy.mockAuth()
    cy.mockModelsAPI()
  })

  it('matches models grid baseline', () => {
    cy.visit('/models')
    cy.waitForModels()
    cy.wait(500) // Wait for layout to stabilize
    cy.compareSnapshot('models-grid')
  })

  it('matches model card hover state', () => {
    cy.visit('/models')
    cy.waitForModels()

    // Hover over first model card
    cy.get('[data-testid="model-card"], [role="article"]').first().realHover()
    cy.wait(500) // Wait for hover animation
    cy.compareSnapshot('model-card-hover')
  })

  it('matches models search results', () => {
    cy.intercept('GET', '**/api/models*', {
      statusCode: 200,
      body: {
        models: [
          { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', context: 128000 },
          { id: 'gpt-3.5', name: 'GPT-3.5', provider: 'OpenAI', context: 16000 },
        ],
      },
    }).as('searchResults')

    cy.visit('/models')
    cy.waitForModels()

    // Perform search
    cy.get('input[placeholder*="search"], [data-testid="search"]').type('gpt')
    cy.wait('@searchResults')
    cy.wait(500)

    cy.compareSnapshot('models-search-results')
  })

  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
  ]

  viewports.forEach(({ name, width, height }) => {
    it(`matches ${name} models grid`, () => {
      cy.viewport(width, height)
      cy.visit('/models')
      cy.waitForModels()
      cy.wait(500)
      cy.compareSnapshot(`models-${name}`)
    })
  })

  it('matches models loading state', () => {
    cy.intercept('GET', '**/api/models*', (req) => {
      req.reply({
        delay: 2000,
        statusCode: 200,
        body: { models: [] },
      })
    }).as('delayedModels')

    cy.visit('/models')

    // Capture loading state
    cy.wait(500)
    cy.compareSnapshot('models-loading-state')
  })

  it('matches models empty state', () => {
    cy.intercept('GET', '**/api/models*', {
      statusCode: 200,
      body: { models: [], total: 0 },
    }).as('emptyModels')

    cy.visit('/models')
    cy.wait('@emptyModels')
    cy.wait(1000) // Wait for empty state message

    cy.compareSnapshot('models-empty-state')
  })

  it('matches model detail page', () => {
    cy.intercept('GET', '**/api/models*', {
      statusCode: 200,
      body: {
        models: [
          {
            id: 'gpt-4-turbo',
            name: 'GPT-4 Turbo',
            provider: 'OpenAI',
            context: 128000,
            inputCost: 0.01,
            outputCost: 0.03,
            description: 'Most capable GPT-4 model',
          },
        ],
      },
    }).as('modelDetail')

    cy.visit('/models')
    cy.waitForModels()

    // Click on model card to go to detail page
    cy.contains('GPT-4').first().click()

    // Wait for detail page to load
    cy.wait(1000)
    cy.compareSnapshot('model-detail-page')
  })

  it('matches models filter panel', () => {
    cy.visit('/models')
    cy.waitForModels()

    // Open filter panel if it exists
    cy.get('[data-testid="filter-button"], button:contains("Filter")').then(($btn) => {
      if ($btn.length > 0) {
        cy.wrap($btn).first().click()
        cy.wait(500)
        cy.compareSnapshot('models-filter-panel')
      }
    })
  })

  it('matches models with pricing visible', () => {
    cy.visit('/models')
    cy.waitForModels()

    // Scroll to ensure pricing is visible
    cy.get('[data-testid="model-card"], [role="article"]').first().scrollIntoView()
    cy.wait(300)
    cy.compareSnapshot('models-with-pricing')
  })
})
