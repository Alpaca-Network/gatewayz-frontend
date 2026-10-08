import { fireEvent, render, screen, within } from '@testing-library/react';
import { HoldingsRewardsCard } from '../HoldingsRewardsCard';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useHoldingsRewards } from '@/lib/hooks/use-holdings-rewards';
import { useLinkedWallets } from '@/lib/hooks/use-linked-wallets';
import { HoldingsApiError, parseHoldingsRewards } from '@/lib/holdings/rewards-api';
import { RAW_HOLDINGS_REWARDS } from '@/lib/holdings/__tests__/fixtures';

jest.mock('lucide-react', () => ({
  AlertCircle: () => null,
  Info: () => null,
}));
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));
jest.mock('@/lib/hooks/use-holdings-rewards', () => ({
  useHoldingsRewards: jest.fn(),
}));
jest.mock('@/lib/hooks/use-linked-wallets', () => ({
  useLinkedWallets: jest.fn(),
}));

const mockUseGatewayzAuth = useGatewayzAuth as jest.Mock;
const mockUseHoldingsRewards = useHoldingsRewards as jest.Mock;
const mockUseLinkedWallets = useLinkedWallets as jest.Mock;

const DATA = parseHoldingsRewards(RAW_HOLDINGS_REWARDS);

const signedIn = (data = DATA, linked: Array<{ wallet_address: string; verified_at: string | null }> = []) => {
  mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated', login: jest.fn() });
  mockUseHoldingsRewards.mockReturnValue({ isLoading: false, isError: false, data });
  mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: linked });
};

describe('HoldingsRewardsCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks a signed-out visitor to sign in and does not fetch', () => {
    const login = jest.fn();
    mockUseGatewayzAuth.mockReturnValue({ status: 'unauthenticated', login });
    mockUseHoldingsRewards.mockReturnValue({ isLoading: false, data: undefined });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: undefined });

    render(<HoldingsRewardsCard />);

    expect(screen.getByText(/sign in to see holdings rewards/i)).toBeInTheDocument();
    expect(mockUseHoldingsRewards).toHaveBeenCalledWith({ enabled: false });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(login).toHaveBeenCalled();
  });

  it('shows a skeleton while loading', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated', login: jest.fn() });
    mockUseHoldingsRewards.mockReturnValue({ isLoading: true, data: undefined });
    mockUseLinkedWallets.mockReturnValue({ isLoading: true, data: undefined });

    const { container } = render(<HoldingsRewardsCard />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('shows the API error detail', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated', login: jest.fn() });
    mockUseHoldingsRewards.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new HoldingsApiError(503, 'Service unavailable'),
      data: undefined,
    });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: [] });

    render(<HoldingsRewardsCard />);
    expect(screen.getByText(/couldn't load holdings rewards: service unavailable/i)).toBeInTheDocument();
  });

  it('renders holdings, tier, credits, wallets and history', () => {
    signedIn();
    render(<HoldingsRewardsCard />);

    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getAllByText('$2,500.50').length).toBeGreaterThan(0);
    expect(screen.getByText(/^0\.750\d credits$/)).toBeInTheDocument();
    expect(screen.getByText('From $1,000.00')).toBeInTheDocument();
    expect(screen.getByText('0.1000 credits')).toBeInTheDocument();
    expect(screen.getByText('1.5000 credits')).toBeInTheDocument();
    expect(screen.getByText('3.2500 credits')).toBeInTheDocument();

    expect(screen.getAllByText('0xAaAa...AaAa')).toHaveLength(3);
    expect(screen.getByText('Eligible')).toBeInTheDocument();
    expect(screen.getByText('Not measured yet')).toBeInTheDocument();

    expect(screen.getByText('2026-10-03')).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();

    const activeRow = document.querySelector('tr[data-active="true"]') as HTMLElement;
    expect(within(activeRow).getByText('Your tier')).toBeInTheDocument();
    expect(within(activeRow).getByText('$1,000.00')).toBeInTheDocument();

    // Healthy account: nothing blocking, but the spend rule is always explained.
    expect(screen.queryByText(/why this isn't paying yet/i)).not.toBeInTheDocument();
    expect(screen.getByText(/credits match your inference spend/i)).toBeInTheDocument();
  });

  it('explains a wallet that is too new to be measured', () => {
    const linkedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    signedIn(DATA, [{ wallet_address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', verified_at: linkedAt }]);
    render(<HoldingsRewardsCard />);

    expect(screen.getByText('Too new')).toBeInTheDocument();
    expect(screen.getByText(/first measured 3 days after linking/i)).toBeInTheDocument();
  });

  it('explains why nothing pays when switched off with no wallets', () => {
    signedIn({ ...DATA, enabled: false, wallets: [], history: [] });
    render(<HoldingsRewardsCard />);

    expect(screen.getByText('Off')).toBeInTheDocument();
    const alert = screen.getByRole('alert', { name: /why holdings rewards are not paying/i });
    expect(within(alert).getByText(/holdings rewards are switched off/i)).toBeInTheDocument();
    expect(within(alert).getByText(/no linked wallets/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /link a wallet/i })[0]).toHaveAttribute('href', '/rewards#link-wallet');
  });
});
