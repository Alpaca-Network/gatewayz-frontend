/**
 * Tests for the typed catalog getters (Task 8 — DB-driven catalog source of truth).
 *
 * These getters run client-side (consumed by the react-query hooks in
 * src/lib/hooks/use-catalog.ts, which Task 9's chat model-select consumes),
 * so they route through the Next `/api/*` proxy routes (CORS-safe) rather than
 * calling the backend directly. Each test asserts the request URL and the
 * response mapping (unwrapping the backend's `{ data }` / `{ gateways }` envelope).
 */
import { getModels, getModel, getProviders, getGateways } from '@/lib/catalog-api';
import { isTauriDesktop } from '@/lib/browser-detection';
import {
  createSuccessResponse,
  setupFetchMock,
} from '@/__tests__/utils/mock-fetch';

jest.mock('@/lib/browser-detection', () => ({
  isTauriDesktop: jest.fn(() => false),
}));

describe('catalog-api getters', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = setupFetchMock();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const lastUrl = () => String(mockFetch.mock.calls[0][0]);

  describe('getModels', () => {
    it('requests /api/models with gateway=all by default and unwraps data[]', async () => {
      const models = [{ id: 'openai/gpt-4o', name: 'GPT-4o' }];
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ data: models, total: 1 }));

      const result = await getModels();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = lastUrl();
      expect(url).toContain('/api/models');
      expect(url).toContain('gateway=all');
      expect(result).toEqual(models);
    });

    it('forwards gateway, limit, offset and search params', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ data: [] }));

      await getModels({ gateway: 'groq', limit: 5, offset: 10, search: 'llama' });

      const url = lastUrl();
      expect(url).toContain('gateway=groq');
      expect(url).toContain('limit=5');
      expect(url).toContain('offset=10');
      expect(url).toContain('search=llama');
    });

    it('returns [] when the backend envelope has no data array', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({}));
      await expect(getModels()).resolves.toEqual([]);
    });
  });

  describe('getModel', () => {
    it('requests /api/models/detail with an encoded modelId and returns data', async () => {
      const model = { id: 'openai/gpt-4o', name: 'GPT-4o' };
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ data: model, providers: [], related: [] }));

      const result = await getModel('openai/gpt-4o');

      const url = lastUrl();
      expect(url).toContain('/api/models/detail');
      expect(url).toContain(`modelId=${encodeURIComponent('openai/gpt-4o')}`);
      expect(result).toEqual(model);
    });

    it('returns null for an empty id without calling fetch', async () => {
      const result = await getModel('');
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null when the model is not found (404)', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ error: 'Model not found' }, 404));
      await expect(getModel('nope/nope')).resolves.toBeNull();
    });
  });

  describe('getProviders', () => {
    it('requests /api/providers and unwraps data[]', async () => {
      const providers = [{ slug: 'openai', name: 'OpenAI' }];
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ data: providers, total: 1 }));

      const result = await getProviders();

      expect(lastUrl()).toContain('/api/providers');
      expect(result).toEqual(providers);
    });
  });

  describe('getGateways', () => {
    it('requests /api/gateways and unwraps the gateways[] array', async () => {
      const gateways = [{ id: 'openrouter', name: 'OpenRouter', color: 'bg-blue-500' }];
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ gateways, total: 1, source: 'registry' }));

      const result = await getGateways();

      expect(lastUrl()).toContain('/api/gateways');
      expect(result).toEqual(gateways);
    });

    it('uses catalogFetchBase() like its siblings: on Tauri desktop it hits the backend directly and unwraps data[]', async () => {
      (isTauriDesktop as jest.Mock).mockReturnValueOnce(true);
      const gateways = [{ id: 'openrouter', name: 'OpenRouter', color: 'bg-blue-500' }];
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ data: gateways, total: 1 }));

      const result = await getGateways();

      const url = lastUrl();
      expect(url).toContain('/v1/gateways');
      expect(url).not.toContain('/api/gateways');
      expect(result).toEqual(gateways);
    });
  });
});
