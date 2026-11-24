import {
  CardanoLinkApiError,
  cardanoLinkRefusalOf,
  describeCardanoLinkError,
  linkCardanoStakeAddress,
  requestCardanoLinkNonce,
} from '../cardano-link-api';

const mockAuthRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  makeAuthenticatedRequest: (...args: unknown[]) => mockAuthRequest(...args),
}));

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body }) as Response;

describe('endpoints', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws CardanoLinkApiError with the backend detail', async () => {
    mockAuthRequest.mockResolvedValue(json({ error: { message: 'nope' } }, 503));
    await expect(requestCardanoLinkNonce('stake1u')).rejects.toMatchObject({ status: 503, detail: 'nope' });
  });

  it('maps a 401 proof failure on link by status', async () => {
    mockAuthRequest.mockResolvedValue(
      json({ error: { type: 'authentication_error', message: 'Invalid', detail: 'address_mismatch' } }, 401),
    );
    const error = await linkCardanoStakeAddress({ stakeAddress: 'stake1u', signature: 'x', key: 'y' }).catch((e) => e);
    expect(error).toBeInstanceOf(CardanoLinkApiError);
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

  it('sends the eligibility confirmation on the nonce and link calls, with or without the envelope', async () => {
    mockAuthRequest
      .mockResolvedValueOnce(json({ data: { nonce: 'n1', message: 'Link stake1u' } }))
      .mockResolvedValueOnce(json({ wallet: { wallet_address: 'stake1u' } }));
    await requestCardanoLinkNonce('stake1u', true);
    await linkCardanoStakeAddress({ stakeAddress: 'stake1u', signature: '84a4', key: 'a401', notUsCaPerson: true });
    expect(JSON.parse(mockAuthRequest.mock.calls[0][1].body).not_us_ca_person).toBe(true);
    expect(JSON.parse(mockAuthRequest.mock.calls[1][1].body).not_us_ca_person).toBe(true);
  });

  it.each([
    ['region_restricted', 'region_restricted'],
    ['attestation_required', 'attestation_required'],
  ])('reads a 451 %s refusal from the error envelope', async (type, refusal) => {
    mockAuthRequest.mockResolvedValueOnce(
      json({ error: { type, code: type.toUpperCase(), message: 'Refused', status: 451 } }, 451),
    );
    const error = await requestCardanoLinkNonce('stake1u').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CardanoLinkApiError);
    expect((error as CardanoLinkApiError).code).toBe(type);
    expect(cardanoLinkRefusalOf(error)).toBe(refusal);
  });

  it('also reads a refusal nested under detail', async () => {
    mockAuthRequest.mockResolvedValueOnce(json({ detail: { error: { type: 'region_restricted', message: 'No' } } }, 451));
    const error = await requestCardanoLinkNonce('stake1u').catch((e: unknown) => e);
    expect(cardanoLinkRefusalOf(error)).toBe('region_restricted');
  });

  it('rejects a nonce response without a message', async () => {
    mockAuthRequest.mockResolvedValue(json({ nonce: 'n1' }));
    await expect(requestCardanoLinkNonce('stake1u')).rejects.toBeInstanceOf(CardanoLinkApiError);
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
    expect(describeCardanoLinkError(new CardanoLinkApiError(status, ''))).toMatch(pattern);
  });

  it('maps the 451 refusals', () => {
    expect(describeCardanoLinkError(new CardanoLinkApiError(451, '', 'region_restricted'))).toMatch(/not available in your region/);
    expect(describeCardanoLinkError(new CardanoLinkApiError(451, '', 'attestation_required'))).toMatch(/Confirm you are not/);
  });
});
