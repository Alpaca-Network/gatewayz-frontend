import { fireEvent, render, screen, within } from '@testing-library/react';
import { InferenceDiscountCard } from '../InferenceDiscountCard';
import { InferenceDiscountBalanceLine } from '../InferenceDiscountBalanceLine';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useDiscountCredits } from '@/lib/discount-credits/use-discount-credits';
import type { DiscountCredits } from '@/lib/discount-credits/api';

jest.mock('@/context/gatewayz-auth-context', () => ({ useGatewayzAuth: jest.fn() }));
jest.mock('@/lib/discount-credits/use-discount-credits', () => ({ useDiscountCredits: jest.fn() }));

const mockCredits = useDiscountCredits as jest.Mock;
const mockAuth = useGatewayzAuth as jest.Mock;

const FLAG = 'NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED';
const DISCLAIMER = 'Terms are set by Gatewayz and can change or stop.';

const CREDITS: DiscountCredits = {
  balance: {
    enabled: true,
    discount_percent: 0.99,
    balance_usd: 12.345678,
    lifetime_granted_usd: 20,
    lifetime_used_usd: 7.654322,
  },
  history: [
    { created_at: '2026-10-11T02:00:00+00:00', kind: 'use', amount_usd: -0.000123, balance_after: 11.5, ref: null },
    { created_at: '2026-10-11T01:00:00+00:00', kind: 'grant', amount_usd: 0.399, balance_after: 11.500123, ref: null },
  ],
  disclaimer: DISCLAIMER,
};

const loaded = (data: DiscountCredits | undefined) => ({ isLoading: false, isError: false, data });
const withBalance = (over: Partial<NonNullable<DiscountCredits['balance']>>): DiscountCredits => ({
  ...CREDITS,
  balance: { ...CREDITS.balance!, ...over },
});

const originalFlag = process.env[FLAG];
function restoreFlag() {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
}

describe('InferenceDiscountCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env[FLAG] = 'true';
    mockCredits.mockReturnValue(loaded(CREDITS));
  });
  afterAll(restoreFlag);

  it('shows the balance, what you pay, totals, history and the API disclaimer', () => {
    render(<InferenceDiscountCard />);
    expect(screen.getByRole('region', { name: 'Discount credits' })).toBeInTheDocument();
    expect(screen.getByText('$12.35')).toBeInTheDocument();
    expect(screen.getByText('You pay 1% of the list price until your balance runs out.')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('$7.65')).toBeInTheDocument();

    const history = screen.getByRole('table');
    expect(within(history).getByText('Used on requests')).toBeInTheDocument();
    expect(within(history).getByText('Added')).toBeInTheDocument();
    expect(within(history).getByText('−$0.000123')).toBeInTheDocument();
    expect(within(history).getByText('+$0.40')).toBeInTheDocument();

    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it('does not repeat a disclaimer already shown on the page', () => {
    render(<InferenceDiscountCard shownDisclaimer={DISCLAIMER} />);
    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument();
  });

  it('says the list price applies while the balance is empty', () => {
    mockCredits.mockReturnValue(loaded({ ...withBalance({ balance_usd: 0 }), history: [] }));
    render(<InferenceDiscountCard />);
    expect(screen.getByText(/balance is empty, so requests are charged at the list price/)).toBeInTheDocument();
    expect(screen.queryByText('Balance history')).not.toBeInTheDocument();
  });

  it('hides the pay line when the backend sends no usable discount percent', () => {
    mockCredits.mockReturnValue(loaded(withBalance({ discount_percent: null })));
    render(<InferenceDiscountCard />);
    expect(screen.queryByText(/You pay/)).not.toBeInTheDocument();
    expect(screen.getByText(/Part of each request is paid from this balance/)).toBeInTheDocument();
  });

  it('collapses a long history behind a toggle', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...CREDITS.history[0], created_at: `2026-09-${10 + i}T00:00:00+00:00` }));
    mockCredits.mockReturnValue(loaded({ ...CREDITS, history: many }));
    render(<InferenceDiscountCard />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 12' }));
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows loading and error states', () => {
    mockCredits.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    const { rerender } = render(<InferenceDiscountCard />);
    expect(screen.getByLabelText('Loading your discount credits')).toHaveAttribute('aria-busy', 'true');

    mockCredits.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    rerender(<InferenceDiscountCard />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn.t load your discount credits/);
  });

  it.each([
    ['the build flag is off', () => (process.env[FLAG] = 'false'), CREDITS],
    ['the build flag is unset', () => delete process.env[FLAG], CREDITS],
    ['the account switch is off', () => undefined, withBalance({ enabled: false })],
    ['the backend omits the balance', () => undefined, { ...CREDITS, balance: null }],
  ])('renders nothing when %s', (_label, setup, credits) => {
    setup();
    mockCredits.mockReturnValue(loaded(credits));
    const { container } = render(<InferenceDiscountCard />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('InferenceDiscountBalanceLine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env[FLAG] = 'true';
    mockAuth.mockReturnValue({ status: 'authenticated' });
    mockCredits.mockReturnValue(loaded(CREDITS));
  });
  afterAll(restoreFlag);

  it('shows the balance, what you pay and the disclaimer', () => {
    render(<InferenceDiscountBalanceLine />);
    expect(screen.getByRole('region', { name: 'Discount credits balance' })).toBeInTheDocument();
    expect(screen.getByText('$12.35')).toBeInTheDocument();
    expect(screen.getByText('You pay 1% of the list price until your balance runs out.')).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says the list price applies when the balance is empty', () => {
    mockCredits.mockReturnValue(loaded(withBalance({ balance_usd: 0 })));
    render(<InferenceDiscountBalanceLine />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText(/balance is empty, so requests are charged at the list price/)).toBeInTheDocument();
  });

  it('only fetches the balance when signed in', () => {
    mockAuth.mockReturnValue({ status: 'unauthenticated' });
    const { container } = render(<InferenceDiscountBalanceLine />);
    expect(container).toBeEmptyDOMElement();
    expect(mockCredits).toHaveBeenLastCalledWith({ enabled: false });
  });

  it.each(['false', undefined])('renders nothing and does not fetch with the build flag %p', (value) => {
    if (value === undefined) delete process.env[FLAG];
    else process.env[FLAG] = value;
    const { container } = render(<InferenceDiscountBalanceLine />);
    expect(container).toBeEmptyDOMElement();
    expect(mockCredits).toHaveBeenLastCalledWith({ enabled: false });
  });

  it.each([
    ['the account switch off', loaded(withBalance({ enabled: false }))],
    ['a load error', { isLoading: false, isError: true, data: undefined }],
    ['no balance in the response', loaded({ ...CREDITS, balance: null })],
  ])('renders nothing with %s', (_label, credits) => {
    mockCredits.mockReturnValue(credits);
    const { container } = render(<InferenceDiscountBalanceLine />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a placeholder while loading', () => {
    mockCredits.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    render(<InferenceDiscountBalanceLine />);
    expect(screen.getByLabelText('Loading your discount credits')).toBeInTheDocument();
  });
});
