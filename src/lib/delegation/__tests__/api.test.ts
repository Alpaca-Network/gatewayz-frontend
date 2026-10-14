import {
  DelegationApiError,
  attestDelegationEligibility,
  delegationRefusalOf,
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
      // A pre-v3 backend: no discount fields, so the discount stays off.
      payout_model: null,
      reward_share: null,
      discount_percent: null,
      discount_enabled: false,
    });
  });

  it('reads the v3 reward-share fields', () => {
    const parsed = parseDelegationStatus({
      ...STATUS,
      payout_model: 'reward_share',
      reward_share: '0.95',
      discount_percent: '0.99',
      discount_enabled: true,
    });
    expect(parsed).toMatchObject({ payout_model: 'reward_share', reward_share: 0.95, discount_percent: 0.99, discount_enabled: true });
  });

  it('scales a percent, and drops unusable v3 values', () => {
    expect(parseDelegationStatus({ ...STATUS, discount_percent: '99.00', reward_share: 95 })).toMatchObject({
      discount_percent: 0.99,
      reward_share: 0.95,
    });
    expect(
      parseDelegationStatus({ ...STATUS, payout_model: 'other', discount_percent: '-1', reward_share: 'x', discount_enabled: 'true' }),
    ).toMatchObject({ payout_model: null, discount_percent: null, reward_share: null, discount_enabled: false });
    expect(parseDelegationStatus({ ...STATUS, discount_percent: 150 }).discount_percent).toBeNull();
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

  it('has no discount, attributions or history from a pre-v3 backend', () => {
    const parsed = parseDelegationRewards(REWARDS);
    expect(parsed.discount).toBeNull();
    expect(parsed.attributions).toEqual([]);
    expect(parsed.discount_history).toEqual([]);
  });

  it('normalizes the v3 discount, attributions and history', () => {
    const parsed = parseDelegationRewards({
      ...REWARDS,
      discount: {
        enabled: true,
        discount_percent: '0.99',
        reward_share: '0.95',
        balance_usd: '12.345678',
        lifetime_granted_usd: '20.000000',
        lifetime_used_usd: '7.654322',
      },
      attributions: [
        {
          asset: 'eth',
          period_key: '2026-10-10',
          stake_native: '1.500000000000000000',
          attributed_usd: '0.420000',
          discount_usd: '0.399000',
          status: 'granted',
          granted_at: '2026-10-11T01:00:00+00:00',
        },
        { asset: 'ada', period_key: '', discount_usd: '1' },
      ],
      discount_history: [
        { created_at: '2026-10-11T02:00:00+00:00', kind: 'use', amount_usd: '-0.000123', balance_after: '12.345678', ref: 'req' },
        { created_at: null, kind: 'grant', amount_usd: '0.399000', balance_after: null },
      ],
    });
    expect(parsed.discount).toEqual({
      enabled: true,
      discount_percent: 0.99,
      reward_share: 0.95,
      balance_usd: 12.345678,
      lifetime_granted_usd: 20,
      lifetime_used_usd: 7.654322,
    });
    expect(parsed.attributions).toEqual([
      {
        asset: 'ETH',
        period_key: '2026-10-10',
        stake_native: 1.5,
        attributed_usd: 0.42,
        discount_usd: 0.399,
        status: 'granted',
        granted_at: '2026-10-11T01:00:00+00:00',
      },
    ]);
    expect(parsed.discount_history).toEqual([
      { created_at: '2026-10-11T02:00:00+00:00', kind: 'use', amount_usd: -0.000123, balance_after: 12.345678, ref: 'req' },
      { created_at: null, kind: 'grant', amount_usd: 0.399, balance_after: null, ref: null },
    ]);
  });

  it('treats a malformed discount as absent or off', () => {
    expect(parseDelegationRewards({ discount: 'yes' }).discount).toBeNull();
    expect(parseDelegationRewards({ discount: [] }).discount).toBeNull();
    expect(parseDelegationRewards({ discount: { enabled: 'true', balance_usd: '-5' } }).discount).toMatchObject({
      enabled: false,
      balance_usd: 0,
      discount_percent: null,
    });
    expect(parseDelegationRewards({ attributions: 'x', discount_history: {} })).toMatchObject({
      attributions: [],
      discount_history: [],
    });
  });

  it('drops linked wallets without an address', () => {
    expect(parseDelegationRewards({ linked_wallets: [{ asset: 'eth', wallet_address: '' }] }).linked_wallets).toEqual([]);
  });

  it('reads eligibility, null when the backend omits it', () => {
    expect(parseDelegationRewards({}).eligibility).toBeNull();
    expect(parseDelegationRewards({ eligibility: { status: 'restricted', attested_at: null } }).eligibility).toEqual({
      status: 'restricted',
      attested_at: null,
    });
    expect(parseDelegationRewards({ eligibility: { status: 'weird' } }).eligibility).toEqual({ status: 'none', attested_at: null });
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
    expect(JSON.parse(nonceInit.body)).toEqual({ stake_address: 'stake1u', not_us_ca_person: false });
    const [linkUrl, linkInit] = mockAuthRequest.mock.calls[1];
    expect(linkUrl).toMatch(/\/auth\/wallet\/cardano\/link$/);
    expect(JSON.parse(linkInit.body)).toEqual({ stake_address: 'stake1u', signature: '84a4', key: 'a401', not_us_ca_person: false });
  });

  it('sends the eligibility tick on the nonce and link calls', async () => {
    mockAuthRequest
      .mockResolvedValueOnce(json({ data: { nonce: 'n1', message: 'Link stake1u' } }))
      .mockResolvedValueOnce(json({ data: { wallet: { wallet_address: 'stake1u' } } }));
    await requestCardanoLinkNonce('stake1u', true);
    await linkCardanoStakeAddress({ stakeAddress: 'stake1u', signature: '84a4', key: 'a401', notUsCaPerson: true });
    expect(JSON.parse(mockAuthRequest.mock.calls[0][1].body).not_us_ca_person).toBe(true);
    expect(JSON.parse(mockAuthRequest.mock.calls[1][1].body).not_us_ca_person).toBe(true);
  });

  it('posts the attestation to /delegation/eligibility', async () => {
    mockAuthRequest.mockResolvedValueOnce(
      json({ success: true, data: { eligibility: { status: 'eligible', attested_at: '2026-10-14T00:00:00Z' } } }),
    );
    await expect(attestDelegationEligibility()).resolves.toEqual({ status: 'eligible', attested_at: '2026-10-14T00:00:00Z' });
    const [url, init] = mockAuthRequest.mock.calls[0];
    expect(url).toMatch(/\/delegation\/eligibility$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ not_us_ca_person: true });
  });

  it.each([
    ['region_restricted', 'region_restricted'],
    ['attestation_required', 'attestation_required'],
  ])('reads a 451 %s refusal from the error envelope', async (type, refusal) => {
    mockAuthRequest.mockResolvedValueOnce(
      json({ error: { type, code: type.toUpperCase(), message: 'Refused', status: 451 } }, 451),
    );
    const error = await requestCardanoLinkNonce('stake1u').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DelegationApiError);
    expect((error as DelegationApiError).code).toBe(type);
    expect(delegationRefusalOf(error)).toBe(refusal);
  });

  it('also reads a refusal nested under detail', async () => {
    mockAuthRequest.mockResolvedValueOnce(json({ detail: { error: { type: 'region_restricted', message: 'No' } } }, 451));
    const error = await attestDelegationEligibility().catch((e: unknown) => e);
    expect(delegationRefusalOf(error)).toBe('region_restricted');
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

  it('maps the 451 refusals', () => {
    expect(describeCardanoLinkError(new DelegationApiError(451, '', 'region_restricted'))).toMatch(/not available in your region/);
    expect(describeCardanoLinkError(new DelegationApiError(451, '', 'attestation_required'))).toMatch(/Confirm you are not/);
  });
});
