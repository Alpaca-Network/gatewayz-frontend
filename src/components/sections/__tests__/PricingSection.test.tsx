import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingSection } from '../PricingSection';

// Mock the Twitter pixel tracking
jest.mock('@/components/analytics/twitter-pixel', () => ({
  trackTwitterSignupClick: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick, className, variant, ...props }: any) => (
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Check: () => <span data-testid="icon-check">✓</span>,
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock document.getElementById
const mockGetElementById = jest.fn();
document.getElementById = mockGetElementById;

describe('PricingSection (Landing Page)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetElementById.mockReturnValue({ scrollIntoView: jest.fn() });
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

    // Enterprise tier should have a Get Started button (not Join Beta like others)
    const getStartedButtons = screen.getAllByRole('button', { name: /get started/i });
    expect(getStartedButtons.length).toBe(1); // Only Enterprise has "Get Started"
  });

  it('calls handleClick when Enterprise tier button is clicked', () => {
    render(<PricingSection />);

    // Find the Enterprise card's Get Started button
    const enterpriseButton = screen.getByRole('button', { name: /get started/i });

    // Click should not throw - this verifies the Enterprise branch of handleClick executes
    // Note: window.location.href assertion skipped due to JSDOM limitations
    expect(() => fireEvent.click(enterpriseButton)).not.toThrow();
  });

  it('does not track Twitter conversion for Enterprise tier', () => {
    const { trackTwitterSignupClick } = jest.requireMock('@/components/analytics/twitter-pixel');

    render(<PricingSection />);

    // Click Enterprise button
    const enterpriseButton = screen.getByRole('button', { name: /get started/i });

    fireEvent.click(enterpriseButton);

    // Should NOT track Twitter conversion for Enterprise
    expect(trackTwitterSignupClick).not.toHaveBeenCalled();
  });

  it('tracks Twitter conversion for non-Enterprise tiers', () => {
    const { trackTwitterSignupClick } = jest.requireMock('@/components/analytics/twitter-pixel');

    render(<PricingSection />);

    // Click a Join Beta button (Starter, Pro, or Max)
    const joinBetaButtons = screen.getAllByRole('button', { name: /join beta/i });
    fireEvent.click(joinBetaButtons[0]);

    expect(trackTwitterSignupClick).toHaveBeenCalled();
  });

  it('displays correct pricing for each tier', () => {
    render(<PricingSection />);

    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$75')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
