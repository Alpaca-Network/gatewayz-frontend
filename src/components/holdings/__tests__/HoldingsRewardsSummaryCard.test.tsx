import { render, screen } from '@testing-library/react';
import { HoldingsRewardsSummaryCard } from '../HoldingsRewardsSummaryCard';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useHoldingsRewards } from '@/lib/hooks/use-holdings-rewards';
import { parseHoldingsRewards } from '@/lib/holdings/rewards-api';
import { RAW_HOLDINGS_REWARDS } from '@/lib/holdings/__tests__/fixtures';

jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));
jest.mock('@/lib/hooks/use-holdings-rewards', () => ({
  useHoldingsRewards: jest.fn(),
}));

const mockUseGatewayzAuth = useGatewayzAuth as jest.Mock;
const mockUseHoldingsRewards = useHoldingsRewards as jest.Mock;

const DATA = parseHoldingsRewards(RAW_HOLDINGS_REWARDS);

describe('HoldingsRewardsSummaryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
  });

  it('shows paid and pending credits once a wallet is linked', () => {
    mockUseHoldingsRewards.mockReturnValue({ isLoading: false, data: DATA });
    render(<HoldingsRewardsSummaryCard />);

    expect(screen.getByText('Earn free inference on what you hold')).toBeInTheDocument();
    expect(screen.getByText('3.2500 credits')).toBeInTheDocument();
    expect(screen.getByText(`${DATA.totals.pending_credits.toFixed(4)} credits`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view rewards/i })).toHaveAttribute('href', '/rewards');
  });

  it('asks an account with no linked wallet to link one', () => {
    mockUseHoldingsRewards.mockReturnValue({ isLoading: false, data: { ...DATA, wallets: [] } });
    render(<HoldingsRewardsSummaryCard />);

    expect(screen.queryByText(/paid, all time/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /link a wallet/i })).toHaveAttribute('href', '/rewards#link-wallet');
  });

  it('still points to /rewards when the API fails, and fetches only when signed in', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'unauthenticated' });
    mockUseHoldingsRewards.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<HoldingsRewardsSummaryCard />);

    expect(mockUseHoldingsRewards).toHaveBeenCalledWith({ enabled: false });
    expect(screen.getByRole('link', { name: /link a wallet/i })).toBeInTheDocument();
  });
});
