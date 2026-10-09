import {
  DelegationApiError,
  describeCardanoLinkError,
  getDelegationRewards,
  getDelegationStatus,
  linkCardanoStakeAddress,
  parseDelegationRewards,
  parseDelegationStatus,
  requestCardanoLinkNonce,
} from '../api';

const mockAuthRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  makeAuthenticatedRequest: (...args: unknown[]) => mockAuthRequest(...args),
}));

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body }) as Response;

const DISCLAIMER = 'Rates are set by Gatewayz, can change at any time, and are not a guaranteed return.';

// Shapes as gatewayz-backend src/routes/delegation.py (PR #2388) sends them:
// lowercase asset ids, Decimal-as-string numbers, fee_percent "99.00".
const STATUS = {
  enabled: true,
  eth: { vault_address: '0xabc', chain_id: 1, fee_percent: '99.00' },
  cardano: { pool_id: 'pool1xyz' },
  allowance_rates: [{ asset: 'eth', credits_per_1k_usd_per_day: '1.500000' }],
  disclaimer: DISCLAIMER,
};

// The backend while dark.
const DARK_STATUS = {
  enabled: false,
  eth: { vault_address: null, chain_id: 1, fee_percent: null },
  cardano: { pool_id: null },
  allowance_rates: [],
  disclaimer: DISCLAIMER,
};

const REWARDS = {
  enabled: true,
  linked_wallets: [
    { asset: 'eth', wallet_address: '0x2222222222222222222222222222222222222222' },
    { asset: 'ada', wallet_address: 'stake1u9ylzsgxaa6xctf4juup682ar3juj85n8tx3hthnljg47zctvm3rc' },
  ],
  positions: [
    {
      asset: 'eth',
      wallet_address: '0x2222222222222222222222222222222222222222',
      amount: '1.500000000000000000',
      usd_value: '4500.00',
      measured_at: '2026-10-08T12:00:00+00:00',
    },
  ],
  allowance: { credits_per_day_estimate: '6.750000', month_estimate_usd: '202.500000', daily_cap_credits: '100' },
  totals: { pending: '6.75', paid: '13.5' },
  history: [
    {
      reward_date: '2026-10-07',
      asset: 'eth',
      wallet_address: '0x2222222222222222222222222222222222222222',
      usd_basis: '4400.00',
      credits: '6.600000',
      status: 'claimed',
    },
  ],
  disclaimer: DISCLAIMER,
};

describe('parseDelegationStatus', () => {
  it('parses string decimals, uppercases assets and keeps targets', () => {
    expect(parseDelegationStatus(STATUS)).toEqual({
      enabled: true,
      eth: { vault_address: '0xabc', chain_id: 1, fee_percent: 99 },
      cardano: { pool_id: 'pool1xyz' },
      allowance_rates: [{ asset: 'ETH', credits_per_1k_usd_per_day: 1.5 }],
      disclaimer: DISCLAIMER,
    });
  });

  it('reads the dark backend as off with no targets', () => {
    expect(parseDelegationStatus(DARK_STATUS)).toMatchObject({
      enabled: false,
      eth: { vault_address: null, fee_percent: null },
      cardano: { pool_id: null },
      allowance_rates: [],
    });
  });

  it('treats anything malformed as off with no targets', () => {
    const parsed = parseDelegationStatus({ enabled: 'yes', eth: { vault_address: '' }, cardano: null });
    expect(parsed.enabled).toBe(false);
    expect(parsed.eth.vault_address).toBeNull();
    expect(parsed.cardano.pool_id).toBeNull();
    expect(parsed.allowance_rates).toEqual([]);
  });
});

describe('parseDelegationRewards', () => {
  it('normalizes the backend body', () => {
    const parsed = parseDelegationRewards(REWARDS);
    expect(parsed.linked_wallets).toEqual([
      { asset: 'ETH', wallet_address: '0x2222222222222222222222222222222222222222' },
      { asset: 'ADA', wallet_address: 'stake1u9ylzsgxaa6xctf4juup682ar3juj85n8tx3hthnljg47zctvm3rc' },
    ]);
    expect(parsed.positions).toEqual([
      {
        asset: 'ETH',
        wallet_address: '0x2222222222222222222222222222222222222222',
        amount: 1.5,
        usd_value: 4500,
        measured_at: '2026-10-08T12:00:00+00:00',
      },
    ]);
    expect(parsed.allowance).toEqual({ credits_per_day_estimate: 6.75, month_estimate_usd: 202.5, daily_cap_credits: 100 });
    expect(parsed.totals).toEqual({ pending: 6.75, paid: 13.5 });
    expect(parsed.history).toEqual([
      {
        date: '2026-10-07',
        asset: 'ETH',
        wallet_address: '0x2222222222222222222222222222222222222222',
        usd_basis: 4400,
        credits: 6.6,
        status: 'claimed',
      },
    ]);
    expect(parsed.disclaimer).toBe(DISCLAIMER);
    expect(parsed.exit_requests).toEqual([]);
  });

  it('drops linked wallets without an address', () => {
    expect(parseDelegationRewards({ linked_wallets: [{ asset: 'eth', wallet_address: '' }] }).linked_wallets).toEqual([]);
  });
});

