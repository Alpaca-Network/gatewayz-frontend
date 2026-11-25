import {
  DiscountCreditsDailyCapError,
  getDiscountCredits,
  parseDailyCap,
  parseDiscountCredits,
  setDiscountCreditsDailyCap,
} from '../api';

const mockAuthRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  makeAuthenticatedRequest: (...args: unknown[]) => mockAuthRequest(...args),
}));

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body }) as Response;

const DISCLAIMER = 'Terms are set by Gatewayz and can change at any time.';

// As the backend sends it: Decimal-as-string numbers.
const BODY = {
  discount: {
    enabled: true,
    discount_percent: '0.99',
    balance_usd: '12.345678',
    lifetime_granted_usd: '20.000000',
    lifetime_used_usd: '7.654322',
  },
  discount_history: [
    { created_at: '2026-10-11T02:00:00+00:00', kind: 'use', amount_usd: '-0.000123', balance_after: '12.345678', ref: 'req' },
    { created_at: null, kind: 'grant', amount_usd: '0.399000', balance_after: null },
  ],
  disclaimer: DISCLAIMER,
};

describe('parseDiscountCredits', () => {
  it('normalizes the balance, history and disclaimer', () => {
    expect(parseDiscountCredits(BODY)).toEqual({
      balance: {
        enabled: true,
        discount_percent: 0.99,
        balance_usd: 12.345678,
        lifetime_granted_usd: 20,
        lifetime_used_usd: 7.654322,
        daily_cap: null,
      },
      history: [
        { created_at: '2026-10-11T02:00:00+00:00', kind: 'use', amount_usd: -0.000123, balance_after: 12.345678, ref: 'req' },
        { created_at: null, kind: 'grant', amount_usd: 0.399, balance_after: null, ref: null },
      ],
      disclaimer: DISCLAIMER,
    });
  });

  it('has no balance or history when the backend omits them', () => {
    expect(parseDiscountCredits({})).toEqual({ balance: null, history: [], disclaimer: '' });
  });

  it('scales a percent, and drops unusable values', () => {
    expect(parseDiscountCredits({ discount: { discount_percent: '99.00' } }).balance?.discount_percent).toBe(0.99);
    expect(parseDiscountCredits({ discount: { discount_percent: '-1' } }).balance?.discount_percent).toBeNull();
    expect(parseDiscountCredits({ discount: { discount_percent: 150 } }).balance?.discount_percent).toBeNull();
  });

  it('keeps a null discount_percent as null (accounts the switch does not apply to)', () => {
    expect(parseDiscountCredits({ discount: { enabled: false, discount_percent: null } }).balance).toMatchObject({
      enabled: false,
      discount_percent: null,
    });
    expect(parseDiscountCredits({ discount: { enabled: true, discount_percent: null } }).balance?.discount_percent).toBeNull();
  });

  it('treats a malformed balance as absent or off', () => {
    expect(parseDiscountCredits({ discount: 'yes' }).balance).toBeNull();
    expect(parseDiscountCredits({ discount: [] }).balance).toBeNull();
    expect(parseDiscountCredits({ discount: { enabled: 'true', balance_usd: '-5' } }).balance).toMatchObject({
      enabled: false,
      balance_usd: 0,
      discount_percent: null,
    });
    expect(parseDiscountCredits({ discount_history: {} }).history).toEqual([]);
  });
});

describe('getDiscountCredits', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads the balance with the bearer helper, with or without the {success, data} envelope', async () => {
    mockAuthRequest.mockResolvedValueOnce(json({ success: true, data: BODY })).mockResolvedValueOnce(json(BODY));
    expect((await getDiscountCredits()).balance?.balance_usd).toBe(12.345678);
    expect((await getDiscountCredits()).history).toHaveLength(2);
    expect(mockAuthRequest).toHaveBeenCalledTimes(2);
  });

  it('throws on a failed response', async () => {
    mockAuthRequest.mockResolvedValue(json({ error: { message: 'nope' } }, 503));
    await expect(getDiscountCredits()).rejects.toThrow(/503/);
  });
});

const DAILY_CAP = {
  daily_cap_usd: '50.000000',
  used_today_usd: '12.500000',
  left_today_usd: '37.500000',
  resets_at: '2026-11-26T00:00:00Z',
  next_daily_cap_usd: null,
  next_daily_cap_from: null,
};

