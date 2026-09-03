import { getGpuPublicSummary, getGpuPublicNodes, getGpuUtilization, GpuPublicApiError } from '../public-api';
import { createSuccessResponse, createErrorResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';

describe('gpu/public-api', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = setupFetchMock();
  });

  describe('getGpuPublicSummary', () => {
    it('GETs /gpu/public/summary (no auth) and returns data as-is', async () => {
      // Fixture mirrors spec.md §6 byte-for-byte.
      const data = {
        active_nodes: 12,
        approved_providers: 5,
        regions: [{ region: 'us-east', nodes: 7 }],
        models: [{ id: 'llama-3.1-8b-instruct', nodes: 3 }],
        last_hour: { requests: 421, tokens: 918234, avg_latency_ms: 812, error_rate: 0.01 },
        updated_at: '2026-09-03T12:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true, data }));

      const result = await getGpuPublicSummary();

      expect(mockFetch).toHaveBeenCalledWith('https://api.gatewayz.ai/gpu/public/summary');
      expect(result).toEqual(data);
    });

    it('throws GpuPublicApiError on non-2xx', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse({ error: 'rate limited' }, 429));
      await expect(getGpuPublicSummary()).rejects.toBeInstanceOf(GpuPublicApiError);
    });
  });

  describe('getGpuPublicNodes', () => {
    it('GETs /gpu/public/nodes and returns the array, never leaking identity fields', async () => {
      const data = [
        {
          name: 'gpu-node-01',
          region: 'us-east',
          gpu_model: 'RTX 4090',
          vram_gb: 24,
          status: 'active',
          uptime_24h_pct: 99.2,
          models: ['llama-3.1-8b-instruct'],
        },
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true, data }));

      const result = await getGpuPublicNodes();

      expect(mockFetch).toHaveBeenCalledWith('https://api.gatewayz.ai/gpu/public/nodes');
      expect(result).toEqual(data);
      expect(result[0]).not.toHaveProperty('wallet');
      expect(result[0]).not.toHaveProperty('endpoint_url');
      expect(result[0]).not.toHaveProperty('provider_id');
    });
  });

  describe('getGpuUtilization', () => {
    it('builds the query string from window + group', async () => {
      const data = {
        window: '24h' as const,
        group: 'region' as const,
        series: [
          {
            hour: '2026-09-03T11:00:00Z',
            group: 'us-east',
            requests: 40,
            prompt_tokens: 12000,
            completion_tokens: 30000,
            avg_latency_ms: 780,
            error_rate: 0.0,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true, data }));

      const result = await getGpuUtilization('24h', 'region');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/gpu/public/utilization?window=24h&group=region'
      );
      expect(result).toEqual(data);
    });
  });
});
