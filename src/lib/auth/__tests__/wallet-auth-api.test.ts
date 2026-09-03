/**
 * Error-body fixtures below mirror the REAL backend envelope, not a flat `{"detail": "..."}`
 * shape — verified against gatewayz-backend's own tests
 * (`tests/routes/test_wallet_auth.py`) and `src/utils/error_handlers.py` /
 * `src/utils/errors.py` (`DetailedErrorFactory`). Every HTTPException this router raises is
 * wrapped as `{"error": {type, message, detail, code, status, context, ...}}` — there is no
 * top-level `detail` field, and `error.code` is a generic code, not the backend's raw reason
 * string. The one exception is the 429 rate-limit body, whose `error` field is a bare string.
 * See wallet-auth-api.ts's `codeFor*Status` doc comment for the full mapping rationale.
 */
import {
  getLinkedWallets,
  requestWalletLinkNonce,
  linkWallet,
  unlinkWallet,
  WalletAuthError,
  describeWalletAuthError,
} from '../wallet-auth-api';
import { createSuccessResponse, createMockResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';
import { saveApiKey } from '@/lib/api';

/** `POST /auth/wallet/link`'s 400 nonce_missing_or_expired — real ErrorResponse envelope
 * (invalid_parameter factory: `context.parameter_value` carries the backend's raw detail). */
const NONCE_EXPIRED_BODY = {
  error: {
    type: 'invalid_request',
    message: 'Invalid request parameter',
    detail: 'nonce_missing_or_expired',
    code: 'INVALID_PARAMETER',
    status: 400,
    context: { parameter_name: 'request', parameter_value: 'nonce_missing_or_expired' },
  },
};

/** 401 invalid_signature — DetailedErrorFactory.invalid_api_key appends the backend's raw
 * `detail` as a suffix on `error.detail`; `error.code` stays the generic INVALID_API_KEY. */
const INVALID_SIGNATURE_BODY = {
  error: {
    type: 'authentication_error',
    message: 'Invalid API key',
    detail: 'Your API key appears to be invalid or malformed. invalid_signature',
    code: 'INVALID_API_KEY',
    status: 401,
    context: {},
  },
};

const SIGNATURE_MISMATCH_BODY = {
  error: {
    type: 'authentication_error',
    message: 'Invalid API key',
    detail: 'Your API key appears to be invalid or malformed. signature_address_mismatch',
    code: 'INVALID_API_KEY',
    status: 401,
    context: {},
  },
};

/** 409 wallet_linked_to_other_account — masked entirely; no explicit 409 branch in
 * `_map_http_exception_to_detailed_error`, falls through to the generic internal_error
 * factory. Status code is the ONLY signal (per the backend's own test comment). */
const WALLET_LINKED_ELSEWHERE_BODY = {
  error: {
    type: 'internal_error',
    message: 'An internal error occurred',
    detail: 'An error occurred while processing your request',
    code: 'INTERNAL_ERROR',
    status: 409,
    context: {},
  },
};

/** DELETE .../{address}'s 400 last_auth_method. */
const LAST_AUTH_METHOD_BODY = {
  error: {
    type: 'invalid_request',
    message: 'Invalid request parameter',
    detail: 'last_auth_method',
    code: 'INVALID_PARAMETER',
    status: 400,
    context: { parameter_name: 'request', parameter_value: 'last_auth_method' },
  },
};

/** 429 — `_enforce_auth_rate_limit`'s body is NOT the ErrorResponse envelope: `error` is a
 * bare string here, not an object. */
const RATE_LIMITED_BODY = {
  error: 'Rate limit exceeded',
  message: 'Too many linking attempts. Please try again in 30 seconds.',
  retry_after: 30,
};

/** POST /auth/wallet/link/nonce's 422 chain_id_not_allowed. */
const CHAIN_ID_NOT_ALLOWED_BODY = {
  error: {
    type: 'invalid_request',
    message: 'Invalid request parameter',
    detail: 'chain_id_not_allowed',
    code: 'INVALID_PARAMETER',
    status: 422,
    context: { parameter_name: 'request', parameter_value: 'chain_id_not_allowed' },
  },
};

/** DELETE .../{address}'s 404 wallet_not_linked. */
const WALLET_NOT_LINKED_BODY = {
  error: {
    type: 'not_found',
    message: 'Resource not found',
    detail: 'wallet_not_linked',
    code: 'MODEL_NOT_FOUND',
    status: 404,
    context: {},
  },
};

describe('wallet-auth-api', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockFetch = setupFetchMock();
    saveApiKey('test-api-key');
  });

  describe('getLinkedWallets', () => {
    it('sends the Bearer header via makeAuthenticatedRequest and unwraps data.wallets', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            wallets: [
              {
                wallet_address: '0xabc0000000000000000000000000000000abcd',
                source: 'privy',
                wallet_client_type: 'privy',
                is_primary: true,
                verified_at: '2026-09-01T00:00:00Z',
              },
            ],
          },
        })
      );

      const result = await getLinkedWallets();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/auth/wallets',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].wallet_address).toBe('0xabc0000000000000000000000000000000abcd');
      expect(result[0].is_primary).toBe(true);
    });
  });

  describe('requestWalletLinkNonce', () => {
    it('POSTs wallet_address and returns the message to sign verbatim', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: { message: 'gatewayz.ai wants you to sign in...', expires_in: 300 },
        })
      );

      const result = await requestWalletLinkNonce('0xabc0000000000000000000000000000000abcd');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.gatewayz.ai/auth/wallet/link/nonce');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ wallet_address: '0xabc0000000000000000000000000000000abcd' });
      expect(result).toEqual({ message: 'gatewayz.ai wants you to sign in...', expires_in: 300 });
    });

    it('includes chain_id in the body when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({ success: true, data: { message: 'msg', expires_in: 300 } })
      );

      await requestWalletLinkNonce('0xabc', 43113);

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ wallet_address: '0xabc', chain_id: 43113 });
    });

    it('maps 422 chain_id_not_allowed to a WalletAuthError with user-facing copy', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(CHAIN_ID_NOT_ALLOWED_BODY, { status: 422, ok: false }));

      await expect(requestWalletLinkNonce('0xabc', 999)).rejects.toMatchObject({
        status: 422,
        code: 'chain_id_not_allowed',
      });
    });

    it('maps 429 (bare-string error body) to rate_limited', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(RATE_LIMITED_BODY, { status: 429, ok: false }));

      await expect(requestWalletLinkNonce('0xabc')).rejects.toMatchObject({
        status: 429,
        code: 'rate_limited',
      });
    });
  });

  describe('linkWallet', () => {
    it('POSTs address/message/signature and returns the linked wallet', async () => {
      const wallet = {
        wallet_address: '0xabc0000000000000000000000000000000abcd',
        source: 'siwe' as const,
        wallet_client_type: 'metamask',
        is_primary: false,
        verified_at: '2026-09-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true, data: { wallet } }));

      const result = await linkWallet('0xabc0000000000000000000000000000000abcd', 'the message', '0xsig');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.gatewayz.ai/auth/wallet/link');
      expect(JSON.parse(options.body)).toEqual({
        wallet_address: '0xabc0000000000000000000000000000000abcd',
        message: 'the message',
        signature: '0xsig',
      });
      expect(result).toEqual(wallet);
    });

    it('maps 409 to wallet_linked_to_other_account from status alone (body carries no signal)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(WALLET_LINKED_ELSEWHERE_BODY, { status: 409, ok: false }));

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 409,
        code: 'wallet_linked_to_other_account',
      });
    });

    it('maps 400 to nonce_missing_or_expired from the real ErrorResponse envelope', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(NONCE_EXPIRED_BODY, { status: 400, ok: false }));

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 400,
        code: 'nonce_missing_or_expired',
      });
    });

    it('maps 401 to invalid_signature by default when the body has no disambiguating hint', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: { type: 'authentication_error', message: 'Invalid API key', detail: 'Invalid API key', code: 'INVALID_API_KEY', status: 401 } },
          { status: 401, ok: false }
        )
      );

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 401,
        code: 'invalid_signature',
      });
    });

    it('maps 401 to invalid_signature using the optional detail-string hint', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(INVALID_SIGNATURE_BODY, { status: 401, ok: false }));

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 401,
        code: 'invalid_signature',
      });
    });

    it('maps 401 to signature_address_mismatch using the optional detail-string hint', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(SIGNATURE_MISMATCH_BODY, { status: 401, ok: false }));

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 401,
        code: 'signature_address_mismatch',
      });
    });

    it('maps 429 to rate_limited (bare-string error body)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(RATE_LIMITED_BODY, { status: 429, ok: false }));

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 429,
        code: 'rate_limited',
      });
    });

    it('maps 503 to service_unavailable', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, { status: 503, ok: false }));

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 503,
        code: 'service_unavailable',
      });
    });

    it('handles an unparseable error body without throwing a secondary error', async () => {
      const response = createMockResponse({}, { status: 401, ok: false });
      response.json = jest.fn().mockRejectedValue(new Error('not json'));
      mockFetch.mockResolvedValueOnce(response);

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 401,
        code: 'invalid_signature',
      });
    });
  });

  describe('unlinkWallet', () => {
    it('sends a DELETE to /auth/wallets/{address}', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true }));

      await unlinkWallet('0xAbC0000000000000000000000000000000aBcD');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.gatewayz.ai/auth/wallets/0xAbC0000000000000000000000000000000aBcD');
      expect(options.method).toBe('DELETE');
    });

    it('maps 400 to last_auth_method from the real ErrorResponse envelope', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(LAST_AUTH_METHOD_BODY, { status: 400, ok: false }));

      await expect(unlinkWallet('0xabc')).rejects.toMatchObject({
        status: 400,
        code: 'last_auth_method',
      });
    });

    it('maps 404 to wallet_not_linked', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(WALLET_NOT_LINKED_BODY, { status: 404, ok: false }));

      await expect(unlinkWallet('0xabc')).rejects.toMatchObject({
        status: 404,
        code: 'wallet_not_linked',
      });
    });

    it('resolves without a value on success', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true }));
      await expect(unlinkWallet('0xabc')).resolves.toBeUndefined();
    });
  });

  describe('describeWalletAuthError', () => {
    it('returns distinct copy for each known code', () => {
      const codes = [
        'nonce_missing_or_expired',
        'invalid_signature',
        'signature_address_mismatch',
        'wallet_linked_to_other_account',
        'wallet_not_linked',
        'last_auth_method',
        'chain_id_not_allowed',
        'rate_limited',
        'service_unavailable',
      ] as const;

      const messages = codes.map((code) => describeWalletAuthError(new WalletAuthError(400, code)));
      expect(new Set(messages).size).toBe(codes.length);
      expect(describeWalletAuthError(new WalletAuthError(409, 'wallet_linked_to_other_account'))).toMatch(
        /already linked to another/i
      );
      expect(describeWalletAuthError(new WalletAuthError(400, 'last_auth_method'))).toMatch(/only sign-in method/i);
    });

    it('falls back to a generic message for unknown_error', () => {
      expect(describeWalletAuthError(new WalletAuthError(500, 'unknown_error'))).toBe(
        'Something went wrong. Please try again.'
      );
    });
  });
});
