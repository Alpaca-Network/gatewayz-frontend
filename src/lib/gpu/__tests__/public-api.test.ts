import { getGpuPublicSummary, getGpuPublicNodes, getGpuUtilization, GpuPublicApiError } from '../public-api';
import { createSuccessResponse, createErrorResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';

describe('gpu/public-api', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = setupFetchMock();
  });

  describe('getGpuPublicSummary', () => {
    it('GETs /gpu/public/summary (no auth, no {success,data} envelope) and returns the body as-is', async () => {
      // Fixture copied from gatewayz-backend tests/routes/test_gpu_public.py's `_SUMMARY`
      // (L38-45) — `test_summary_returns_data_and_cache_header` asserts
      // `response.json() == _SUMMARY` directly, confirming there is no envelope.
      const data = {
        active_nodes: 3,
        approved_providers: 2,
        regions: [{ region: 'us-east', nodes: 3 }],
        models: [{ id: 'llama-3.1-8b-instruct', nodes: 3 }],
        last_hour: { requests: 100, tokens: 5000, avg_latency_ms: 250, error_rate: 0.01 },
        updated_at: '2026-09-03T18:00:00+00:00',
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse(data));

      const result = await getGpuPublicSummary();

      expect(mockFetch).toHaveBeenCalledWith('https://api.gatewayz.ai/gpu/public/summary');
      expect(result).toEqual(data);
    });

    it('throws GpuPublicApiError on non-2xx', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ error: 'rate limited' }, 429));
      await expect(getGpuPublicSummary()).rejects.toBeInstanceOf(GpuPublicApiError);
    });

    it('coerces the emission block\'s numeric fields regardless of wire type (Fix round 1)', async () => {
      // Fixture copied from `get_public_emission_summary` (gatewayz-backend
      // src/services/emission/epoch.py): `daily_emission_wayz` is
      // `str(Config.WAYZ_DAILY_EMISSION)` (a STRING, since it's an env-derived Decimal),
      // while the `*_bps` fields are plain `int(...)`s. Fix round 1 caught this rendering
      // as "0.0000 WAYZ" because the old code cast the whole payload straight through
      // with no coercion.
      const data = {
        active_nodes: 3,
        approved_providers: 2,
        regions: [],
        models: [],
        last_hour: { requests: 0, tokens: 0, avg_latency_ms: 0, error_rate: 0 },
        updated_at: '2026-09-13T00:00:00+00:00',
        emission: {
          mode: 'emission',
          daily_emission_wayz: '100000',
          providers_bps: 4100,
          stakers_bps: 4100,
          treasury_bps: 1800,
          last_epoch: '2026-09-12',
        },
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse(data));

      const result = await getGpuPublicSummary();

      expect(result.emission).toEqual({
        daily_emission_wayz: 100000,
        providers_bps: 4100,
        stakers_bps: 4100,
        treasury_bps: 1800,
        last_epoch: '2026-09-12',
      });
    });

    it('leaves emission undefined when the field is absent (per_unit mode)', async () => {
      const data = {
        active_nodes: 3,
        approved_providers: 2,
        regions: [],
        models: [],
        last_hour: { requests: 0, tokens: 0, avg_latency_ms: 0, error_rate: 0 },
        updated_at: '2026-09-13T00:00:00+00:00',
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse(data));

      const result = await getGpuPublicSummary();

      expect(result.emission).toBeUndefined();
    });
  });

  describe('getGpuPublicNodes', () => {
    it('GETs /gpu/public/nodes (bare array, no envelope) and never leaks identity fields', async () => {
      // Fixture copied from gatewayz-backend tests/routes/test_gpu_public.py's `_NODES`
      // (L47-56) — `test_nodes_returns_bare_array` confirms the response is a plain array.
      const data = [
        {
          name: 'node-1',
          region: 'us-east',
          gpu_model: 'A100',
          vram_gb: 80,
          status: 'active',
          uptime_24h_pct: 95.5,
          models: ['llama-3.1-8b-instruct'],
        },
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(data));

      const result = await getGpuPublicNodes();

      expect(mockFetch).toHaveBeenCalledWith('https://api.gatewayz.ai/gpu/public/nodes');
      expect(result).toEqual(data);
      expect(result[0]).not.toHaveProperty('wallet');
      expect(result[0]).not.toHaveProperty('endpoint_url');
      expect(result[0]).not.toHaveProperty('provider_id');
    });
  });

  describe('getGpuUtilization', () => {
    it('builds the query string from window + group, and returns the body as-is (no envelope)', async () => {
      // Fixture copied from gatewayz-backend tests/routes/test_gpu_public.py's `_UTIL_ROWS`
      // (L58-67), wrapped in the route's own {window, group, series} shape
      // (src/routes/gpu_public.py's `public_utilization`).
      const data = {
        window: '24h' as const,
        group: 'region' as const,
        series: [
          {
            hour: '2026-09-03T17:00:00+00:00',
            key: 'us-east',
            requests: 10,
            prompt_tokens: 100,
            completion_tokens: 50,
            avg_latency_ms: 200,
            error_rate: 0.0,
            active_nodes: 1,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse(data));

      const result = await getGpuUtilization('24h', 'region');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/gpu/public/utilization?window=24h&group=region'
      );
      expect(result).toEqual(data);
    });
  });
});
