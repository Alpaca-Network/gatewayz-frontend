import React from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'

describe('Select Component', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ]

  it('renders select trigger', () => {
    cy.mount(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )

    cy.contains('Select option').should('be.visible')
  })

  it('opens dropdown on click', () => {
    cy.mount(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )

    // Initially no options visible
    cy.get('[role="option"]').should('not.exist')

    // Click trigger to open
    cy.get('button[aria-haspopup="listbox"]').click()

    // Options should now be visible
    cy.get('[role="option"]').should('have.length', 3)
    cy.contains('Option 1').should('be.visible')
  })

  it('selects option and updates value', () => {
    const onValueChangeSpy = cy.spy().as('valueChangeSpy')

    cy.mount(
      <Select onValueChange={onValueChangeSpy}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )

    cy.get('button[aria-haspopup="listbox"]').click()
    cy.contains('Option 2').click()
    cy.get('@valueChangeSpy').should('have.been.calledWith', 'option2')
  })

  it('displays selected value', () => {
    cy.mount(
      <Select defaultValue="option2">
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )

    // Selected value should be displayed
    cy.contains('Option 2').should('be.visible')
  })

  it('supports disabled state', () => {
    cy.mount(
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )

    cy.get('button[aria-haspopup="listbox"]').should('be.disabled')
  })

  it('supports disabled items', () => {
    cy.mount(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2" disabled>
            Option 2 (Disabled)
          </SelectItem>
          <SelectItem value="option3">Option 3</SelectItem>
        </SelectContent>
      </Select>
    )

    cy.get('button[aria-haspopup="listbox"]').click()

    // Find disabled option and check it has disabled attribute
    cy.contains('Option 2 (Disabled)')
      .parent('[role="option"]')
      .should('have.attr', 'data-disabled')
  })

  it('renders with select groups', () => {
    cy.mount(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group 1</SelectLabel>
            <SelectItem value="1a">Item 1A</SelectItem>
            <SelectItem value="1b">Item 1B</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Group 2</SelectLabel>
            <SelectItem value="2a">Item 2A</SelectItem>
            <SelectItem value="2b">Item 2B</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )

    cy.get('button[aria-haspopup="listbox"]').click()
    cy.contains('Group 1').should('be.visible')
    cy.contains('Group 2').should('be.visible')
    cy.contains('Item 1A').should('be.visible')
    cy.contains('Item 2A').should('be.visible')
  })

  it('closes on selection', () => {
    cy.mount(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )

    cy.get('button[aria-haspopup="listbox"]').click()
    cy.get('[role="option"]').should('be.visible')

    cy.contains('Option 1').click()

    // Dropdown should close
    cy.wait(300)
    cy.get('[role="option"]').should('not.exist')
  })

  it('supports controlled value', () => {
    function ControlledSelect() {
      const [value, setValue] = React.useState('option1')

      return (
        <div>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div data-testid="selected-value">{value}</div>
        </div>
      )
    }

    cy.mount(<ControlledSelect />)

    cy.get('[data-testid="selected-value"]').should('have.text', 'option1')
    cy.contains('Option 1').should('be.visible')

    cy.get('button[aria-haspopup="listbox"]').click()
    cy.contains('Option 3').click()

    cy.get('[data-testid="selected-value"]').should('have.text', 'option3')
  })
})
