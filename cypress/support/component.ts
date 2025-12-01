import { mount } from '@cypress/react18'
import './commands'
import '../../src/app/globals.css'

// Augment the Cypress namespace to include type definitions for
// your custom command.
// Alternatively, can be defined in cypress/support/component.d.ts
// with a <reference path="./component" /> at the top of your spec.
Cypress.Commands.add('mount', mount)

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

// Disable Cypress's default screenshot behavior in component tests
// since we handle it manually with cy.compareSnapshot
Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
})