describe('daily limit parsing', () => {
  it('reads a daily limit with numbers as numbers', () => {
    const parsed = parseDiscountCredits({ discount: { ...BODY.discount, daily_cap: DAILY_CAP } });
    expect(parsed.balance?.daily_cap).toEqual({
      daily_cap_usd: 50,
      used_today_usd: 12.5,
      left_today_usd: 37.5,
      resets_at: '2026-11-26T00:00:00Z',
      next_daily_cap_usd: null,
      next_daily_cap_from: null,
    });
  });

  it('has no daily limit when the backend does not send one yet', () => {
    expect(parseDiscountCredits(BODY).balance?.daily_cap).toBeNull();
    expect(parseDiscountCredits({ discount: { ...BODY.discount, daily_cap: null } }).balance?.daily_cap).toBeNull();
    expect(parseDailyCap('50')).toBeNull();
    expect(parseDailyCap([])).toBeNull();
  });

  it('has no daily limit when daily_cap_usd is null', () => {
    expect(parseDailyCap({ ...DAILY_CAP, daily_cap_usd: null, resets_at: null })).toBeNull();
  });

  it('keeps a limit of 0', () => {
    expect(parseDailyCap({ ...DAILY_CAP, daily_cap_usd: '0', used_today_usd: '0', left_today_usd: '0' })).toMatchObject({
      daily_cap_usd: 0,
      left_today_usd: 0,
    });
  });

  it('reads a pending raise', () => {
    expect(parseDailyCap({ ...DAILY_CAP, next_daily_cap_usd: '80.000000', next_daily_cap_from: '2026-11-26' })).toMatchObject({
      daily_cap_usd: 50,
      next_daily_cap_usd: 80,
      next_daily_cap_from: '2026-11-26',
    });
  });
});

describe('setDiscountCreditsDailyCap', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const sentBody = (call = 0) => JSON.parse(mockAuthRequest.mock.calls[call][1].body);

  it('PUTs the limit as a string with the bearer helper and returns the result', async () => {
    mockAuthRequest.mockResolvedValue(json({ success: true, data: { status: 'set', daily_cap: { ...DAILY_CAP, daily_cap_usd: '20' } } }));
    const result = await setDiscountCreditsDailyCap(20);
    const [url, options] = mockAuthRequest.mock.calls[0];
    expect(url).toMatch(/\/discount-credits\/daily-cap$/);
    expect(options.method).toBe('PUT');
    expect(sentBody()).toEqual({ daily_cap_usd: '20' });
    expect(result.status).toBe('set');
    expect(result.daily_cap?.daily_cap_usd).toBe(20);
  });

  it('sends strings as given and small numbers without an exponent', async () => {
    mockAuthRequest.mockResolvedValue(json({ success: true, data: { status: 'set', daily_cap: DAILY_CAP } }));
    await setDiscountCreditsDailyCap(' 12.50 ');
    await setDiscountCreditsDailyCap(0.000001);
    await setDiscountCreditsDailyCap(0);
    expect(sentBody(0)).toEqual({ daily_cap_usd: '12.50' });
    expect(sentBody(1)).toEqual({ daily_cap_usd: '0.000001' });
    expect(sentBody(2)).toEqual({ daily_cap_usd: '0' });
  });

  it('reports a scheduled raise', async () => {
    mockAuthRequest.mockResolvedValue(
      json({ success: true, data: { status: 'scheduled', daily_cap: { ...DAILY_CAP, next_daily_cap_usd: '80', next_daily_cap_from: '2026-11-26' } } }),
    );
    const result = await setDiscountCreditsDailyCap('80');
    expect(result.status).toBe('scheduled');
    expect(result.daily_cap?.next_daily_cap_usd).toBe(80);
  });

  it.each([
    [422, 'invalid_value'],
    [404, 'discount_credits_not_enabled'],
    [503, 'discount_credits_unavailable'],
    [500, 'unknown'],
  ])('maps a %i response to %s', async (status, code) => {
    mockAuthRequest.mockResolvedValue(json({ detail: 'x' }, status));
    const error = await setDiscountCreditsDailyCap('20').catch((e) => e);
    expect(error).toBeInstanceOf(DiscountCreditsDailyCapError);
    expect(error).toMatchObject({ status, code });
    expect(error.message).toMatch(String(status));
  });
});
