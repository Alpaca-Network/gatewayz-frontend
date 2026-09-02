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
// The backend returns claim_amount as whole WAYZ (e.g. "1000"), NOT wei —
// see faucet.py's comment on /faucet/status and /faucet/claim. Using a
// number here (not a scaled bigint) is the point of these fixtures.
const CLAIM_AMOUNT_WAYZ = 1000;

describe('FaucetCard', () => {
  beforeEach(() => {
    mockUseClaimFaucet.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  it('shows the ineligible reason with min_requests', () => {
    mockUseFaucetStatus.mockReturnValue({
      isLoading: false,
      data: { configured: true, eligible: false, min_requests: 1, claim_amount: CLAIM_AMOUNT_WAYZ, claim: null },
    });

    render(<FaucetCard address={ADDRESS as never} />);

    expect(screen.getByText(/complete at least 1 inference request/i)).toBeInTheDocument();
  });

  it('shows a claim button with the whole-WAYZ amount when eligible (not scaled as wei)', () => {
    mockUseFaucetStatus.mockReturnValue({
      isLoading: false,
      data: { configured: true, eligible: true, min_requests: 1, claim_amount: CLAIM_AMOUNT_WAYZ, claim: null },
    });

    render(<FaucetCard address={ADDRESS as never} />);

    expect(screen.getByRole('button', { name: /claim 1000 wayz/i })).toBeInTheDocument();
  });

  it('shows the existing claim status and a Snowtrace link when already claimed', () => {
    mockUseFaucetStatus.mockReturnValue({
      isLoading: false,
      data: {
        configured: true,
        eligible: true,
        min_requests: 1,
        claim_amount: CLAIM_AMOUNT_WAYZ,
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
      data: { configured: false, eligible: false, min_requests: 1, claim_amount: 0, claim: null },
    });

    render(<FaucetCard address={ADDRESS as never} />);

    expect(screen.getByText(/not configured yet/i)).toBeInTheDocument();
  });
});
