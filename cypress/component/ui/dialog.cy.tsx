import React from 'react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

describe('Dialog Component', () => {
  it('renders dialog trigger', () => {
    cy.mount(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    cy.contains('Open Dialog').should('be.visible')
  })

  it('opens dialog on trigger click', () => {
    cy.mount(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description text</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    // Dialog should not be visible initially
    cy.get('[role="dialog"]').should('not.exist')

    // Click trigger to open dialog
    cy.contains('Open').click()

    // Dialog should now be visible
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains('Dialog Title').should('be.visible')
    cy.contains('Dialog description text').should('be.visible')
  })

  it('displays with defaultOpen prop', () => {
    cy.mount(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Default Open Dialog</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    cy.get('[role="dialog"]').should('be.visible')
    cy.contains('Default Open Dialog').should('be.visible')
  })

  it('closes dialog with close button', () => {
    cy.mount(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    cy.get('[role="dialog"]').should('be.visible')

    // Click the X close button
    cy.get('button[aria-label="Close"]').click()

    // Wait for close animation
    cy.wait(300)
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('closes on escape key', () => {
    cy.mount(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    cy.get('[role="dialog"]').should('be.visible')

    // Press Escape key
    cy.get('body').type('{esc}')

    // Wait for close animation
    cy.wait(300)
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('renders with footer', () => {
    cy.mount(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog with Footer</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">Cancel</Button>
            <Button>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

    cy.get('[role="dialog"]').should('be.visible')
    cy.contains('Cancel').should('be.visible')
    cy.contains('Confirm').should('be.visible')
  })

  it('supports controlled open state', () => {
    function ControlledDialog() {
      const [open, setOpen] = React.useState(false)

      return (
        <div>
          <Button onClick={() => setOpen(true)}>Open Controlled</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Controlled Dialog</DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )
    }

    cy.mount(<ControlledDialog />)

    cy.get('[role="dialog"]').should('not.exist')
    cy.contains('Open Controlled').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains('Close').click()
    cy.wait(300)
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('renders overlay', () => {
    cy.mount(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    // Check for overlay element (has data-radix-dialog-overlay attribute)
    cy.get('[data-radix-dialog-overlay]').should('exist').and('be.visible')
  })

  it('contains proper accessibility attributes', () => {
    cy.mount(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accessible Dialog</DialogTitle>
            <DialogDescription>This is a description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    // Check for proper ARIA attributes
    cy.get('[role="dialog"]').should('have.attr', 'aria-describedby')
    cy.get('[role="dialog"]').should('have.attr', 'aria-labelledby')
  })
})
