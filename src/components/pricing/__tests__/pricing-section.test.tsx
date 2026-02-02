import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingSection } from '../pricing-section';

// Mock the api module
jest.mock('@/lib/api', () => ({
  getUserData: jest.fn().mockReturnValue(null),
}));

// Mock useTier hook
jest.mock('@/hooks/use-tier', () => ({
  useTier: () => ({
    tier: 'basic',
    hasSubscription: false,
    tierInfo: null,
    subscriptionStatusText: null,
    renewalDate: null,
    isTrial: false,
    trialExpired: false,
    trialExpirationDate: null,
    userData: null,
  }),
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

  it('renders pricing tier buttons', () => {
    render(<PricingSection />);

    // For unauthenticated user, buttons should show:
    // - "Get Started" for Starter, Pro, Max
    // - "Contact Sales" for Enterprise
    const getStartedButtons = screen.getAllByRole('button', { name: /get started/i });
    const contactButton = screen.getByRole('button', { name: /contact sales/i });

    // Should have 3 "Get Started" buttons and 1 "Contact Sales"
    expect(getStartedButtons.length).toBe(3);
    expect(contactButton).toBeInTheDocument();
  });

  it('renders Contact Sales button for Enterprise', () => {
    render(<PricingSection />);

    // Find Contact Sales button for Enterprise
    const enterpriseButton = screen.getByRole('button', { name: /contact sales/i });
    expect(enterpriseButton).toBeInTheDocument();
  });

  it('renders Get Started buttons for non-Enterprise tiers', () => {
    render(<PricingSection />);

    // Find all Get Started buttons
    const buttons = screen.getAllByRole('button', { name: /get started/i });

    // Starter, Pro, Max should all have Get Started buttons
    expect(buttons.length).toBe(3);
  });

  it('displays correct pricing for each tier', () => {
    render(<PricingSection />);

    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$8')).toBeInTheDocument();
    expect(screen.getByText('$75')).toBeInTheDocument();
    expect(screen.getByText('$350')).toBeInTheDocument();
  });
});
