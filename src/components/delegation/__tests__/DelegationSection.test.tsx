import { fireEvent, render, screen } from '@testing-library/react';
import { DelegationSection } from '../DelegationSection';
import { DelegationPositionCard } from '../DelegationPositionCard';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useIsTauri } from '@/lib/desktop/hooks';
import { useDelegationRewards, useDelegationStatus } from '@/lib/delegation/use-delegation';
import type { DelegationStatus } from '@/lib/delegation/api';
import { ATTESTATION_STORAGE_KEY, GEO_COOKIE } from '@/lib/delegation/region';

jest.mock('@/context/gatewayz-auth-context', () => ({ useGatewayzAuth: jest.fn() }));
jest.mock('@/lib/desktop/hooks', () => ({ useIsTauri: jest.fn() }));
jest.mock('@/lib/delegation/use-delegation', () => ({
  useDelegationStatus: jest.fn(),
  useDelegationRewards: jest.fn(),
}));
jest.mock('../EthVaultPanel', () => ({
  EthVaultPanel: ({ allowNewStake = true }: { allowNewStake?: boolean }) => (
    <div>{allowNewStake ? 'eth-panel' : 'eth-panel:exit-only'}</div>
  ),
}));
jest.mock('../CardanoPoolPanel', () => ({ CardanoPoolPanel: () => <div>ada-panel</div> }));

const mockStatus = useDelegationStatus as jest.Mock;
const mockRewards = useDelegationRewards as jest.Mock;
const mockAuth = useGatewayzAuth as jest.Mock;
const mockTauri = useIsTauri as jest.Mock;

