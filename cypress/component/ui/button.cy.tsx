import React from 'react'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'outline-gradient'] as const
  const sizes = ['default', 'sm', 'lg', 'icon'] as const

  it('renders with default variant', () => {
    cy.mount(<Button>Click me</Button>)
    cy.get('button').should('have.text', 'Click me')
    cy.get('button').should('be.visible')
  })

  it('supports all variants', () => {
    variants.forEach((variant) => {
      cy.mount(<Button variant={variant}>{variant}</Button>)
      cy.get('button').should('exist').and('contain', variant)
    })
  })

  it('supports all sizes', () => {
    sizes.forEach((size) => {
      cy.mount(<Button size={size}>Size {size}</Button>)
      cy.get('button').should('exist')
    })
  })

  it('handles click events', () => {
    const onClickSpy = cy.spy().as('clickSpy')
    cy.mount(<Button onClick={onClickSpy}>Click</Button>)

    cy.get('button').click()
    cy.get('@clickSpy').should('have.been.calledOnce')
  })

  it('can be disabled', () => {
    cy.mount(<Button disabled>Disabled Button</Button>)
    cy.get('button').should('be.disabled')
  })

  it('supports custom className', () => {
    cy.mount(<Button className="custom-class">Custom</Button>)
    cy.get('button').should('have.class', 'custom-class')
  })

  it('renders as child component when asChild is true', () => {
    cy.mount(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    cy.get('a').should('exist').and('have.text', 'Link Button')
    cy.get('a').should('have.attr', 'href', '/test')
  })

  it('supports type attribute', () => {
    cy.mount(<Button type="submit">Submit</Button>)
    cy.get('button').should('have.attr', 'type', 'submit')
  })

  it('applies correct default styles', () => {
    cy.mount(<Button>Default</Button>)
    cy.get('button').should('have.class', 'inline-flex')
    cy.get('button').should('have.class', 'items-center')
    cy.get('button').should('have.class', 'justify-center')
  })

  it('combines variant and size correctly', () => {
    cy.mount(<Button variant="outline" size="lg">Large Outline</Button>)
    cy.get('button').should('exist').and('contain', 'Large Outline')
  })
})
