import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import CreditsPage from '../page';

// Mock next/navigation
const mockPush = jest.fn();
const mockGet = jest.fn();
const mockReplaceState = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock window.history.replaceState
const originalReplaceState = window.history.replaceState;
beforeAll(() => {
  window.history.replaceState = mockReplaceState;
});
afterAll(() => {
  window.history.replaceState = originalReplaceState;
});

// Mock api functions
jest.mock('@/lib/api', () => ({
  getUserData: jest.fn(() => ({
    credits: 50,
    tier: 'pro',
    subscription_status: 'active',
    api_key: 'test-key',
  })),
  makeAuthenticatedRequest: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ credits: 50, transactions: [] }),
    })
  ),
  requestAuthRefresh: jest.fn(),
  saveUserData: jest.fn(),
}));

// Mock components
jest.mock('@/components/tier/tier-info-card', () => ({
  TierInfoCard: () => <div data-testid="tier-info-card">Tier Info</div>,
}));

jest.mock('@/components/pricing/pricing-section', () => ({
  PricingSection: () => <div data-testid="pricing-section">Pricing</div>,
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: () => <input type="checkbox" />,
}));

jest.mock('lucide-react', () => ({
  Info: () => <span>Info</span>,
  RefreshCw: () => <span>RefreshCw</span>,
  ArrowUpRight: () => <span>ArrowUpRight</span>,
  ChevronLeft: () => <span>ChevronLeft</span>,
  ChevronRight: () => <span>ChevronRight</span>,
  CreditCard: () => <span>CreditCard</span>,
  MoreHorizontal: () => <span>MoreHorizontal</span>,
  CheckCircle: () => <span>CheckCircle</span>,
  Sparkles: () => <span>Sparkles</span>,
}));

describe('CreditsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  it('renders the credits page', async () => {
    await act(async () => {
      render(<CreditsPage />);
    });

    expect(screen.getByText('Credits')).toBeInTheDocument();
  });

  it('displays credit balance', async () => {
    await act(async () => {
      render(<CreditsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });
  });

  it('renders tier info card', async () => {
    await act(async () => {
      render(<CreditsPage />);
    });

    expect(screen.getByTestId('tier-info-card')).toBeInTheDocument();
  });

  it('renders pricing section', async () => {
    await act(async () => {
      render(<CreditsPage />);
    });

    expect(screen.getByTestId('pricing-section')).toBeInTheDocument();
  });

  describe('buy parameter handling', () => {
    it('opens dialog when buy=true parameter is present', async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'buy') return 'true';
        return null;
      });

      await act(async () => {
        render(<CreditsPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Verify URL was cleaned up
      expect(mockReplaceState).toHaveBeenCalledWith({}, '', '/settings/credits');
    });

    it('does not open dialog when buy parameter is not present', async () => {
      mockGet.mockReturnValue(null);

      await act(async () => {
        render(<CreditsPage />);
      });

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('does not open dialog when buy parameter is not "true"', async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'buy') return 'false';
        return null;
      });

      await act(async () => {
        render(<CreditsPage />);
      });

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Buy Credits button', () => {
    it('renders Buy Credits button', async () => {
      await act(async () => {
        render(<CreditsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Buy Credits')).toBeInTheDocument();
      });
    });
  });
});
