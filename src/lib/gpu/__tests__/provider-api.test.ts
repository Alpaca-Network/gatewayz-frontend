import {
  registerGpuProvider,
  getMyGpuProvider,
  createGpuNode,
  patchGpuNode,
  deleteGpuNode,
  rotateGpuNodeToken,
  getMyGpuEarnings,
  GpuProviderApiError,
} from '../provider-api';
import { createSuccessResponse, createErrorResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';
import { saveApiKey } from '@/lib/api';

describe('gpu/provider-api', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockFetch = setupFetchMock();
    saveApiKey('test-api-key');
  });

  describe('registerGpuProvider', () => {
    it('POSTs /gpu/providers with a Bearer token', async () => {
      const provider = {
        id: 1,
        display_name: 'Acme GPUs',
        payout_wallet_address: '0xabc',
        contact_email: null,
        status: 'pending' as const,
        region_default: 'us-east',
        created_at: '2026-09-03T00:00:00Z',
        approved_at: null,
        approved_by: null,
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true, data: provider }, 201));

      const result = await registerGpuProvider({
        display_name: 'Acme GPUs',
        payout_wallet_address: '0xabc',
        region_default: 'us-east',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/gpu/providers',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
          body: JSON.stringify({
            display_name: 'Acme GPUs',
            payout_wallet_address: '0xabc',
            region_default: 'us-east',
          }),
        })
      );
      expect(result).toEqual(provider);
    });

    it('maps 400 to wallet_not_linked', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ error: { detail: 'wallet_not_linked' } }, 400));
      await expect(
        registerGpuProvider({ display_name: 'x', payout_wallet_address: '0xabc' })
      ).rejects.toMatchObject({ status: 400, code: 'wallet_not_linked' });
    });

    it('maps 409 to provider_exists', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({}, 409));
      await expect(
        registerGpuProvider({ display_name: 'x', payout_wallet_address: '0xabc' })
      ).rejects.toMatchObject({ status: 409, code: 'provider_exists' });
    });
  });

  describe('getMyGpuProvider', () => {
    it('GETs /gpu/providers/me and parses wei earnings summary', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            provider: {
              id: 1,
              display_name: 'Acme GPUs',
              payout_wallet_address: '0xabc',
              contact_email: null,
              status: 'approved',
              region_default: 'us-east',
              created_at: '2026-09-03T00:00:00Z',
              approved_at: '2026-09-04T00:00:00Z',
              approved_by: 'admin-1',
            },
            nodes: [],
            earnings_summary: { accrued_wei: '1000000000000000000', settled_wei: '0', void_wei: '0' },
          },
        })
      );

      const result = await getMyGpuProvider();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/gpu/providers/me',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }) })
      );
      expect(result.provider.status).toBe('approved');
      expect(result.earnings_summary.accrued_wei).toBe(10n ** 18n);
    });
  });

  describe('createGpuNode', () => {
    it('POSTs /gpu/nodes and returns the node + one-time token', async () => {
      const node = {
        id: 5,
        provider_id: 1,
        name: 'gpu-node-01',
        region: 'us-east',
        gpu_model: 'RTX 4090',
        vram_gb: 24,
        bandwidth_mbps: 1000,
        endpoint_url: 'https://node.example.com',
        models: [{ id: 'llama-3.1-8b-instruct', max_context: 8192 }],
        status: 'registered' as const,
        last_heartbeat_at: null,
        health_score: 100,
        outstanding_requests: 0,
        created_at: '2026-09-03T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({ success: true, data: { node, node_token: 'gw_node_abc123' } }, 201)
      );

      const result = await createGpuNode({
        name: 'gpu-node-01',
        region: 'us-east',
        gpu_model: 'RTX 4090',
        vram_gb: 24,
        bandwidth_mbps: 1000,
        endpoint_url: 'https://node.example.com',
        endpoint_api_key: 'sk-node',
        models: [{ id: 'llama-3.1-8b-instruct', max_context: 8192 }],
      });

      expect(result.node).toEqual(node);
      expect(result.node_token).toBe('gw_node_abc123');
    });

    it('maps 400 endpoint_unreachable and 403 provider_not_approved', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ error: { detail: 'endpoint_unreachable' } }, 400));
      await expect(
        createGpuNode({
          name: 'n',
          region: 'us-east',
          gpu_model: 'x',
          vram_gb: 1,
          bandwidth_mbps: 1,
          endpoint_url: 'https://x.example.com',
          endpoint_api_key: 'k',
          models: [],
        })
      ).rejects.toMatchObject({ status: 400, code: 'endpoint_unreachable' });

      mockFetch.mockResolvedValueOnce(createErrorResponse({}, 403));
      await expect(
        createGpuNode({
          name: 'n',
          region: 'us-east',
          gpu_model: 'x',
          vram_gb: 1,
          bandwidth_mbps: 1,
          endpoint_url: 'https://x.example.com',
          endpoint_api_key: 'k',
          models: [],
        })
      ).rejects.toMatchObject({ status: 403, code: 'provider_not_approved' });
    });
  });

  describe('patchGpuNode / deleteGpuNode / rotateGpuNodeToken', () => {
    it('PATCHes /gpu/nodes/{id}', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true, data: { status: 'active' } }));
      await patchGpuNode(5, { name: 'renamed' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/gpu/nodes/5',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'renamed' }) })
      );
    });

    it('DELETEs /gpu/nodes/{id}', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true, data: {} }));
      await deleteGpuNode(5);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/gpu/nodes/5',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('POSTs /gpu/nodes/{id}/rotate-token and returns the new token', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({ success: true, data: { node_token: 'gw_node_new' } })
      );
      const result = await rotateGpuNodeToken(5);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/gpu/nodes/5/rotate-token',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toBe('gw_node_new');
    });
  });

  describe('getMyGpuEarnings', () => {
    it('GETs /gpu/providers/me/earnings and parses wei strings to bigint', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            accrued_wei: '123000000000000000000',
            settled_wei: '456000000000000000000',
            void_wei: '0',
            work: [
              {
                billing_ref: 'br_1',
                model: 'community/llama-3.1-8b-instruct',
                prompt_tokens: 100,
                completion_tokens: 200,
                verification: 'verified',
                created_at: '2026-09-03T00:00:00Z',
              },
            ],
            settlements: [
              {
                period_start: '2026-09-02T00:00:00Z',
                period_end: '2026-09-03T00:00:00Z',
                amount_wei: '456000000000000000000',
                tx_hash: '0xdeadbeef',
                status: 'sent',
              },
            ],
          },
        })
      );

      const result = await getMyGpuEarnings();

      expect(result.accrued_wei).toBe(123n * 10n ** 18n);
      expect(result.settled_wei).toBe(456n * 10n ** 18n);
      expect(result.work[0].billing_ref).toBe('br_1');
      expect(result.settlements[0].amount_wei).toBe(456n * 10n ** 18n);
    });
  });

  describe('GpuProviderApiError', () => {
    it('is an Error with status and code', () => {
      const err = new GpuProviderApiError(404, 'not_found');
      expect(err).toBeInstanceOf(Error);
      expect(err.status).toBe(404);
      expect(err.code).toBe('not_found');
    });
  });
});
