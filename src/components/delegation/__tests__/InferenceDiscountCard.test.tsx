import { fireEvent, render, screen, within } from '@testing-library/react';
import { InferenceDiscountCard } from '../InferenceDiscountCard';
import { InferenceDiscountBalanceLine } from '../InferenceDiscountBalanceLine';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useDelegationRewards, useDelegationStatus } from '@/lib/delegation/use-delegation';
import type { DelegationRewards, DelegationStatus } from '@/lib/delegation/api';

jest.mock('@/context/gatewayz-auth-context', () => ({ useGatewayzAuth: jest.fn() }));
jest.mock('@/lib/delegation/use-delegation', () => ({
  useDelegationStatus: jest.fn(),
  useDelegationRewards: jest.fn(),
}));

const mockStatus = useDelegationStatus as jest.Mock;
const mockRewards = useDelegationRewards as jest.Mock;
const mockAuth = useGatewayzAuth as jest.Mock;

const DISCLAIMER = 'Discount amounts depend on staking rewards actually received and can change or stop.';

const STATUS: DelegationStatus = {
  enabled: true,
  eth: { vault_address: '0x1111111111111111111111111111111111111111', chain_id: 1, fee_percent: 99 },
  cardano: { pool_id: 'pool1abc' },
  allowance_rates: [],
  disclaimer: DISCLAIMER,
  payout_model: 'reward_share',
  reward_share: 0.95,
  discount_percent: 0.99,
  discount_enabled: true,
};

const REWARDS: DelegationRewards = {
  enabled: true,
  linked_wallets: [],
  positions: [],
  exit_requests: [],
  allowance: { credits_per_day_estimate: 0, month_estimate_usd: 0, daily_cap_credits: 0 },
  totals: { pending: 0, paid: 0 },
  history: [],
  disclaimer: DISCLAIMER,
  discount: {
    enabled: true,
    discount_percent: 0.99,
    reward_share: 0.95,
    balance_usd: 12.345678,
    lifetime_granted_usd: 20,
    lifetime_used_usd: 7.654322,
  },
  attributions: [
    {
      asset: 'ETH',
      period_key: '2026-10-10',
      stake_native: 1.5,
      attributed_usd: 0.42,
      discount_usd: 0.399,
      status: 'granted',
      granted_at: '2026-10-11T01:00:00+00:00',
    },
    {
      asset: 'ADA',
      period_key: 'epoch-512',
      stake_native: 1000,
      attributed_usd: 0.1,
      discount_usd: 0.095,
      status: 'pending',
      granted_at: null,
    },
  ],
  discount_history: [
    { created_at: '2026-10-11T02:00:00+00:00', kind: 'use', amount_usd: -0.000123, balance_after: 11.5, ref: null },
    { created_at: '2026-10-11T01:00:00+00:00', kind: 'grant', amount_usd: 0.399, balance_after: 11.500123, ref: null },
  ],
};

const loaded = (data: DelegationRewards | undefined) => ({ isLoading: false, isError: false, data });

