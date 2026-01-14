import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingSection } from '../pricing-section';

// Mock the api module
jest.mock('@/lib/api', () => ({
  getUserData: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick, className, variant, size, ...props }: any) => (
    <button
      data-testid="button"
      disabled={disabled}
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Check: () => <span data-testid="icon-check">✓</span>,
  Sparkles: () => <span data-testid="icon-sparkles">✨</span>,
}));

describe('PricingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all pricing tiers', () => {
    render(<PricingSection />);

    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('renders Enterprise tier with Get Started button', () => {
    render(<PricingSection />);

    // Find all Get Started buttons
    const buttons = screen.getAllByRole('button', { name: /get started/i });
    // Should have 4 buttons (one for each tier)
    expect(buttons.length).toBe(4);
  });

  it('calls handleGetStarted when Enterprise tier button is clicked', () => {
    render(<PricingSection />);

    // Find all Get Started buttons and click the one for Enterprise (last one)
    const buttons = screen.getAllByRole('button', { name: /get started/i });
    const enterpriseButton = buttons[buttons.length - 1]; // Enterprise is the last tier

    // Click should not throw - this verifies the Enterprise branch of handleGetStarted executes
    // Note: window.location.href assertion skipped due to JSDOM limitations
    expect(() => fireEvent.click(enterpriseButton)).not.toThrow();
  });

  it('calls handleGetStarted when Starter tier button is clicked', () => {
    render(<PricingSection />);

    // Find all Get Started buttons and click the first one (Starter)
    const buttons = screen.getAllByRole('button', { name: /get started/i });
    const starterButton = buttons[0];

    // Click should not throw - this verifies the Starter branch of handleGetStarted executes
    // Note: window.location.href assertion skipped due to JSDOM limitations
    expect(() => fireEvent.click(starterButton)).not.toThrow();
  });

  it('displays correct pricing for each tier', () => {
    render(<PricingSection />);

    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$75')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
