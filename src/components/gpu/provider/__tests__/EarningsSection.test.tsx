import { render, screen } from '@testing-library/react';
import { EarningsSection } from '../EarningsSection';
import { useMyGpuEarnings } from '@/lib/hooks/use-gpu-provider';

jest.mock('@/lib/hooks/use-gpu-provider', () => ({
  useMyGpuEarnings: jest.fn(),
}));

const mockUseMyGpuEarnings = useMyGpuEarnings as jest.Mock;

describe('EarningsSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows loading skeletons', () => {
    mockUseMyGpuEarnings.mockReturnValue({ isLoading: true, data: undefined });
    const { container } = render(<EarningsSection />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('shows empty states with no work/settlements', () => {
    mockUseMyGpuEarnings.mockReturnValue({
      isLoading: false,
      data: {
        accrued_wei: 0n,
        settled_wei: 0n,
        void_wei: 0n,
        accrued_usd: 0,
        settled_usd: 0,
        void_usd: 0,
        eth_usd_price: null,
        work: [],
        settlements: [],
      },
    });
    render(<EarningsSection />);
    expect(screen.getByText(/no verified work yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no settlements yet/i)).toBeInTheDocument();
  });

  it('shows USD earned and ETH paid, labels ETH settlements as ETH and links them to Basescan', () => {
    mockUseMyGpuEarnings.mockReturnValue({
      isLoading: false,
      data: {
        accrued_usd: 1.5,
        settled_usd: 30,
        void_usd: 0.25,
        accrued_wei: 5n * 10n ** 14n, // $1.50 @ $3000/ETH
        settled_wei: 10n ** 16n, // 0.01 ETH actually paid
        void_wei: 0n,
        eth_usd_price: 3000,
        work: [
          {
            billing_ref: 'br_1',
            model: 'community/llama-3.1-8b-instruct',
            prompt_tokens: 100,
            completion_tokens: 200,
            verification: 'verified',
            created_at: '2026-09-03T00:00:00Z',
          },
        ],
        settlements: [
          {
            id: 1,
            period_start: '2026-09-22T00:00:00Z',
            period_end: '2026-09-23T00:00:00Z',
            amount_wei: 10n ** 16n,
            asset: 'ETH',
            amount_usd: 30,
            eth_usd_price: 3000,
            confirmed: true,
            tx_hash: '0xbeef',
            tx_url: 'https://basescan.org/tx/0xbeef',
            status: 'sent',
          },
        ],
      },
    });

    render(<EarningsSection />);

    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText(/≈ 0\.0005 ETH/)).toBeInTheDocument();
    expect(screen.getByText('0.01 ETH')).toBeInTheDocument();
    expect(screen.getByText('$30.00 earned')).toBeInTheDocument();
    expect(screen.getByText('$0.25')).toBeInTheDocument();
    expect(screen.getByText('0.01 ETH ($30.00)')).toBeInTheDocument();
    expect(screen.queryByText(/WAYZ/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view on basescan/i })).toHaveAttribute(
      'href',
      'https://basescan.org/tx/0xbeef'
    );
  });

  it('shows a broadcast-but-unconfirmed ETH settlement as confirming', () => {
    mockUseMyGpuEarnings.mockReturnValue({
      isLoading: false,
      data: {
        accrued_usd: 0,
        settled_usd: 0,
        void_usd: 0,
        accrued_wei: 0n,
        settled_wei: 0n,
        void_wei: 0n,
        eth_usd_price: null,
        work: [],
        settlements: [
          {
            id: 2,
            period_start: '2026-09-22T00:00:00Z',
            period_end: '2026-09-23T00:00:00Z',
            amount_wei: 10n ** 16n,
            asset: 'ETH',
            amount_usd: 30,
            eth_usd_price: 3000,
            confirmed: false,
            tx_hash: '0xpending',
            tx_url: 'https://basescan.org/tx/0xpending',
            status: 'pending',
          },
        ],
      },
    });

    render(<EarningsSection />);
    expect(screen.getByText('confirming')).toBeInTheDocument();
    // No trusted price -> no ETH estimate line for the unpaid balance.
    expect(screen.queryByText(/today's price/)).not.toBeInTheDocument();
  });

  it('keeps legacy pre-switch WAYZ settlements labelled WAYZ with a Snowtrace link', () => {
    mockUseMyGpuEarnings.mockReturnValue({
      isLoading: false,
      data: {
        accrued_usd: 0,
        settled_usd: 0,
        void_usd: 0,
        accrued_wei: 0n,
        settled_wei: 0n,
        void_wei: 0n,
        eth_usd_price: null,
        work: [],
        settlements: [
          {
            id: 1,
            period_start: '2026-09-02T00:00:00Z',
            period_end: '2026-09-03T00:00:00Z',
            amount_wei: 456n * 10n ** 18n,
            asset: 'WAYZ',
            amount_usd: null,
            eth_usd_price: null,
            confirmed: true,
            tx_hash: '0xdeadbeef',
            tx_url: 'https://testnet.snowtrace.io/tx/0xdeadbeef',
            status: 'sent',
          },
        ],
      },
    });

    render(<EarningsSection />);
    expect(screen.getByText('456 WAYZ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view on snowtrace/i })).toHaveAttribute(
      'href',
      'https://testnet.snowtrace.io/tx/0xdeadbeef'
    );
  });
});
