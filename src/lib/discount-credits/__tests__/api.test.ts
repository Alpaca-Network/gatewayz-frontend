import { getDiscountCredits, parseDiscountCredits } from '../api';

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
