import { fireEvent, render, screen, within } from '@testing-library/react';
import { DiscountCreditsCard } from '../DiscountCreditsCard';
import { useDiscountCredits } from '@/lib/discount-credits/use-discount-credits';
import type { DiscountCredits } from '@/lib/discount-credits/api';

jest.mock('@/lib/discount-credits/use-discount-credits', () => ({ useDiscountCredits: jest.fn() }));

const mockCredits = useDiscountCredits as jest.Mock;

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

describe('DiscountCreditsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env[FLAG] = 'true';
    mockCredits.mockReturnValue(loaded(CREDITS));
  });
  afterAll(restoreFlag);

  it('shows the balance, what you pay, totals, history and the API disclaimer', () => {
    render(<DiscountCreditsCard />);
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

  it('shows no disclaimer paragraph when the API sends none', () => {
    mockCredits.mockReturnValue(loaded({ ...CREDITS, disclaimer: '' }));
    render(<DiscountCreditsCard />);
    expect(screen.getByRole('region', { name: 'Discount credits' })).toBeInTheDocument();
    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument();
  });

  it('says the list price applies while the balance is empty', () => {
    mockCredits.mockReturnValue(loaded({ ...withBalance({ balance_usd: 0 }), history: [] }));
    render(<DiscountCreditsCard />);
    expect(screen.getByText(/balance is empty, so requests are charged at the list price/)).toBeInTheDocument();
    expect(screen.queryByText('Balance history')).not.toBeInTheDocument();
  });

  it('hides the pay line when the backend sends no usable discount percent', () => {
    mockCredits.mockReturnValue(loaded(withBalance({ discount_percent: null })));
    render(<DiscountCreditsCard />);
    expect(screen.queryByText(/You pay/)).not.toBeInTheDocument();
    expect(screen.getByText(/Part of each request is paid from this balance/)).toBeInTheDocument();
  });

  it('collapses a long history behind a toggle', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...CREDITS.history[0], created_at: `2026-09-${10 + i}T00:00:00+00:00` }));
    mockCredits.mockReturnValue(loaded({ ...CREDITS, history: many }));
    render(<DiscountCreditsCard />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 12' }));
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  });

  it.each([
    ['loading', { isLoading: true, isError: false, data: undefined }],
    ['a load error', { isLoading: false, isError: true, data: undefined }],
    // Stale data must not show through a failed refetch either.
    ['a load error with earlier data', { isLoading: false, isError: true, data: CREDITS }],
  ])('renders nothing with the build flag on and %s', (_label, result) => {
    mockCredits.mockReturnValue(result);
    const { container } = render(<DiscountCreditsCard />);
    expect(container).toBeEmptyDOMElement();
    expect(mockCredits).toHaveBeenLastCalledWith({ enabled: true });
  });

  it('renders the card with the build flag on once the account is reported enabled', () => {
    mockCredits.mockReturnValue(loaded(withBalance({ enabled: true })));
    render(<DiscountCreditsCard />);
    expect(screen.getByRole('region', { name: 'Discount credits' })).toBeInTheDocument();
  });

  it.each([
    ['the build flag is off', () => (process.env[FLAG] = 'false'), CREDITS],
    ['the build flag is unset', () => delete process.env[FLAG], CREDITS],
    ['the account switch is off', () => undefined, withBalance({ enabled: false })],
    ['the backend omits the balance', () => undefined, { ...CREDITS, balance: null }],
  ])('renders nothing when %s', (_label, setup, credits) => {
    setup();
    mockCredits.mockReturnValue(loaded(credits));
    const { container } = render(<DiscountCreditsCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
