import { render, screen } from '@testing-library/react';
import { EarningsCard } from '../EarningsCard';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useLinkedWallets } from '@/lib/hooks/use-linked-wallets';
import { useStakingRewards, useWalletRewardsEstimate } from '@/lib/hooks/use-wayz-staking';
import { RewardsApiError } from '@/lib/wayz/rewards-api';

jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));
jest.mock('@/lib/hooks/use-linked-wallets', () => ({
  useLinkedWallets: jest.fn(),
}));
jest.mock('@/lib/hooks/use-wayz-staking', () => ({
  useStakingRewards: jest.fn(),
  useWalletRewardsEstimate: jest.fn(),
}));

const mockUseGatewayzAuth = useGatewayzAuth as jest.Mock;
const mockUseLinkedWallets = useLinkedWallets as jest.Mock;
const mockUseStakingRewards = useStakingRewards as jest.Mock;
const mockUseWalletRewardsEstimate = useWalletRewardsEstimate as jest.Mock;

const ADDRESS = '0x1000000000000000000000000000000000000A';

describe('EarningsCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a loading card while the linked-wallets check is in flight', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseLinkedWallets.mockReturnValue({ isLoading: true, data: undefined });
    mockUseStakingRewards.mockReturnValue({ isLoading: false, data: undefined });
    mockUseWalletRewardsEstimate.mockReturnValue({ isLoading: false, data: undefined });

    const { container } = render(<EarningsCard address={ADDRESS as never} />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('connected-but-unlinked wallet: shows the estimate and a link-wallet CTA', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: [] });
    mockUseWalletRewardsEstimate.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { estimated_credits_per_day: 0.05, rate_credits_per_1k: 0.01 },
    });
    mockUseStakingRewards.mockReturnValue({ isLoading: false, data: undefined });

    render(<EarningsCard address={ADDRESS as never} />);

    expect(screen.getByText(/earning ≈ 0.0500 credits\/day/i)).toBeInTheDocument();
    expect(screen.getByText(/link this wallet in settings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /link this wallet/i })).toHaveAttribute('href', '/settings/wallets');
  });

  it('not logged into Gatewayz at all: still falls back to the public estimate + CTA', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'unauthenticated' });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: undefined });
    mockUseWalletRewardsEstimate.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { estimated_credits_per_day: 0, rate_credits_per_1k: 0.01 },
    });
    mockUseStakingRewards.mockReturnValue({ isLoading: false, data: undefined });

    render(<EarningsCard address={ADDRESS as never} />);

    expect(screen.getByText(/stake wayz to start earning inference credits/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /link this wallet/i })).toBeInTheDocument();
  });

  it('logged-in linked wallet, rewards not live yet: shows the tier table instead of earnings', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: [{ wallet_address: ADDRESS }] });
    mockUseStakingRewards.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        enabled: false,
        rate_table: [{ min_stake_wayz: 0, credits_per_1k_wayz_per_day: 0.01 }],
        wallets: [],
        totals: { credits_paid_30d: 0, credits_paid_all: 0, pending_credits: 0 },
        history: [],
      },
    });
    mockUseWalletRewardsEstimate.mockReturnValue({ isLoading: false, data: undefined });

    render(<EarningsCard address={ADDRESS as never} />);

    expect(screen.getByText(/staking rewards are not live yet/i)).toBeInTheDocument();
    expect(screen.getByText('0.0100')).toBeInTheDocument();
  });

  it('logged-in linked wallet, rewards live: shows per-day estimate, totals, and history', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: [{ wallet_address: ADDRESS }] });
    mockUseStakingRewards.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        enabled: true,
        rate_table: [{ min_stake_wayz: 0, credits_per_1k_wayz_per_day: 0.01 }],
        wallets: [{ address: ADDRESS, staked_wayz: 5000, estimated_credits_per_day: 0.05 }],
        totals: { credits_paid_30d: 1.5, credits_paid_all: 9.9999, pending_credits: 0.01 },
        history: [
          { reward_date: '2026-09-10', wallet_address: ADDRESS, staked_wayz: 5000, credits: 0.05, status: 'paid' },
        ],
      },
    });
    mockUseWalletRewardsEstimate.mockReturnValue({ isLoading: false, data: undefined });

    render(<EarningsCard address={ADDRESS as never} />);

    expect(screen.getByText(/earning ≈ 0.0500 credits\/day at your current stake\./i)).toBeInTheDocument();
    expect(screen.getByText('1.5000 credits')).toBeInTheDocument();
    expect(screen.getByText('9.9999 credits')).toBeInTheDocument();
    expect(screen.getByText('0.0100 credits')).toBeInTheDocument();
    expect(screen.getByText('2026-09-10')).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
  });

  it('logged-in linked wallet with no stake: shows the empty-earnings message', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: [{ wallet_address: ADDRESS }] });
    mockUseStakingRewards.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        enabled: true,
        rate_table: [{ min_stake_wayz: 0, credits_per_1k_wayz_per_day: 0.01 }],
        wallets: [],
        totals: { credits_paid_30d: 0, credits_paid_all: 0, pending_credits: 0 },
        history: [],
      },
    });
    mockUseWalletRewardsEstimate.mockReturnValue({ isLoading: false, data: undefined });

    render(<EarningsCard address={ADDRESS as never} />);

    expect(screen.getByText(/you're not earning yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no reward history yet/i)).toBeInTheDocument();
  });

  it('shows an error message when the personalized rewards call fails', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, data: [{ wallet_address: ADDRESS }] });
    mockUseStakingRewards.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new RewardsApiError(500, 'stake_sync_stale'),
      data: undefined,
    });
    mockUseWalletRewardsEstimate.mockReturnValue({ isLoading: false, data: undefined });

    render(<EarningsCard address={ADDRESS as never} />);

    expect(screen.getByText(/couldn't load your staking rewards: stake_sync_stale/i)).toBeInTheDocument();
  });
});
