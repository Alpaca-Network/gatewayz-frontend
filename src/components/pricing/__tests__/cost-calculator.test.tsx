/**
 * Tests for the cost calculator.
 *
 * The number this component shows is the one a visitor decides on, so the tests
 * assert the arithmetic behaves correctly at the boundaries rather than
 * checking that it renders.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { CostCalculator } from '../cost-calculator';

// Claude Sonnet-ish rates, per token.
const INPUT = 0.000003;
const OUTPUT = 0.000015;

function renderCalc(overrides = {}) {
  return render(
    <CostCalculator
      modelId="anthropic/claude-sonnet-4"
      inputPrice={INPUT}
      outputPrice={OUTPUT}
      supportsCaching
      {...overrides}
    />
  );
}

function monthlyText(): string {
  // The headline figure is the first element rendered with the large class.
  const el = document.querySelector('.text-3xl');
  return el?.textContent ?? '';
}

function parseUsd(text: string): number {
  return Number(text.replace(/[$,]/g, ''));
}

describe('CostCalculator', () => {
  it('renders a monthly figure', () => {
    renderCalc();
    expect(monthlyText()).toMatch(/^\$/);
  });

  it('caching lowers the monthly cost', () => {
    renderCalc();
    const withCaching = parseUsd(monthlyText());

    fireEvent.click(screen.getByRole('checkbox'));
    const withoutCaching = parseUsd(monthlyText());

    expect(withoutCaching).toBeGreaterThan(withCaching);
  });

  it('shows the saving explicitly when caching is on', () => {
    renderCalc();
    expect(screen.getByText(/caching saves/i)).toBeInTheDocument();
  });

  it('explains when a model cannot cache instead of silently charging full rate', () => {
    renderCalc({ supportsCaching: false });
    expect(screen.getByText(/does not support prompt caching/i)).toBeInTheDocument();
  });

  it('more sessions costs more', () => {
    renderCalc();
    const before = parseUsd(monthlyText());

    const sessionsInput = screen.getByDisplayValue('15');
    fireEvent.change(sessionsInput, { target: { value: '30' } });

    expect(parseUsd(monthlyText())).toBeGreaterThan(before);
  });

  it('presets change the inputs', () => {
    renderCalc();
    fireEvent.click(screen.getByText(/Heavy/));
    expect(screen.getByDisplayValue('40')).toBeInTheDocument();
  });

  it('clamps sessions to at least one rather than producing zero cost', () => {
    renderCalc();
    const sessionsInput = screen.getByDisplayValue('15');
    fireEvent.change(sessionsInput, { target: { value: '0' } });
    expect(parseUsd(monthlyText())).toBeGreaterThan(0);
  });

  it('zero context still bills output tokens', () => {
    renderCalc();
    const contextInput = screen.getByDisplayValue('20000');
    fireEvent.change(contextInput, { target: { value: '0' } });
    expect(parseUsd(monthlyText())).toBeGreaterThan(0);
  });

  it('states that the figure is an estimate, not a quote', () => {
    renderCalc();
    expect(screen.getByText(/estimate, not a quote/i)).toBeInTheDocument();
  });

  it('discloses the 90% cacheable-prefix assumption', () => {
    // The saving claim depends on this assumption; hiding it would make the
    // number look more certain than it is.
    renderCalc();
    expect(screen.getByText(/90% of your replayed context/i)).toBeInTheDocument();
  });
});
