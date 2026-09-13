import { render, screen } from '@testing-library/react';
import { ProviderScoreCard } from '../ProviderScoreCard';
import { useMyGpuEarnings } from '@/lib/hooks/use-gpu-provider';

jest.mock('@/lib/hooks/use-gpu-provider', () => ({
  useMyGpuEarnings: jest.fn(),
}));

const mockUseMyGpuEarnings = useMyGpuEarnings as jest.Mock;

describe('ProviderScoreCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows loading skeletons', () => {
    mockUseMyGpuEarnings.mockReturnValue({ isLoading: true, data: undefined });
    const { container } = render(<ProviderScoreCard />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('renders nothing when emission is absent (per_unit mode)', () => {
    mockUseMyGpuEarnings.mockReturnValue({
      isLoading: false,
      data: { accrued_wei: 0n, settled_wei: 0n, void_wei: 0n, work: [], settlements: [] },
    });
    const { container } = render(<ProviderScoreCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the four metric bars with weights, adjusted score, share, rank, and the next-epoch estimate', () => {
    mockUseMyGpuEarnings.mockReturnValue({
      isLoading: false,
      data: {
        accrued_wei: 0n,
        settled_wei: 0n,
        void_wei: 0n,
        work: [],
        settlements: [],
        emission: {
          last_epoch: '2026-09-12',
          score: {
            compute: 0.8,
            speed: 0.6,
            availability: 0.95,
            unique_models: 0.4,
            raw: 0.75,
            adjusted: 0.7123,
            share: 0.0456,
          },
          allocation_wayz: 123.4567,
          rank: 3,
          providers_scored: 40,
        },
      },
    });

    render(<ProviderScoreCard />);

    expect(screen.getByText('Your score')).toBeInTheDocument();
    expect(screen.getByText(/last epoch: /i)).toBeInTheDocument();

    expect(screen.getByText('Compute')).toBeInTheDocument();
    expect(screen.getByText('80.00%')).toBeInTheDocument();
    expect(screen.getByText('55% weight')).toBeInTheDocument();

    expect(screen.getByText('Response speed')).toBeInTheDocument();
    expect(screen.getByText('60.00%')).toBeInTheDocument();

    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('95.00%')).toBeInTheDocument();

    expect(screen.getByText('Unique models')).toBeInTheDocument();
    expect(screen.getByText('40.00%')).toBeInTheDocument();
    expect(screen.getByText('5% weight')).toBeInTheDocument();

    expect(screen.getByText('0.7123')).toBeInTheDocument();
    expect(screen.getByText('4.56%')).toBeInTheDocument();
    expect(screen.getByText('3 of 40')).toBeInTheDocument();
    expect(screen.getByText('123.4567 WAYZ')).toBeInTheDocument();
  });

  it('falls back to "no epoch has run yet" when last_epoch is null', () => {
    mockUseMyGpuEarnings.mockReturnValue({
      isLoading: false,
      data: {
        accrued_wei: 0n,
        settled_wei: 0n,
        void_wei: 0n,
        work: [],
        settlements: [],
        emission: {
          last_epoch: null,
          score: { compute: 0, speed: 0, availability: 0, unique_models: 0, raw: 0, adjusted: 0, share: 0 },
          allocation_wayz: 0,
          rank: 0,
          providers_scored: 0,
        },
      },
    });

    render(<ProviderScoreCard />);
    expect(screen.getByText(/no epoch has run yet/i)).toBeInTheDocument();
  });
});
