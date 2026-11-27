import {
  CardAutoTopUpError,
  confirmCardSetup,
  createCardSetupSession,
  getCardStatus,
  parseCardStatus,
  setAutoTopUp,
} from '../api';

const mockAuthRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  makeAuthenticatedRequest: (...args: unknown[]) => mockAuthRequest(...args),
}));

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body }) as Response;

const WIRE = {
  feature_enabled: true,
  card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
  auto_topup: { enabled: true, amount_cents: 2000, daily_limit_cents: 10000, paused_reason: null, charged_today_cents: 2000 },
  limits: { min_amount_cents: 500, max_amount_cents: 50000, max_daily_limit_cents: 10000, default_amount_cents: 2000 },
};

beforeEach(() => mockAuthRequest.mockReset());

describe('parseCardStatus', () => {
  it('reads the backend shape', () => {
    const s = parseCardStatus(WIRE);
    expect(s.feature_enabled).toBe(true);
    expect(s.card).toEqual({ brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 });
    expect(s.auto_topup?.amount_cents).toBe(2000);
    expect(s.limits.max_daily_limit_cents).toBe(10000);
  });

  it('treats a missing or false switch as off and tolerates junk', () => {
    const s = parseCardStatus({ card: 'x', auto_topup: [], limits: null });
    expect(s.feature_enabled).toBe(false);
    expect(s.card).toBeNull();
    expect(s.auto_topup).toBeNull();
    expect(s.limits.min_amount_cents).toBe(500);
  });
});

describe('calls', () => {
  it('unwraps {success, data}', async () => {
    mockAuthRequest.mockResolvedValue(json({ success: true, data: WIRE }));
    const s = await getCardStatus();
    expect(s.card?.last4).toBe('4242');
    expect(mockAuthRequest.mock.calls[0][0]).toMatch(/\/user\/billing\/card$/);
  });

  it('returns the Checkout URL', async () => {
    mockAuthRequest.mockResolvedValue(json({ data: { session_id: 'cs_test_1', url: 'https://checkout.example/x' } }));
    await expect(createCardSetupSession()).resolves.toBe('https://checkout.example/x');
    expect(mockAuthRequest.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('sends the session id to confirm', async () => {
    mockAuthRequest.mockResolvedValue(json({ data: WIRE }));
    await confirmCardSetup('cs_test_1');
    expect(JSON.parse(mockAuthRequest.mock.calls[0][1].body)).toEqual({ session_id: 'cs_test_1' });
  });

  it('raises the backend error code', async () => {
    mockAuthRequest.mockResolvedValue(json({ detail: 'card_required' }, 409));
    const err = await setAutoTopUp({ enabled: true }).catch((e) => e);
    expect(err).toBeInstanceOf(CardAutoTopUpError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('card_required');
  });
});
