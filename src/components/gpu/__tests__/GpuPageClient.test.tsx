import { render, screen } from '@testing-library/react';
import { GpuPageClient } from '../GpuPageClient';
import { useGpuPublicSummary, useGpuPublicNodes } from '@/lib/hooks/use-gpu-public';

jest.mock('@/lib/hooks/use-gpu-public', () => ({
  useGpuPublicSummary: jest.fn(),
  useGpuPublicNodes: jest.fn(),
  useGpuUtilization: jest.fn(),
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const mockUseSummary = useGpuPublicSummary as jest.Mock;
const mockUseNodes = useGpuPublicNodes as jest.Mock;

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_GPU_MARKETPLACE;

describe('GpuPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSummary.mockReturnValue({ isLoading: false, data: undefined });
    mockUseNodes.mockReturnValue({ isLoading: false, data: undefined });
    // useGpuUtilization is used inside UtilizationChart, mocked separately there;
    // here it's imported transitively so give it a safe default too.
    const useGpuPublic = jest.requireMock('@/lib/hooks/use-gpu-public');
    useGpuPublic.useGpuUtilization.mockReturnValue({ isLoading: false, data: { series: [] } });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GPU_MARKETPLACE = ORIGINAL_ENV;
  });

  it('renders nothing when the flag is off', () => {
    process.env.NEXT_PUBLIC_GPU_MARKETPLACE = 'false';
    const { container } = render(<GpuPageClient />);
    expect(container).toBeEmptyDOMElement();
    expect(mockUseSummary).toHaveBeenCalledWith({ enabled: false });
  });

  it('renders the dashboard when the flag is on, with an empty state for no data', () => {
    process.env.NEXT_PUBLIC_GPU_MARKETPLACE = 'true';
    render(<GpuPageClient />);
    expect(screen.getByRole('heading', { name: 'GPU Marketplace' })).toBeInTheDocument();
    expect(screen.getByText(/no community nodes online yet/i)).toBeInTheDocument();
    expect(mockUseSummary).toHaveBeenCalledWith({ enabled: true });
  });

  it('renders populated summary + nodes data', () => {
    process.env.NEXT_PUBLIC_GPU_MARKETPLACE = 'true';
    mockUseSummary.mockReturnValue({
      isLoading: false,
      data: {
        active_nodes: 3,
        approved_providers: 2,
        regions: [{ region: 'us-east', nodes: 3 }],
        models: [{ id: 'llama-3.1-8b-instruct', nodes: 2 }],
        last_hour: { requests: 10, tokens: 100, avg_latency_ms: 500, error_rate: 0 },
        updated_at: '2026-09-03T12:00:00Z',
      },
    });
    mockUseNodes.mockReturnValue({
      isLoading: false,
      data: [
        {
          name: 'gpu-node-01',
          region: 'us-east',
          gpu_model: 'RTX 4090',
          vram_gb: 24,
          status: 'active',
          uptime_24h_pct: 99.2,
          models: ['llama-3.1-8b-instruct'],
        },
      ],
    });

    render(<GpuPageClient />);

    expect(screen.getByText('gpu-node-01')).toBeInTheDocument();
    expect(screen.getByText('community/llama-3.1-8b-instruct')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register as a provider/i })).toHaveAttribute('href', '/gpu/provider');
  });
});
