import { fireEvent, render, screen } from '@testing-library/react';
import { DelegationSection } from '../DelegationSection';
import { DelegationPositionCard } from '../DelegationPositionCard';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useIsTauri } from '@/lib/desktop/hooks';
import { useDelegationRewards, useDelegationStatus } from '@/lib/delegation/use-delegation';
import type { DelegationStatus } from '@/lib/delegation/api';

jest.mock('@/context/gatewayz-auth-context', () => ({ useGatewayzAuth: jest.fn() }));
jest.mock('@/lib/desktop/hooks', () => ({ useIsTauri: jest.fn() }));
jest.mock('@/lib/delegation/use-delegation', () => ({
  useDelegationStatus: jest.fn(),
  useDelegationRewards: jest.fn(),
}));
jest.mock('../EthVaultPanel', () => ({ EthVaultPanel: () => <div>eth-panel</div> }));
jest.mock('../CardanoPoolPanel', () => ({ CardanoPoolPanel: () => <div>ada-panel</div> }));

const mockStatus = useDelegationStatus as jest.Mock;
const mockRewards = useDelegationRewards as jest.Mock;
const mockAuth = useGatewayzAuth as jest.Mock;
const mockTauri = useIsTauri as jest.Mock;

const STATUS: DelegationStatus = {
  enabled: true,
  eth: { vault_address: '0x1111111111111111111111111111111111111111', chain_id: 1, fee_percent: 5 },
  cardano: { pool_id: 'pool1abc' },
  allowance_rates: [
    { asset: 'ETH', credits_per_1k_usd_per_day: 1.5 },
    { asset: 'ADA', credits_per_1k_usd_per_day: 2 },
  ],
  disclaimer: 'Rates can change. Not an investment product.',
};

describe('DelegationSection', () => {
  const original = process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED;
  const login = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = 'true';
    mockTauri.mockReturnValue(false);
    mockAuth.mockReturnValue({ status: 'authenticated', login });
    mockStatus.mockReturnValue({ data: STATUS });
    mockRewards.mockReturnValue({ isLoading: false, isError: false, data: undefined });
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = original;
  });

  it('renders nothing while the build flag is off, even if the backend says on', () => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = 'false';
    const { container } = render(<DelegationSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['no status yet', undefined],
    ['backend disabled', { ...STATUS, enabled: false }],
    ['no vault and no pool', { ...STATUS, eth: { vault_address: null, chain_id: 1, fee_percent: null }, cardano: { pool_id: null } }],
  ])('renders nothing with %s', (_label, data) => {
    mockStatus.mockReturnValue({ data });
    const { container } = render(<DelegationSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the explainer, current rates and the API disclaimer, plus both tabs', () => {
    render(<DelegationSection />);
    expect(screen.getByText('Stake for inference')).toBeInTheDocument();
    expect(screen.getByText(/Gatewayz keeps the staking rewards/)).toBeInTheDocument();
    expect(screen.getByText(/funds are never locked/)).toBeInTheDocument();
    expect(screen.getByText(/ETH 1.5 credits per \$1,000 staked per day/)).toBeInTheDocument();
    expect(screen.getByText(/not guaranteed/)).toBeInTheDocument();
    expect(screen.getByText(STATUS.disclaimer)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ETH' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ADA' })).toBeInTheDocument();
    expect(screen.getByText('eth-panel')).toBeInTheDocument();
  });

  it('shows only the ADA tab when only a pool is configured', () => {
    mockStatus.mockReturnValue({ data: { ...STATUS, eth: { vault_address: null, chain_id: 1, fee_percent: null } } });
    render(<DelegationSection />);
    expect(screen.queryByRole('tab', { name: 'ETH' })).not.toBeInTheDocument();
    expect(screen.getByText('ada-panel')).toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in', () => {
    mockAuth.mockReturnValue({ status: 'unauthenticated', login });
    render(<DelegationSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to start' }));
    expect(login).toHaveBeenCalled();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('sends desktop users to the browser instead of mounting wallet code', () => {
    mockTauri.mockReturnValue(true);
    render(<DelegationSection />);
    expect(screen.getByText(/needs a browser wallet/)).toBeInTheDocument();
    expect(screen.queryByText('eth-panel')).not.toBeInTheDocument();
  });
});

describe('DelegationPositionCard', () => {
  it('shows allowance, totals, positions and history', () => {
    mockRewards.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        enabled: true,
        positions: [
          { asset: 'ETH', wallet_address: '0x1111111111111111111111111111111111111111', amount: 1.5, usd_value: 4500, measured_at: null },
          { asset: 'ADA', wallet_address: 'stake1u9ylzsgxaa6xctf4juup682ar3juj85n8tx3hthnljg47zctvm3rc', amount: 1000, usd_value: 350, measured_at: null },
        ],
        exit_requests: [],
        linked_wallets: [],
        allowance: { credits_per_day_estimate: 2.5, month_estimate_usd: 75 },
        totals: { pending: 1, paid: 10 },
        history: [{ date: '2026-10-07', asset: 'ETH', credits: 2.5, status: 'paid' }],
      },
    });
    render(<DelegationPositionCard />);
    expect(screen.getAllByText('2.5000')).toHaveLength(2);
    expect(screen.getByText('$75.00')).toBeInTheDocument();
    expect(screen.getByText('1.5 ETH')).toBeInTheDocument();
    expect(screen.getByText('stake1u9yl...tvm3rc')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows an empty state and errors', () => {
    mockRewards.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<DelegationPositionCard />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn.t load/);
  });
});
