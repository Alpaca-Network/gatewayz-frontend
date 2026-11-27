import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardAutoTopUpCard, TITLE, parseDollarsToCents } from '../CardAutoTopUpCard';

const mockAuthRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  makeAuthenticatedRequest: (...args: unknown[]) => mockAuthRequest(...args),
}));

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body }) as Response;

const STATUS = {
  feature_enabled: true,
  card: { brand: 'visa', last4: '4242', exp_month: 1, exp_year: 2031 },
  auto_topup: { enabled: false, amount_cents: 2000, daily_limit_cents: 10000, paused_reason: null, charged_today_cents: 0 },
  limits: { min_amount_cents: 500, max_amount_cents: 50000, max_daily_limit_cents: 10000, default_amount_cents: 2000 },
};

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CardAutoTopUpCard />
    </QueryClientProvider>,
  );
}

// Radix Switch measures itself; jsdom has no ResizeObserver.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= NoopResizeObserver;

const OLD_ENV = process.env.NEXT_PUBLIC_CARD_AUTO_TOPUP_ENABLED;

beforeEach(() => {
  mockAuthRequest.mockReset();
  process.env.NEXT_PUBLIC_CARD_AUTO_TOPUP_ENABLED = 'true';
});

afterAll(() => {
  process.env.NEXT_PUBLIC_CARD_AUTO_TOPUP_ENABLED = OLD_ENV;
});

it('renders nothing and fetches nothing with the build flag off', () => {
  process.env.NEXT_PUBLIC_CARD_AUTO_TOPUP_ENABLED = 'false';
  const { container } = renderCard();
  expect(container).toBeEmptyDOMElement();
  expect(mockAuthRequest).not.toHaveBeenCalled();
});

it('renders nothing when the backend reports the feature off', async () => {
  mockAuthRequest.mockResolvedValue(json({ data: { ...STATUS, feature_enabled: false } }));
  const { container } = renderCard();
  await waitFor(() => expect(mockAuthRequest).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it('shows the saved card and saves settings in cents', async () => {
  mockAuthRequest.mockResolvedValueOnce(json({ data: STATUS }));
  renderCard();
  expect(await screen.findByText(TITLE)).toBeInTheDocument();
  expect(screen.getByText(/Visa ending in 4242/)).toBeInTheDocument();

  mockAuthRequest.mockResolvedValueOnce(json({ data: { ...STATUS, auto_topup: { ...STATUS.auto_topup, enabled: true } } }));
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.change(screen.getByLabelText('Top-up amount (USD)'), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockAuthRequest).toHaveBeenCalledTimes(2));
  const [url, init] = mockAuthRequest.mock.calls[1];
  expect(url).toMatch(/\/user\/billing\/auto-topup$/);
  expect(JSON.parse(init.body)).toEqual({ enabled: true, amount_cents: 2500, daily_limit_cents: 10000 });
});

it('refuses an amount outside the range without calling the backend', async () => {
  mockAuthRequest.mockResolvedValueOnce(json({ data: STATUS }));
  renderCard();
  await screen.findByText(TITLE);
  fireEvent.change(screen.getByLabelText('Top-up amount (USD)'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('between $5.00 and $500.00');
  expect(mockAuthRequest).toHaveBeenCalledTimes(1);
});

it('explains a pause', async () => {
  mockAuthRequest.mockResolvedValueOnce(
    json({ data: { ...STATUS, auto_topup: { ...STATUS.auto_topup, paused_reason: 'declined' } } }),
  );
  renderCard();
  expect(await screen.findByRole('status')).toHaveTextContent('declined');
});

it('parses dollar amounts', () => {
  expect(parseDollarsToCents('20')).toBe(2000);
  expect(parseDollarsToCents('20.5')).toBe(2050);
  expect(parseDollarsToCents('20.555')).toBeNull();
  expect(parseDollarsToCents('-1')).toBeNull();
});
