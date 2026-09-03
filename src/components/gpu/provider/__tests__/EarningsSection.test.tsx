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
      data: { accrued_wei: 0n, settled_wei: 0n, void_wei: 0n, work: [], settlements: [] },
    });
    render(<EarningsSection />);
    expect(screen.getByText(/no verified work yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no settlements yet/i)).toBeInTheDocument();
  });

  it('formats wei totals as trimmed WAYZ, and links settlements to Snowtrace', () => {
    mockUseMyGpuEarnings.mockReturnValue({
      isLoading: false,
      data: {
        accrued_wei: 123n * 10n ** 18n,
        settled_wei: 456n * 10n ** 18n,
        void_wei: 0n,
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
            period_start: '2026-09-02T00:00:00Z',
            period_end: '2026-09-03T00:00:00Z',
            amount_wei: 456n * 10n ** 18n,
            tx_hash: '0xdeadbeef',
            tx_url: 'https://testnet.snowtrace.io/tx/0xdeadbeef',
            status: 'sent',
          },
        ],
      },
    });

    render(<EarningsSection />);

    expect(screen.getByText('123 WAYZ')).toBeInTheDocument();
    expect(screen.getAllByText('456 WAYZ').length).toBeGreaterThan(0);
    expect(screen.getByText('community/llama-3.1-8b-instruct')).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view on snowtrace/i })).toHaveAttribute(
      'href',
      'https://testnet.snowtrace.io/tx/0xdeadbeef'
    );
  });
});
