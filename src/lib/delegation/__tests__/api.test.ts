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

const STATUS = {
  enabled: true,
  eth: { vault_address: '0xabc', chain_id: 1, fee_percent: '5' },
  cardano: { pool_id: 'pool1xyz' },
  allowance_rates: [{ asset: 'ETH', credits_per_1k_usd_per_day: '1.5' }],
  disclaimer: 'Not guaranteed.',
};

describe('parseDelegationStatus', () => {
  it('parses string decimals and keeps targets', () => {
    expect(parseDelegationStatus(STATUS)).toEqual({
      enabled: true,
      eth: { vault_address: '0xabc', chain_id: 1, fee_percent: 5 },
      cardano: { pool_id: 'pool1xyz' },
      allowance_rates: [{ asset: 'ETH', credits_per_1k_usd_per_day: 1.5 }],
      disclaimer: 'Not guaranteed.',
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
  it('normalizes positions, allowance, totals and history', () => {
    const parsed = parseDelegationRewards({
      enabled: true,
      positions: [{ asset: 'ADA', wallet_address: 'stake1u', amount: '100', usd_value: '50', measured_at: '2026-10-08' }],
      allowance: { credits_per_day_estimate: '0.25', month_estimate_usd: '7.5' },
      totals: { pending: '1', paid: '2' },
      history: [{ reward_date: '2026-10-07', asset: 'ADA', credits: '0.25', status: 'paid' }],
    });
    expect(parsed.positions[0]).toEqual({
      asset: 'ADA',
      wallet_address: 'stake1u',
      amount: 100,
      usd_value: 50,
      measured_at: '2026-10-08',
    });
    expect(parsed.allowance).toEqual({ credits_per_day_estimate: 0.25, month_estimate_usd: 7.5 });
    expect(parsed.totals).toEqual({ pending: 1, paid: 2 });
    expect(parsed.history).toEqual([{ date: '2026-10-07', asset: 'ADA', credits: 0.25, status: 'paid' }]);
  });
});

describe('endpoints', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('reads /delegation/status publicly, with or without the {success, data} envelope', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ success: true, data: STATUS })).mockResolvedValueOnce(json(STATUS));
    expect((await getDelegationStatus()).eth.vault_address).toBe('0xabc');
    expect((await getDelegationStatus()).cardano.pool_id).toBe('pool1xyz');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/delegation\/status$/);
    expect(mockAuthRequest).not.toHaveBeenCalled();
  });

  it('reads /delegation/rewards with the bearer helper', async () => {
    mockAuthRequest.mockResolvedValue(json({ data: { enabled: true, positions: [] } }));
    expect((await getDelegationRewards()).enabled).toBe(true);
    expect(mockAuthRequest.mock.calls[0][0]).toMatch(/\/delegation\/rewards$/);
  });

  it('throws DelegationApiError with the backend detail', async () => {
    mockAuthRequest.mockResolvedValue(json({ error: { message: 'nope' } }, 503));
    await expect(getDelegationRewards()).rejects.toMatchObject({ status: 503, detail: 'nope' });
  });

  it('posts the stake address for a nonce and the COSE pair to link', async () => {
    mockAuthRequest
      .mockResolvedValueOnce(json({ nonce: 'n1', message: 'Link stake1u', expires_at: '2026-10-08T00:05:00Z' }))
      .mockResolvedValueOnce(json({ success: true }));
    const nonce = await requestCardanoLinkNonce('stake1u');
    expect(nonce).toEqual({ nonce: 'n1', message: 'Link stake1u', expires_at: '2026-10-08T00:05:00Z' });
    await linkCardanoStakeAddress({ stakeAddress: 'stake1u', signature: '84a4', key: 'a401' });

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
    [429, /Too many/],
  ])('maps %s', (status, pattern) => {
    expect(describeCardanoLinkError(new DelegationApiError(status, ''))).toMatch(pattern);
  });
});