const STATUS: DelegationStatus = {
  enabled: true,
  eth: { vault_address: '0x1111111111111111111111111111111111111111', chain_id: 1, fee_percent: 99 },
  cardano: { pool_id: 'pool1abc' },
  allowance_rates: [
    { asset: 'ETH', credits_per_1k_usd_per_day: 1.5 },
    { asset: 'ADA', credits_per_1k_usd_per_day: 2 },
  ],
  disclaimer: 'Rates are set by Gatewayz, can change at any time, and are not a guaranteed return.',
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
    window.localStorage.setItem(ATTESTATION_STORAGE_KEY, 'true');
    document.cookie = `${GEO_COOKIE}=; path=/`;
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = original;
    window.localStorage.clear();
  });

  it.each(['US', 'CA', 'us'])('renders nothing for a visitor in %s with no stake', (country) => {
    document.cookie = `${GEO_COOKIE}=${country}; path=/`;
    mockRewards.mockReturnValue({ data: { positions: [], linked_wallets: [] } });
    const { container } = render(<DelegationSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lets a restricted visitor with an existing stake view and exit it, without new staking', () => {
    document.cookie = `${GEO_COOKIE}=US; path=/`;
    window.localStorage.removeItem(ATTESTATION_STORAGE_KEY);
    mockRewards.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        enabled: true,
        positions: [
          { asset: 'ETH', wallet_address: '0x2222222222222222222222222222222222222222', amount: 1, usd_value: 3000, measured_at: null },
        ],
        exit_requests: [],
        linked_wallets: [{ asset: 'eth', wallet_address: '0x2222222222222222222222222222222222222222' }],
        allowance: { credits_per_day_estimate: 0, month_estimate_usd: 0, daily_cap_credits: 0 },
        totals: { pending: 0, paid: 0 },
        history: [],
        disclaimer: '',
      },
    });
    render(<DelegationSection />);
    expect(screen.getByText('Your stake')).toBeInTheDocument();
    expect(screen.getByText(/New stakes are not available in your region/)).toBeInTheDocument();
    expect(screen.queryByText('Stake for inference')).not.toBeInTheDocument();
    expect(screen.getByText('eth-panel:exit-only')).toBeInTheDocument();
  });

  it('goes exit-only when the backend marked the account restricted, whatever the edge country', () => {
    document.cookie = `${GEO_COOKIE}=FR; path=/`;
    mockRewards.mockReturnValue({
      data: {
        enabled: true,
        positions: [],
        exit_requests: [],
        linked_wallets: [{ asset: 'eth', wallet_address: '0x2222222222222222222222222222222222222222' }],
        allowance: { credits_per_day_estimate: 0, month_estimate_usd: 0, daily_cap_credits: 0 },
        totals: { pending: 0, paid: 0 },
        history: [],
        disclaimer: '',
        eligibility: { status: 'restricted', attested_at: null },
      },
    });
    render(<DelegationSection />);
    expect(screen.getByText('Your stake')).toBeInTheDocument();
    expect(screen.queryByText('Stake for inference')).not.toBeInTheDocument();
    expect(screen.getByText('eth-panel:exit-only')).toBeInTheDocument();
  });

  it('fetches the rewards (and so the eligibility) for any signed-in visitor', () => {
    document.cookie = `${GEO_COOKIE}=FR; path=/`;
    render(<DelegationSection />);
    expect(mockRewards).toHaveBeenCalledWith({ enabled: true });
  });

  it('renders for a visitor in an allowed country', () => {
    document.cookie = `${GEO_COOKIE}=FR; path=/`;
    render(<DelegationSection />);
    expect(screen.getByText('Stake for inference')).toBeInTheDocument();
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
    expect(screen.getByText(/takes a 99% fee on staking rewards/)).toBeInTheDocument();
    expect(screen.getByText(STATUS.disclaimer)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ETH' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ADA' })).toBeInTheDocument();
    expect(screen.getByText('eth-panel')).toBeInTheDocument();
  });

  describe('with the v3 reward-share payout model', () => {
    const V3: DelegationStatus = {
      ...STATUS,
      allowance_rates: [],
      payout_model: 'reward_share',
      reward_share: 0.95,
      discount_percent: 0.99,
      discount_enabled: true,
    };
    const REWARDS = {
      enabled: true,
      positions: [],
      exit_requests: [],
      linked_wallets: [],
      allowance: { credits_per_day_estimate: 0, month_estimate_usd: 0, daily_cap_credits: 0 },
      totals: { pending: 0, paid: 0 },
      history: [],
      disclaimer: STATUS.disclaimer,
      discount: {
        enabled: true,
        discount_percent: 0.99,
        reward_share: 0.95,
        balance_usd: 3,
        lifetime_granted_usd: 3,
        lifetime_used_usd: 0,
      },
      attributions: [],
      discount_history: [],
    };

    it('describes the discount instead of the allowance, and shows the discount card', () => {
      mockStatus.mockReturnValue({ data: V3 });
      mockRewards.mockReturnValue({ isLoading: false, isError: false, data: REWARDS });
      render(<DelegationSection />);
      expect(screen.getByText(/get 95% of the staking rewards it brings Gatewayz back as an inference discount/)).toBeInTheDocument();
      expect(screen.getByText(/each request costs you 1% of the list price/)).toBeInTheDocument();
      expect(screen.queryByText(/Inference at 99% off/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Current allowance/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Rates are current, set by Gatewayz/)).not.toBeInTheDocument();
      expect(screen.getByText(/takes a 99% fee on staking rewards/)).toBeInTheDocument();
      // The API disclaimer stays on the page (once, in the explainer).
      expect(screen.getAllByText(STATUS.disclaimer)).toHaveLength(1);
      expect(screen.getByRole('region', { name: 'Inference discount' })).toBeInTheDocument();
      expect(screen.getByText('You pay 1% of the list price until your balance runs out.')).toBeInTheDocument();
      expect(screen.getByText('Your positions')).toBeInTheDocument();
      expect(screen.queryByText('Allowance per day')).not.toBeInTheDocument();
    });

    it('keeps the discount card out until the backend discount switch is on', () => {
      mockStatus.mockReturnValue({ data: { ...V3, discount_enabled: false } });
      mockRewards.mockReturnValue({ isLoading: false, isError: false, data: REWARDS });
      render(<DelegationSection />);
      expect(screen.queryByRole('region', { name: 'Inference discount' })).not.toBeInTheDocument();
    });

    it('shows the discount card to desktop users too', () => {
      mockTauri.mockReturnValue(true);
      mockStatus.mockReturnValue({ data: V3 });
      mockRewards.mockReturnValue({ isLoading: false, isError: false, data: REWARDS });
      render(<DelegationSection />);
      expect(screen.getByText(/the discount then counts for this account everywhere/)).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Inference discount' })).toBeInTheDocument();
    });
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
        allowance: { credits_per_day_estimate: 2.5, month_estimate_usd: 75, daily_cap_credits: 100 },
        totals: { pending: 1, paid: 10 },
        history: [
          { date: '2026-10-07', asset: 'ETH', wallet_address: '0x1111111111111111111111111111111111111111', usd_basis: 4400, credits: 2.5, status: 'claimed' },
        ],
        disclaimer: 'Rates are set by Gatewayz.',
      },
    });
    render(<DelegationPositionCard />);
    expect(screen.getAllByText('2.5000')).toHaveLength(2);
    expect(screen.getByText('$75.00')).toBeInTheDocument();
    expect(screen.getByText('1.5 ETH')).toBeInTheDocument();
    expect(screen.getByText('stake1u9yl...tvm3rc')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Capped at 100.0000 per day')).toBeInTheDocument();
    expect(screen.getByText('paying')).toBeInTheDocument();
    expect(screen.getByText('Rates are set by Gatewayz.')).toBeInTheDocument();
  });

  it('shows an empty state and errors', () => {
    mockRewards.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<DelegationPositionCard />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn.t load/);
  });
});
