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
            earnings: { accrued_wei: '1000000000000000000', settled_wei: '0', void_wei: '0' },
          },
        })
      );

      const result = await getMyGpuProvider();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/gpu/providers/me',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }) })
      );
      expect(result.provider.status).toBe('approved');
      expect(result.earnings.accrued_wei).toBe(10n ** 18n);
    });

    it('defaults a missing void_wei to 0n (A1 is still adding it)', async () => {
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
            earnings: { accrued_wei: '1000000000000000000', settled_wei: '0' },
          },
        })
      );

      const result = await getMyGpuProvider();

      expect(result.earnings.void_wei).toBe(0n);
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

    // The 400 body shape here (`error.context.parameter_value`, NOT `error.detail`) is
    // copied from gatewayz-backend tests/routes/test_gpu.py's own assertions:
    // `test_register_node_endpoint_unreachable` (L283) and
    // `test_register_node_models_mismatch` (L295), both of which assert
    // `response.json()["error"]["context"]["parameter_value"]` — the app-wide handler
    // (src/utils/error_handlers.py -> DetailedErrorFactory.invalid_parameter) always
    // sets `error.detail` to an unrelated static string, so `.detail` must never be
    // read for disambiguation here.
    it('maps 400 endpoint_unreachable from error.context.parameter_value', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(
          {
            error: {
              detail: 'One of your request parameters has an incorrect type.',
              context: { parameter_name: 'request', parameter_value: 'endpoint_unreachable' },
            },
          },
          400
        )
      );
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
    });

    it('maps 400 models_mismatch from error.context.parameter_value', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(
          {
            error: {
              detail: 'One of your request parameters has an incorrect type.',
              context: { parameter_name: 'request', parameter_value: 'models_mismatch' },
            },
          },
          400
        )
      );
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
      ).rejects.toMatchObject({ status: 400, code: 'models_mismatch' });
    });

    it('maps 403 to provider_not_approved regardless of body', async () => {
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
    // gatewayz-backend PR #2364: USD earnings paid in ETH on Base. Shape copied from
    // src/services/gpu/payout_views.py::usd_totals_view and gpu_earnings.py::_settlement_view.
    it('parses USD totals, ETH settlements, and the USD emission allocation', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            totals: {
              payout_asset: 'ETH',
              payout_chain: 'base',
              eth_usd_price: '3000',
              accrued_usd: '1.5',
              accrued_usd_micros: 1500000,
              accrued_wei: '500000000000000',
              settled_usd: '30',
              settled_usd_micros: 30000000,
              settled_wei: '10000000000000000',
              void_usd: '0',
              void_usd_micros: 0,
              void_wei: null,
            },
            work: [],
            settlements: [
              {
                id: 7,
                period_start: '2026-09-22T00:00:00Z',
                period_end: '2026-09-23T00:00:00Z',
                asset: 'ETH',
                chain: 'base',
                amount_wei: '10000000000000000',
                amount_usd: '30',
                amount_eth: '0.01',
                eth_usd_price: '3000.00000000',
                confirmed: true,
                status: 'sent',
                tx_hash: '0xbeef',
                tx_url: 'https://basescan.org/tx/0xbeef',
                error: null,
              },
              {
                id: 1,
                period_start: '2026-09-02T00:00:00Z',
                period_end: '2026-09-03T00:00:00Z',
                amount_wei: '456000000000000000000',
                status: 'sent',
                tx_hash: '0xdead',
                tx_url: 'https://testnet.snowtrace.io/tx/0xdead',
              },
            ],
            emission: {
              last_epoch: '2026-09-22',
              score: { compute: '1', speed: '1', availability: '1', unique_models: '1', raw: '1', adjusted: '1', share: '1' },
              allocation_usd: '55.8',
              allocation_eth: '0.0186',
              allocation_wayz: '0.0186',
              rank: 1,
              providers_scored: 3,
            },
          },
        })
      );

      const result = await getMyGpuEarnings();

      expect(result.accrued_usd).toBe(1.5);
      expect(result.settled_usd).toBe(30);
      expect(result.settled_wei).toBe(10n ** 16n);
      expect(result.accrued_wei).toBe(5n * 10n ** 14n);
      expect(result.void_wei).toBe(0n); // null on the wire -> 0n
      expect(result.eth_usd_price).toBe(3000);
      expect(result.settlements[0]).toMatchObject({
        asset: 'ETH',
        amount_wei: 10n ** 16n,
        amount_usd: 30,
        eth_usd_price: 3000,
        confirmed: true,
      });
      // No `asset` on the wire -> a legacy WAYZ row.
      expect(result.settlements[1]).toMatchObject({ asset: 'WAYZ', amount_usd: null, confirmed: true });
      expect(result.emission).toMatchObject({ allocation_usd: 55.8, allocation_eth: 0.0186 });
    });

    // Response shape (`data.totals.{accrued_wei,settled_wei,void_wei}` + `data.work` +
    // `data.settlements` with `id`/`tx_url`) copied from gatewayz-backend
    // tests/routes/test_gpu_earnings.py::test_earnings_returns_totals_work_and_settlements
    // (L22-42) and src/routes/gpu_earnings.py's `get_my_earnings`/`_settlement_view`.
    it('GETs /gpu/providers/me/earnings, reads totals from data.totals, and parses wei strings to bigint', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            totals: { accrued_wei: '123000000000000000000', settled_wei: '456000000000000000000', void_wei: '0' },
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
                id: 1,
                period_start: '2026-09-02T00:00:00Z',
                period_end: '2026-09-03T00:00:00Z',
                amount_wei: '456000000000000000000',
                status: 'sent',
                tx_hash: '0xdeadbeef',
                tx_url: 'https://testnet.snowtrace.io/tx/0xdeadbeef',
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
      expect(result.settlements[0].tx_url).toBe('https://testnet.snowtrace.io/tx/0xdeadbeef');
    });

    // Mirrors test_earnings_settlement_without_tx_hash_has_no_tx_url (L64-84 area).
    it('handles a settlement with no tx_hash/tx_url (still pending)', async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          data: {
            totals: { accrued_wei: '0', settled_wei: '0', void_wei: '0' },
            work: [],
            settlements: [
              {
                id: 2,
                period_start: '2026-09-01T00:00:00Z',
                period_end: '2026-09-02T00:00:00Z',
                amount_wei: '500',
                status: 'pending',
                tx_hash: null,
                tx_url: null,
              },
            ],
          },
        })
      );

      const result = await getMyGpuEarnings();

      expect(result.settlements[0].tx_hash).toBeNull();
      expect(result.settlements[0].tx_url).toBeNull();
      expect(result.settlements[0].amount_wei).toBe(500n);
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