describe('InferenceDiscountCard', () => {
  const original = process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = 'true';
    mockRewards.mockReturnValue(loaded(REWARDS));
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = original;
  });

  it('shows the balance, what you pay, totals, attributions, history and the API disclaimer', () => {
    render(<InferenceDiscountCard status={STATUS} />);
    expect(screen.getByRole('region', { name: 'Inference discount' })).toBeInTheDocument();
    expect(screen.getByText('$12.35')).toBeInTheDocument();
    expect(screen.getByText('You pay 1% of the list price until your balance runs out.')).toBeInTheDocument();
    expect(screen.getByText(/^95% of the staking rewards your stake brings Gatewayz/)).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('$7.65')).toBeInTheDocument();

    const [attributions, history] = screen.getAllByRole('table');
    expect(within(attributions).getByText('2026-10-10')).toBeInTheDocument();
    expect(within(attributions).getByText('1.5 ETH')).toBeInTheDocument();
    expect(within(attributions).getByText('$0.42')).toBeInTheDocument();
    expect(within(attributions).getByText('$0.40')).toBeInTheDocument();
    expect(within(attributions).getByText('Added')).toBeInTheDocument();
    expect(within(attributions).getByText('Pending')).toBeInTheDocument();

    expect(within(history).getByText('Used on inference')).toBeInTheDocument();
    expect(within(history).getByText('−$0.000123')).toBeInTheDocument();
    expect(within(history).getByText('+$0.40')).toBeInTheDocument();

    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it('does not repeat a disclaimer already shown on the page', () => {
    render(<InferenceDiscountCard status={STATUS} shownDisclaimer={DISCLAIMER} />);
    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument();
  });

  it('says the list price applies while the balance is empty', () => {
    mockRewards.mockReturnValue(
      loaded({ ...REWARDS, discount: { ...REWARDS.discount!, balance_usd: 0 }, attributions: [], discount_history: [] }),
    );
    render(<InferenceDiscountCard status={STATUS} />);
    expect(screen.getByText(/balance is empty, so requests are charged at the list price/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.queryByText('Discount history')).not.toBeInTheDocument();
  });

  it('hides the pay line when the backend sends no usable discount percent', () => {
    mockRewards.mockReturnValue(loaded({ ...REWARDS, discount: { ...REWARDS.discount!, discount_percent: null } }));
    render(<InferenceDiscountCard status={{ ...STATUS, discount_percent: null }} />);
    expect(screen.queryByText(/You pay/)).not.toBeInTheDocument();
    expect(screen.getByText(/Part of each request is paid from this balance/)).toBeInTheDocument();
  });

  it('collapses long tables behind a toggle', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...REWARDS.attributions[0], period_key: `2026-09-${10 + i}` }));
    mockRewards.mockReturnValue(loaded({ ...REWARDS, attributions: many }));
    render(<InferenceDiscountCard status={STATUS} />);
    const table = screen.getAllByRole('table')[0];
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 12' }));
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows loading and error states', () => {
    mockRewards.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    const { rerender } = render(<InferenceDiscountCard status={STATUS} />);
    expect(screen.getByLabelText('Loading your inference discount')).toHaveAttribute('aria-busy', 'true');

    mockRewards.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    rerender(<InferenceDiscountCard status={STATUS} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn.t load your inference discount/);
  });

  it.each([
    ['the build flag is off', () => (process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = 'false'), STATUS, REWARDS],
    ['the backend discount switch is off', () => undefined, { ...STATUS, discount_enabled: false }, REWARDS],
    ['the account discount is off', () => undefined, STATUS, { ...REWARDS, discount: { ...REWARDS.discount!, enabled: false } }],
    ['the backend omits the discount', () => undefined, STATUS, { ...REWARDS, discount: null }],
  ])('renders nothing when %s', (_label, setup, status, rewards) => {
    setup();
    mockRewards.mockReturnValue(loaded(rewards as DelegationRewards));
    const { container } = render(<InferenceDiscountCard status={status as DelegationStatus} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('InferenceDiscountBalanceLine', () => {
  const original = process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = 'true';
    mockAuth.mockReturnValue({ status: 'authenticated' });
    mockStatus.mockReturnValue({ data: STATUS });
    mockRewards.mockReturnValue(loaded(REWARDS));
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = original;
  });

  it('shows the balance, what you pay, a link to /rewards and the disclaimer', () => {
    render(<InferenceDiscountBalanceLine />);
    expect(screen.getByRole('region', { name: 'Inference discount balance' })).toBeInTheDocument();
    expect(screen.getByText('$12.35')).toBeInTheDocument();
    expect(screen.getByText('You pay 1% of the list price until your balance runs out.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View discount' })).toHaveAttribute('href', '/rewards#inference-discount');
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it('points to /rewards when the balance is empty', () => {
    mockRewards.mockReturnValue(loaded({ ...REWARDS, discount: { ...REWARDS.discount!, balance_usd: 0 } }));
    render(<InferenceDiscountBalanceLine />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText(/to build a discount balance/)).toBeInTheDocument();
  });

  it('only fetches rewards when signed in and the discount is on', () => {
    mockAuth.mockReturnValue({ status: 'unauthenticated' });
    const { container } = render(<InferenceDiscountBalanceLine />);
    expect(container).toBeEmptyDOMElement();
    expect(mockRewards).toHaveBeenLastCalledWith({ enabled: false });
  });

  it.each([
    ['status not loaded', { data: undefined }, loaded(REWARDS)],
    ['discount switch off', { data: { ...STATUS, discount_enabled: false } }, loaded(REWARDS)],
    ['a load error', { data: STATUS }, { isLoading: false, isError: true, data: undefined }],
    ['no discount in the response', { data: STATUS }, loaded({ ...REWARDS, discount: null })],
  ])('renders nothing with %s', (_label, status, rewards) => {
    mockStatus.mockReturnValue(status);
    mockRewards.mockReturnValue(rewards);
    const { container } = render(<InferenceDiscountBalanceLine />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a placeholder while loading', () => {
    mockRewards.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    render(<InferenceDiscountBalanceLine />);
    expect(screen.getByLabelText('Loading your inference discount')).toBeInTheDocument();
  });
});
