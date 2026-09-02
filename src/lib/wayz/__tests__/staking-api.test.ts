import {
  getWalletStaking,
  getStakingSummary,
  getFaucetStatus,
  requestFaucetNonce,
  claimFaucet,
  FaucetError,
  describeFaucetError,
} from '../staking-api';
import { createSuccessResponse, createErrorResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';
import { saveApiKey } from '@/lib/api';

describe('staking-api', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockFetch = setupFetchMock();
  });

  describe('getWalletStaking', () => {
    it('builds the correct URL and parses wei strings to bigint', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            wallet_address: '0xabc',
            staked_amount: '123000000000000000000',
            daily_allowance: '5000000000000000000',
            last_synced_block: 100,
            last_synced_at: '2026-09-01T00:00:00Z',
            synced: true,
            total_staked: '999000000000000000000',
            daily_inference_capacity: 42,
            contracts: { chain_id: 43113, token: '0x1', staking: '0x2' },
            configured: true,
          },
        })
      );

      const result = await getWalletStaking('0xabc');

      expect(mockFetch).toHaveBeenCalledWith('https://api.gatewayz.ai/staking/wallets/0xabc');
      expect(result.staked_amount).toBe(123n * 10n ** 18n);
      expect(result.daily_allowance).toBe(5n * 10n ** 18n);
      expect(result.total_staked).toBe(999n * 10n ** 18n);
      expect(result.daily_inference_capacity).toBe(42);
      expect(result.contracts.chain_id).toBe(43113);
    });
  });

  describe('getStakingSummary', () => {
    it('parses summary wei fields to bigint', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            total_staked: '123000000000000000000',
            wallet_count: 3,
            daily_inference_capacity: 10,
            unstake_cooldown_seconds: 604800,
            last_synced_block: 200,
            last_synced_at: null,
            contracts: { chain_id: 43113, token: null, staking: null },
            configured: false,
          },
        })
      );

      const result = await getStakingSummary();

      expect(mockFetch).toHaveBeenCalledWith('https://api.gatewayz.ai/staking/summary');
      expect(result.total_staked).toBe(123n * 10n ** 18n);
      expect(result.configured).toBe(false);
    });
  });

  describe('getFaucetStatus', () => {
    it('sends the Bearer header via makeAuthenticatedRequest', async () => {
      saveApiKey('test-api-key');
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            configured: true,
            eligible: true,
            min_requests: 1,
            claim_amount: '10000000000000000000',
            claim: null,
          },
        })
      );

      const result = await getFaucetStatus('0xabc');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/faucet/status?wallet_address=0xabc',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
        })
      );
      expect(result.claim_amount).toBe(10n * 10n ** 18n);
      expect(result.claim).toBeNull();
    });
  });

  describe('requestFaucetNonce', () => {
    it('POSTs the wallet address and returns the message verbatim', async () => {
      saveApiKey('test-api-key');
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({ success: true, data: { message: 'Claim testnet WAYZ...', expires_in: 300 } })
      );

      const result = await requestFaucetNonce('0xabc');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/faucet/nonce',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ wallet_address: '0xabc' }),
        })
      );
      expect(result.message).toBe('Claim testnet WAYZ...');
    });
  });

  describe('claimFaucet', () => {
    it('POSTs wallet address + signature and parses the mint amount', async () => {
      saveApiKey('test-api-key');
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({ success: true, tx_hash: '0xdeadbeef', amount: '10000000000000000000' })
      );

      const result = await claimFaucet('0xabc', '0xsig');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/faucet/claim',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ wallet_address: '0xabc', signature: '0xsig' }),
        })
      );
      expect(result.tx_hash).toBe('0xdeadbeef');
      expect(result.amount).toBe(10n * 10n ** 18n);
    });

    it.each([
      [403, 'not eligible'],
      [409, 'already claimed'],
      [503, 'unconfigured'],
    ])('throws a FaucetError on %i (%s)', async (status, detail) => {
      saveApiKey('test-api-key');
      mockFetch.mockResolvedValueOnce(createErrorResponse({ detail }, status));

      await expect(claimFaucet('0xabc', '0xsig')).rejects.toMatchObject({
        status,
        detail,
      });
    });
  });

  describe('describeFaucetError', () => {
    it('maps each documented status to friendly copy', () => {
      expect(describeFaucetError(new FaucetError(400, 'x'))).toMatch(/expired/i);
      expect(describeFaucetError(new FaucetError(401, 'x'))).toMatch(/signature/i);
      expect(describeFaucetError(new FaucetError(403, 'x'))).toMatch(/eligible/i);
      expect(describeFaucetError(new FaucetError(409, 'x'))).toMatch(/already claimed/i);
      expect(describeFaucetError(new FaucetError(502, 'x'))).toMatch(/mint/i);
      expect(describeFaucetError(new FaucetError(503, 'x'))).toMatch(/not configured/i);
    });
  });
});
