import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CheckoutPage from '../page';

// Mock next/navigation for credit package with discount
const mockBack = jest.fn();
const mockPush = jest.fn();

let mockSearchParams: Record<string, string> = {
  package: 'tier1',
  mode: 'credits',
};

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams[key] || null,
  }),
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h2 data-testid="card-title" className={className}>{children}</h2>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, variant, size }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, readOnly, className, type, min, max, onChange }: any) => (
    <input
      data-testid="input"
      value={value}
      readOnly={readOnly}
      className={className}
      type={type}
      min={min}
      max={max}
      onChange={onChange}
    />
  ),
}));

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left">ArrowLeft</span>,
  Copy: () => <span data-testid="icon-copy">Copy</span>,
  Gift: () => <span data-testid="icon-gift">Gift</span>,
  CheckCircle: () => <span data-testid="icon-check-circle">CheckCircle</span>,
  Share2: () => <span data-testid="icon-share">Share</span>,
  Users: () => <span data-testid="icon-users">Users</span>,
  Sparkles: () => <span data-testid="icon-sparkles">Sparkles</span>,
  CreditCard: () => <span data-testid="icon-credit-card">CreditCard</span>,
  Check: () => <span data-testid="icon-check">Check</span>,
  Shield: () => <span data-testid="icon-shield">Shield</span>,
  Zap: () => <span data-testid="icon-zap">Zap</span>,
  Minus: () => <span data-testid="icon-minus">Minus</span>,
  Plus: () => <span data-testid="icon-plus">Plus</span>,
}));

// Mock the API module
const mockGetUserData = jest.fn();
const mockMakeAuthenticatedRequest = jest.fn();

jest.mock('@/lib/api', () => ({
  getUserData: () => mockGetUserData(),
  makeAuthenticatedRequest: (...args: any[]) => mockMakeAuthenticatedRequest(...args),
}));

jest.mock('@/lib/config', () => ({
  API_BASE_URL: 'https://api.test.com',
}));

jest.mock('@/lib/pricing-config', () => ({
  tierConfigs: {
    pro: {
      id: 'pro',
      name: 'Pro',
      description: 'Scale with confidence',
      price: '$10',
      priceValue: 10,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      features: ['Access to 10,000+ models'],
      ctaText: 'Get Started',
      stripePriceId: 'price_test_pro',
      stripeProductId: 'prod_test_pro',
    },
  },
  creditPackages: {
    // Package with discount (price < creditValue)
    tier1: { id: 'tier1', name: 'Starter', creditValue: 10, price: 9, discount: '10% off' },
    // Custom package with no discount (price === creditValue)
    custom: { id: 'custom', name: 'Custom', creditValue: 0, price: 0, discount: 'No discount' },
  },
}));

// Mock fetch for Stripe API calls
global.fetch = jest.fn();

describe('CheckoutPage - Credit package discount visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserData.mockReturnValue({
      user_id: 1,
      api_key: 'test-api-key',
      email: 'test@example.com',
    });
    mockMakeAuthenticatedRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ referral_code: 'TESTREF123' }),
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/test' }),
    });
  });

  describe('when credit package has a discount (price < creditValue)', () => {
    beforeEach(() => {
      mockSearchParams = {
        package: 'tier1',
        mode: 'credits',
      };
    });

    it('should display the credit package name', async () => {
      render(<CheckoutPage />);

      await waitFor(() => {
        expect(screen.getByText('Starter Credit Package')).toBeInTheDocument();
      });
    });

    it('should display discount badge when price is less than credit value', async () => {
      render(<CheckoutPage />);

      await waitFor(() => {
        // tier1 package: creditValue: 10, price: 9, discount: '10% off'
        expect(screen.getByText('10% off')).toBeInTheDocument();
      });
    });

    it('should display original price with strikethrough', async () => {
      render(<CheckoutPage />);

      await waitFor(() => {
        // Original credit value shown with strikethrough
        expect(screen.getByText('$10')).toBeInTheDocument();
      });
    });

    it('should display savings amount', async () => {
      render(<CheckoutPage />);

      await waitFor(() => {
        // You save: $10 - $9 = $1
        expect(screen.getByText('You save:')).toBeInTheDocument();
        expect(screen.getByText('$1')).toBeInTheDocument();
      });
    });
  });

  describe('when credit package has no discount (custom amount)', () => {
    beforeEach(() => {
      mockSearchParams = {
        package: 'custom',
        mode: 'credits',
        amount: '50',
      };
    });

    it('should display the custom credit package', async () => {
      render(<CheckoutPage />);

      await waitFor(() => {
        expect(screen.getByText('Custom Credit Package')).toBeInTheDocument();
      });
    });

    it('should NOT display discount badge when price equals credit value', async () => {
      render(<CheckoutPage />);

      await waitFor(() => {
        expect(screen.getByText('Custom Credit Package')).toBeInTheDocument();
      });

      // Should not find "No discount" text - it should be hidden
      expect(screen.queryByText('No discount')).not.toBeInTheDocument();
    });

    it('should NOT display savings section when there are no savings', async () => {
      render(<CheckoutPage />);

      await waitFor(() => {
        expect(screen.getByText('Custom Credit Package')).toBeInTheDocument();
      });

      // Should not find "You save:" text when there's no discount
      expect(screen.queryByText('You save:')).not.toBeInTheDocument();
    });
  });
});
