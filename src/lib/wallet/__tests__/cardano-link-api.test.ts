import {
  CardanoLinkApiError,
  cardanoLinkRefusalOf,
  describeCardanoLinkError,
  describeCardanoUnlinkError,
  getLinkedCardanoWallets,
  isPaymentMethodRequired,
  linkCardanoStakeAddress,
  requestCardanoLinkNonce,
  unlinkCardanoStakeAddress,
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

  it('treats a link response for a different address as a failure', async () => {
    mockAuthRequest.mockResolvedValueOnce(
      json({ success: true, data: { wallet: { wallet_address: 'stake1other', chain_namespace: 'cip34' } } }),
    );
    await expect(
      linkCardanoStakeAddress({ stakeAddress: 'stake1mine', signature: 'aa', key: 'bb' }),
    ).rejects.toThrow(/does not match/);
  });
});

// The 402 body the backend sends once a payment method is required to link
// (gatewayz-backend PR "require a payment method to link a wallet", step 1.5).
// Mocked here so this client does not depend on that PR being deployed.
const PAYMENT_METHOD_REQUIRED_BODY = {
  error: {
    type: 'payment_method_required',
    code: 'PAYMENT_METHOD_REQUIRED',
    message: 'Add a payment method before you link a wallet.',
    status: 402,
  },
};

describe('payment method required', () => {
  afterEach(() => jest.clearAllMocks());

  it.each([
    ['nonce', () => requestCardanoLinkNonce('stake1u', true)],
    ['link', () => linkCardanoStakeAddress({ stakeAddress: 'stake1u', signature: 'aa', key: 'bb', notUsCaPerson: true })],
  ])('reads the typed 402 on %s', async (_name, call) => {
    mockAuthRequest.mockResolvedValueOnce(json(PAYMENT_METHOD_REQUIRED_BODY, 402));
    const error = await call().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CardanoLinkApiError);
    expect(isPaymentMethodRequired(error)).toBe(true);
    expect(cardanoLinkRefusalOf(error)).toBeNull();
    expect(describeCardanoLinkError(error)).toMatch(/payment method/);
  });

  it('is not confused with other errors', () => {
    expect(isPaymentMethodRequired(new CardanoLinkApiError(451, '', 'region_restricted'))).toBe(false);
    expect(isPaymentMethodRequired(new CardanoLinkApiError(402, '', 'something_else'))).toBe(false);
    expect(isPaymentMethodRequired(new Error('payment_method_required'))).toBe(false);
  });

  it('maps an inference key refusal (403)', () => {
    expect(describeCardanoLinkError(new CardanoLinkApiError(403, ''))).toMatch(/Sign in to Gatewayz again/);
  });
});

describe('linked wallets and unlink', () => {
  afterEach(() => jest.clearAllMocks());

  it('lists only the Cardano rows of GET /auth/wallets', async () => {
    mockAuthRequest.mockResolvedValueOnce(
      json({
        success: true,
        data: {
          wallets: [
            { wallet_address: '0xabc', chain_namespace: 'eip155', verified_at: null },
            { wallet_address: 'stake1uabc', chain_namespace: 'cip34', verified_at: '2026-11-20T10:00:00Z' },
            { wallet_address: '', chain_namespace: 'cip34' },
          ],
        },
      }),
    );
    await expect(getLinkedCardanoWallets()).resolves.toEqual([
      { wallet_address: 'stake1uabc', verified_at: '2026-11-20T10:00:00Z' },
    ]);
    expect(mockAuthRequest.mock.calls[0][0]).toMatch(/\/auth\/wallets$/);
  });

  it('returns an empty list when the backend sends no wallets', async () => {
    mockAuthRequest.mockResolvedValueOnce(json({ success: true, data: {} }));
    await expect(getLinkedCardanoWallets()).resolves.toEqual([]);
  });

  it('unlinks with DELETE /auth/wallets/{address}', async () => {
    mockAuthRequest.mockResolvedValueOnce(json({ success: true }));
    await unlinkCardanoStakeAddress('stake1uabc');
    const [url, init] = mockAuthRequest.mock.calls[0];
    expect(url).toMatch(/\/auth\/wallets\/stake1uabc$/);
    expect(init).toEqual({ method: 'DELETE' });
  });

  it('throws on a failed unlink and describes it', async () => {
    mockAuthRequest.mockResolvedValueOnce(json({ error: { type: 'not_found', message: 'wallet_not_linked' } }, 404));
    const error = await unlinkCardanoStakeAddress('stake1uabc').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CardanoLinkApiError);
    expect(describeCardanoUnlinkError(error)).toMatch(/no longer linked/);
    expect(describeCardanoUnlinkError(new Error('x'))).toMatch(/Something went wrong/);
  });
});