describe('endpoints', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('reads /delegation/status publicly, with or without the {success, data} envelope', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(json({ success: true, data: STATUS }))
      .mockResolvedValueOnce(json(STATUS));
    expect((await getDelegationStatus()).eth.vault_address).toBe('0xabc');
    expect((await getDelegationStatus()).cardano.pool_id).toBe('pool1xyz');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/delegation\/status$/);
    expect(mockAuthRequest).not.toHaveBeenCalled();
  });

  it('reads /delegation/rewards with the bearer helper', async () => {
    mockAuthRequest.mockResolvedValue(json({ success: true, data: REWARDS }));
    const rewards = await getDelegationRewards();
    expect(rewards.enabled).toBe(true);
    expect(rewards.linked_wallets).toHaveLength(2);
    expect(mockAuthRequest.mock.calls[0][0]).toMatch(/\/delegation\/rewards$/);
  });

  it('throws DelegationApiError with the backend detail', async () => {
    mockAuthRequest.mockResolvedValue(json({ error: { message: 'nope' } }, 503));
    await expect(getDelegationRewards()).rejects.toMatchObject({ status: 503, detail: 'nope' });
  });

  it('maps a 401 proof failure on link by status', async () => {
    mockAuthRequest.mockResolvedValue(
      json({ error: { type: 'authentication_error', message: 'Invalid', detail: 'address_mismatch' } }, 401),
    );
    const error = await linkCardanoStakeAddress({ stakeAddress: 'stake1u', signature: 'x', key: 'y' }).catch((e) => e);
    expect(error).toBeInstanceOf(DelegationApiError);
    expect(describeCardanoLinkError(error)).toMatch(/could not be verified/);
  });

  it('posts the stake address for a nonce and the COSE pair to link', async () => {
    mockAuthRequest
      .mockResolvedValueOnce(
        json({ success: true, data: { nonce: 'n1', message: 'Link stake1u', payload_hex: '4c696e6b', expires_at: '2026-10-08T00:05:00Z' } }),
      )
      .mockResolvedValueOnce(
        json({
          success: true,
          data: {
            wallet: {
              wallet_address: 'stake1u',
              chain_namespace: 'cip34',
              source: 'cip30',
              is_primary: false,
            },
          },
        }),
      );
    const nonce = await requestCardanoLinkNonce('stake1u');
    expect(nonce).toEqual({ nonce: 'n1', message: 'Link stake1u', payload_hex: '4c696e6b', expires_at: '2026-10-08T00:05:00Z' });
    await expect(linkCardanoStakeAddress({ stakeAddress: 'stake1u', signature: '84a4', key: 'a401' })).resolves.toEqual({
      wallet_address: 'stake1u',
      chain_namespace: 'cip34',
    });

    const [nonceUrl, nonceInit] = mockAuthRequest.mock.calls[0];
    expect(nonceUrl).toMatch(/\/auth\/wallet\/cardano\/nonce$/);
    expect(JSON.parse(nonceInit.body)).toEqual({ stake_address: 'stake1u' });
    const [linkUrl, linkInit] = mockAuthRequest.mock.calls[1];
    expect(linkUrl).toMatch(/\/auth\/wallet\/cardano\/link$/);
    expect(JSON.parse(linkInit.body)).toEqual({ stake_address: 'stake1u', signature: '84a4', key: 'a401' });
  });

  it('rejects a nonce response without a message', async () => {
    mockAuthRequest.mockResolvedValue(json({ nonce: 'n1' }));
    await expect(requestCardanoLinkNonce('stake1u')).rejects.toBeInstanceOf(DelegationApiError);
  });
});

describe('describeCardanoLinkError', () => {
  it.each([
    [400, /expired/],
    [401, /could not be verified/],
    [409, /another Gatewayz account/],
    [422, /cannot be linked/],
    [429, /Too many/],
  ])('maps %s', (status, pattern) => {
    expect(describeCardanoLinkError(new DelegationApiError(status, ''))).toMatch(pattern);
  });
});
