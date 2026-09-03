import { render, screen, fireEvent } from '@testing-library/react';
import { UtilizationChart } from '../UtilizationChart';
import { useGpuUtilization } from '@/lib/hooks/use-gpu-public';

jest.mock('@/lib/hooks/use-gpu-public', () => ({
  useGpuUtilization: jest.fn(),
}));

// recharts' ResponsiveContainer needs real layout (getBoundingClientRect) to render
// children in jsdom; stub it to a plain passthrough so we can assert on our own
// markup (the window/group toggle, loading/empty states) without fighting that.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const mockUseGpuUtilization = useGpuUtilization as jest.Mock;

describe('UtilizationChart', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to 24h/region and calls the hook accordingly', () => {
    mockUseGpuUtilization.mockReturnValue({ isLoading: false, data: { series: [] } });
    render(<UtilizationChart />);
    expect(mockUseGpuUtilization).toHaveBeenCalledWith('24h', 'region');
  });

  it('shows a loading skeleton', () => {
    mockUseGpuUtilization.mockReturnValue({ isLoading: true, data: undefined });
    const { container } = render(<UtilizationChart />);
    expect(container.querySelector('[class*="animate-pulse"]')).toBeInTheDocument();
  });

  it('shows an empty state with no series data', () => {
    mockUseGpuUtilization.mockReturnValue({ isLoading: false, data: { series: [] } });
    render(<UtilizationChart />);
    expect(screen.getByText(/no utilization data yet/i)).toBeInTheDocument();
  });

  it('renders the chart once data arrives and switches window/group on click', () => {
    mockUseGpuUtilization.mockReturnValue({
      isLoading: false,
      data: {
        series: [
          { hour: '2026-09-03T10:00:00Z', group: 'us-east', requests: 10, prompt_tokens: 1, completion_tokens: 1, avg_latency_ms: 1, error_rate: 0 },
        ],
      },
    });
    render(<UtilizationChart />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '7d' }));
    expect(mockUseGpuUtilization).toHaveBeenLastCalledWith('7d', 'region');

    fireEvent.click(screen.getByRole('button', { name: 'model' }));
    expect(mockUseGpuUtilization).toHaveBeenLastCalledWith('7d', 'model');
  });
});
