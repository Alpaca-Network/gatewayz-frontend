import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DailyLimitSection } from '../DailyLimitSection';
import type { DiscountCreditsDailyCap } from '@/lib/discount-credits/api';

// The real hook and API client run; only the bearer helper is replaced.
const mockAuthRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  makeAuthenticatedRequest: (...args: unknown[]) => mockAuthRequest(...args),
}));

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body }) as Response;

const CAP: DiscountCreditsDailyCap = {
  daily_cap_usd: 50,
  used_today_usd: 12.5,
  left_today_usd: 37.5,
  resets_at: '2026-11-26T00:00:00Z',
  next_daily_cap_usd: null,
  next_daily_cap_from: null,
};

const WIRE_CAP = { daily_cap_usd: '20.000000', used_today_usd: '12.500000', left_today_usd: '7.500000', resets_at: '2026-11-26T00:00:00Z' };

function renderSection(dailyCap: DiscountCreditsDailyCap = CAP) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <DailyLimitSection dailyCap={dailyCap} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

function save(value: string) {
  fireEvent.change(screen.getByLabelText('Daily limit (USD)'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

describe('DailyLimitSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows what was used today against the limit, with a labelled progress bar', () => {
    renderSection();
    expect(screen.getByText('Daily limit')).toBeInTheDocument();
    expect(screen.getByText('$12.50 of $50.00 used today')).toBeInTheDocument();
    expect(screen.getByText('Resets at 00:00 UTC')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Daily limit' });
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuetext', '$12.50 of $50.00 used today');
    expect(screen.queryByText(/Changes to/)).not.toBeInTheDocument();
    expect(screen.getByText(/Lowering the limit applies now\. Raising it applies from the next day \(UTC\)\./)).toBeInTheDocument();
    expect(screen.getByText(/requests continue and are billed to your paid balance\./)).toBeInTheDocument();
  });

  it('offers the current limit in a number input', () => {
    renderSection();
    const input = screen.getByLabelText('Daily limit (USD)');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('step', '0.01');
    expect(input).toHaveValue(50);
  });

  it('shows a pending raise with its UTC start date', () => {
    renderSection({ ...CAP, next_daily_cap_usd: 80, next_daily_cap_from: '2026-11-26' });
    expect(screen.getByText('Changes to $80.00 on Nov 26, 2026 (UTC)')).toBeInTheDocument();
  });

  it('shows a full bar for a limit of 0', () => {
    renderSection({ ...CAP, daily_cap_usd: 0, used_today_usd: 0, left_today_usd: 0 });
    expect(screen.getByText('$0.00 of $0.00 used today')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it.each(['-1', '1000000.01', '1000001', '0.0000001', ''])('refuses %p without calling the API', (value) => {
    renderSection();
    save(value);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount from 0 to 1,000,000, with up to 6 decimal places.');
    expect(mockAuthRequest).not.toHaveBeenCalled();
  });

  it.each(['0', '1000000', '0.000001'])('accepts %p', async (value) => {
    mockAuthRequest.mockResolvedValue(json({ success: true, data: { status: 'set', daily_cap: WIRE_CAP } }));
    renderSection();
    save(value);
    await screen.findByRole('status');
    expect(JSON.parse(mockAuthRequest.mock.calls[0][1].body)).toEqual({ daily_cap_usd: value });
  });

  it('saves a lower limit, disables the button meanwhile, and says it is updated', async () => {
    let finish: (r: Response) => void = () => undefined;
    mockAuthRequest.mockReturnValue(new Promise<Response>((resolve) => (finish = resolve)));
    const { invalidate } = renderSection();
    save('20');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    const [url, options] = mockAuthRequest.mock.calls[0];
    expect(url).toMatch(/\/discount-credits\/daily-cap$/);
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ daily_cap_usd: '20' });

    finish(json({ success: true, data: { status: 'set', daily_cap: WIRE_CAP } }));
    expect(await screen.findByRole('status')).toHaveTextContent('Daily limit updated.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['discount-credits'] });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says when a higher limit starts', async () => {
    mockAuthRequest.mockResolvedValue(
      json({ success: true, data: { status: 'scheduled', daily_cap: { ...WIRE_CAP, next_daily_cap_usd: '80', next_daily_cap_from: '2026-11-26' } } }),
    );
    renderSection();
    save('80');
    expect(await screen.findByRole('status')).toHaveTextContent('Your higher limit starts at 00:00 UTC.');
  });

  it.each([422, 404, 503])('says the limit could not be saved on a %i response', async (status) => {
    mockAuthRequest.mockResolvedValue(json({ detail: 'x' }, status));
    const { invalidate } = renderSection();
    save('20');
    expect(await screen.findByRole('alert')).toHaveTextContent('The daily limit could not be saved. Try again.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('replaces an earlier result with the validation message', async () => {
    mockAuthRequest.mockResolvedValue(json({ success: true, data: { status: 'set', daily_cap: WIRE_CAP } }));
    renderSection();
    save('20');
    await screen.findByRole('status');
    save('-5');
    expect(screen.getByRole('alert')).toHaveTextContent(/Enter an amount/);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mockAuthRequest).toHaveBeenCalledTimes(1);
  });
});
