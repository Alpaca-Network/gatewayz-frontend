import {
  getLinkedWallets,
  requestWalletLinkNonce,
  linkWallet,
  unlinkWallet,
  WalletAuthError,
  describeWalletAuthError,
} from '../wallet-auth-api';
import { createSuccessResponse, createErrorResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';
import { saveApiKey } from '@/lib/api';

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

    it('maps 409 wallet_linked_to_other_account to a WalletAuthError', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ detail: 'wallet_linked_to_other_account' }, 409));

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 409,
        code: 'wallet_linked_to_other_account',
      });
    });

    it('maps 400 nonce_missing_or_expired to a WalletAuthError', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ detail: 'nonce_missing_or_expired' }, 400));

      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 400,
        code: 'nonce_missing_or_expired',
      });
    });

    it('maps 401 invalid_signature and signature_address_mismatch to WalletAuthErrors', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ detail: 'invalid_signature' }, 401));
      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 401,
        code: 'invalid_signature',
      });

      mockFetch.mockResolvedValueOnce(createErrorResponse({ detail: 'signature_address_mismatch' }, 401));
      await expect(linkWallet('0xabc', 'msg', 'sig')).rejects.toMatchObject({
        status: 401,
        code: 'signature_address_mismatch',
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

    it('maps 400 last_auth_method to a WalletAuthError', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ detail: 'last_auth_method' }, 400));

      await expect(unlinkWallet('0xabc')).rejects.toMatchObject({
        status: 400,
        code: 'last_auth_method',
      });
    });

    it('resolves without a value on success', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true }));
      await expect(unlinkWallet('0xabc')).resolves.toBeUndefined();
    });
  });

  describe('describeWalletAuthError', () => {
    it('returns copy for each known code', () => {
      expect(describeWalletAuthError(new WalletAuthError(400, 'nonce_missing_or_expired'))).toMatch(/expired/i);
      expect(describeWalletAuthError(new WalletAuthError(401, 'invalid_signature'))).toMatch(/signature/i);
      expect(describeWalletAuthError(new WalletAuthError(401, 'signature_address_mismatch'))).toMatch(/match/i);
      expect(describeWalletAuthError(new WalletAuthError(409, 'wallet_linked_to_other_account'))).toMatch(
        /already linked to another/i
      );
      expect(describeWalletAuthError(new WalletAuthError(400, 'last_auth_method'))).toMatch(/only sign-in method/i);
    });

    it('falls back to a generic message for an unknown code', () => {
      expect(describeWalletAuthError(new WalletAuthError(500, 'server_error'))).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('special-cases 429', () => {
      expect(describeWalletAuthError(new WalletAuthError(429, 'rate_limited'))).toMatch(/too many attempts/i);
    });
  });
});
