import { render, screen, waitFor } from '@testing-library/react';
import { ProviderPortalClient } from '../ProviderPortalClient';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useMyGpuProvider } from '@/lib/hooks/use-gpu-provider';
import { GpuProviderApiError } from '@/lib/gpu/provider-api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));
jest.mock('@/lib/hooks/use-gpu-provider', () => ({
  useMyGpuProvider: jest.fn(),
}));
jest.mock('../RegisterProviderForm', () => ({
  RegisterProviderForm: () => <div data-testid="register-form" />,
}));
jest.mock('../NodesList', () => ({
  NodesList: ({ nodes }: { nodes: unknown[] }) => <div data-testid="nodes-list">{nodes.length} nodes</div>,
}));
jest.mock('../EarningsSection', () => ({
  EarningsSection: () => <div data-testid="earnings-section" />,
}));

const mockUseGatewayzAuth = useGatewayzAuth as jest.Mock;
const mockUseMyGpuProvider = useMyGpuProvider as jest.Mock;

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_GPU_MARKETPLACE;

describe('ProviderPortalClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_GPU_MARKETPLACE = 'true';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GPU_MARKETPLACE = ORIGINAL_ENV;
  });

  it('renders nothing when the flag is off', () => {
    process.env.NEXT_PUBLIC_GPU_MARKETPLACE = 'false';
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseMyGpuProvider.mockReturnValue({ isLoading: false, isError: false, data: undefined });

    const { container } = render(<ProviderPortalClient />);
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects unauthenticated callers to the home page', async () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'unauthenticated' });
    mockUseMyGpuProvider.mockReturnValue({ isLoading: false, isError: false, data: undefined });

    const { container } = render(<ProviderPortalClient />);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });

  it('shows a loading state while authenticated and fetching', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseMyGpuProvider.mockReturnValue({ isLoading: true, isError: false, data: undefined });

    const { container } = render(<ProviderPortalClient />);
    expect(container.querySelector('[class*="animate-pulse"]')).toBeInTheDocument();
  });

  it('shows the registration form when the caller has no provider yet (404)', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseMyGpuProvider.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new GpuProviderApiError(404, 'not_found'),
      data: undefined,
    });

    render(<ProviderPortalClient />);
    expect(screen.getByTestId('register-form')).toBeInTheDocument();
  });

  it('shows a generic failure message for other errors', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseMyGpuProvider.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new GpuProviderApiError(500, 'unknown_error'),
      data: undefined,
    });

    render(<ProviderPortalClient />);
    expect(screen.getByText(/failed to load your provider/i)).toBeInTheDocument();
    expect(screen.queryByTestId('register-form')).not.toBeInTheDocument();
  });

  it('shows the provider dashboard once registered', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUseMyGpuProvider.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        provider: {
          id: 1,
          display_name: 'Acme GPUs',
          status: 'approved',
          payout_wallet_address: '0xabc',
          contact_email: null,
          region_default: null,
          created_at: '2026-09-03T00:00:00Z',
          approved_at: '2026-09-03T00:00:00Z',
          approved_by: 'admin-1',
        },
        nodes: [{ id: 5 }],
        earnings: { accrued_wei: 0n, settled_wei: 0n, void_wei: 0n },
      },
    });

    render(<ProviderPortalClient />);
    expect(screen.getByText('Acme GPUs')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByTestId('nodes-list')).toHaveTextContent('1 nodes');
    expect(screen.getByTestId('earnings-section')).toBeInTheDocument();
  });
});
