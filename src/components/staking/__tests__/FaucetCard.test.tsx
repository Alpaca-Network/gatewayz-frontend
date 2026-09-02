import { render, screen } from '@testing-library/react';
import { FaucetCard } from '../FaucetCard';
import { useFaucetStatus, useClaimFaucet } from '@/lib/hooks/use-wayz-staking';

jest.mock('@/lib/hooks/use-wayz-staking', () => ({
  useFaucetStatus: jest.fn(),
  useClaimFaucet: jest.fn(),
}));

const mockUseFaucetStatus = useFaucetStatus as jest.Mock;
const mockUseClaimFaucet = useClaimFaucet as jest.Mock;

const ADDRESS = '0x1000000000000000000000000000000000000a';
const TEN_WAYZ = 10n * 10n ** 18n;

describe('FaucetCard', () => {
  beforeEach(() => {
    mockUseClaimFaucet.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  it('shows the ineligible reason with min_requests', () => {
    mockUseFaucetStatus.mockReturnValue({
      isLoading: false,
      data: { configured: true, eligible: false, min_requests: 1, claim_amount: TEN_WAYZ, claim: null },
    });

    render(<FaucetCard address={ADDRESS as never} />);

    expect(screen.getByText(/complete at least 1 inference request/i)).toBeInTheDocument();
  });

  it('shows a claim button with the amount when eligible', () => {
    mockUseFaucetStatus.mockReturnValue({
      isLoading: false,
      data: { configured: true, eligible: true, min_requests: 1, claim_amount: TEN_WAYZ, claim: null },
    });

    render(<FaucetCard address={ADDRESS as never} />);

    expect(screen.getByRole('button', { name: /claim 10 wayz/i })).toBeInTheDocument();
  });

  it('shows the existing claim status and a Snowtrace link when already claimed', () => {
    mockUseFaucetStatus.mockReturnValue({
      isLoading: false,
      data: {
        configured: true,
        eligible: true,
        min_requests: 1,
        claim_amount: TEN_WAYZ,
        claim: {
          status: 'sent',
          wallet_address: ADDRESS,
          tx_hash: '0xdeadbeef',
          claimed_at: '2026-09-01T00:00:00Z',
        },
      },
    });

    render(<FaucetCard address={ADDRESS as never} />);

    expect(screen.getByText(/sent/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view transaction on snowtrace/i })).toHaveAttribute(
      'href',
      'https://testnet.snowtrace.io/tx/0xdeadbeef'
    );
  });

  it('shows an unconfigured message when the faucet is not set up', () => {
    mockUseFaucetStatus.mockReturnValue({
      isLoading: false,
      data: { configured: false, eligible: false, min_requests: 1, claim_amount: 0n, claim: null },
    });

    render(<FaucetCard address={ADDRESS as never} />);

    expect(screen.getByText(/not configured yet/i)).toBeInTheDocument();
  });
});
