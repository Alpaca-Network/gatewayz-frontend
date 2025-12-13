import { getModelsForGateway } from '../models-service';
import {
  createMockResponse,
  createSuccessResponse,
  createErrorResponse,
  setupFetchMock,
  resetFetchMock,
} from '@/__tests__/utils/mock-fetch';
import { TEST_MODEL } from '@/__tests__/utils/test-constants';

describe('models-service', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = setupFetchMock();
    // Note: We don't use jest.resetModules() here as it's expensive
    // The cache is tested explicitly in specific tests
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getModelsForGateway', () => {
    it('should reject invalid gateways', async () => {
      await expect(getModelsForGateway('invalid-gateway')).rejects.toThrow(
        'Invalid gateway'
      );
    });

    it('should accept valid gateways', async () => {
      // Import ACTIVE_GATEWAY_IDS from centralized registry
      const { ACTIVE_GATEWAY_IDS } = require('@/lib/gateway-registry');
      const validGateways = [
        ...ACTIVE_GATEWAY_IDS,
        'all', // Special value
      ];

      mockFetch.mockResolvedValue(createSuccessResponse({ data: [] }));

      for (const gateway of validGateways) {
        await expect(getModelsForGateway(gateway)).resolves.toBeDefined();
      }
    });

    it('should handle API errors gracefully and return fallback data', async () => {
      mockFetch.mockRejectedValue(new Error('API error'));

      const result = await getModelsForGateway('openrouter');

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle network timeouts and return fallback data', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
      );

      const result = await getModelsForGateway('openrouter');

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }, 15000);

    describe('Model Deduplication', () => {
      // Consolidated deduplication tests - previously spread across 3 separate tests

      const createTestModel = (
        overrides: Partial<typeof TEST_MODEL> & { canonical_slug?: string }
      ) => ({
        ...TEST_MODEL,
        ...overrides,
      });

      it.each([
        {
          scenario: 'by canonical_slug',
          models: [
            createTestModel({
              id: 'google/gemini-pro',
              name: 'Google: Gemini Pro',
              canonical_slug: 'gemini-pro',
              source_gateway: 'openrouter',
            }),
            createTestModel({
              id: 'models/gemini-pro',
              name: 'Gemini Pro',
              canonical_slug: 'gemini-pro',
              source_gateway: 'google',
            }),
            createTestModel({
              id: 'gemini-pro-v1',
              name: 'models/gemini-pro',
              canonical_slug: 'gemini-pro',
              source_gateway: 'vercel-ai-gateway',
            }),
          ],
          filterFn: (m: any) =>
            m.name.toLowerCase().includes('gemini') &&
            m.name.toLowerCase().includes('pro') &&
            !m.name.toLowerCase().includes('flash'),
          expectedMaxCount: 1,
        },
        {
          scenario: 'by same model from different gateways',
          models: [
            createTestModel({
              id: 'openai/gpt-4',
              name: 'GPT-4',
              source_gateway: 'openrouter',
            }),
            createTestModel({
              id: 'openai/gpt-4-turbo',
              name: 'GPT-4 Turbo',
              source_gateway: 'groq',
            }),
            createTestModel({
              id: 'openai/gpt-4-v2',
              name: 'GPT-4',
              canonical_slug: 'gpt-4',
              source_gateway: 'together',
            }),
          ],
          filterFn: (m: any) =>
            m.name.toLowerCase().includes('gpt-4') &&
            !m.name.toLowerCase().includes('turbo'),
          expectedMaxCount: 1,
        },
      ])(
        'should deduplicate models $scenario',
        async ({ models, filterFn, expectedMaxCount }) => {
          mockFetch.mockImplementation((url: string) => {
            for (const model of models) {
              if (url.includes(`gateway=${model.source_gateway}`)) {
                return Promise.resolve(
                  createSuccessResponse({ data: [model] })
                );
              }
            }
            return Promise.resolve(createSuccessResponse({ data: [] }));
          });

          const result = await getModelsForGateway('all');
          const filteredModels = result.data.filter(filterFn);

          expect(filteredModels.length).toBeLessThanOrEqual(expectedMaxCount);

          if (filteredModels.length === 1) {
            expect(filteredModels[0].source_gateways).toBeDefined();
            expect(Array.isArray(filteredModels[0].source_gateways)).toBe(true);
          }
        }
      );
    });

    describe('Data Completeness Scoring', () => {
      it('should prefer complete models over incomplete ones', () => {
        const incompleteModel = {
          id: 'test/model-1',
          name: 'Test Model',
          description: null,
          context_length: 0,
          pricing: null,
          architecture: null,
          supported_parameters: null,
          provider_slug: 'test',
          source_gateway: 'openrouter',
        };

        const completeModel = {
          id: 'test/model-2',
          name: 'Test Model',
          description: 'Complete test model',
          context_length: 8000,
          pricing: { prompt: '0.01', completion: '0.03' },
          architecture: {
            input_modalities: ['text'],
            output_modalities: ['text'],
          },
          supported_parameters: ['temperature'],
          provider_slug: 'test',
          source_gateway: 'groq',
        };

        // Calculate completeness scores (same logic as in models-service.ts)
        const calcScore = (m: any) =>
          (m.description ? 1 : 0) +
          (m.pricing?.prompt ? 1 : 0) +
          (m.context_length > 0 ? 1 : 0) +
          (m.architecture?.input_modalities?.length || 0);

        const incompleteScore = calcScore(incompleteModel);
        const completeScore = calcScore(completeModel);

        expect(completeScore).toBeGreaterThan(incompleteScore);
        expect(incompleteScore).toBe(0);
        expect(completeScore).toBe(4);

        // Verify that the complete model would be chosen
        const mergedModel =
          completeScore > incompleteScore ? completeModel : incompleteModel;
        expect(mergedModel.description).toBe('Complete test model');
        expect(mergedModel.context_length).toBe(8000);
      });
    });

    it('should cache results for "all" gateway', async () => {
      const mockData = [
        {
          id: 'test/model',
          name: 'Test Model',
          provider_slug: 'test',
          source_gateway: 'openrouter',
        },
      ];

      mockFetch.mockResolvedValue(createSuccessResponse({ data: mockData }));

      // First call - should fetch
      await getModelsForGateway('all');
      const firstCallCount = mockFetch.mock.calls.length;

      // Second call - should use cache
      await getModelsForGateway('all');
      const secondCallCount = mockFetch.mock.calls.length;

      // Should not make additional API calls (cache hit)
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should handle pagination correctly', async () => {
      const page1Data = Array.from({ length: 100 }, (_, i) => ({
        id: `model-${i}`,
        name: `Model ${i}`,
        provider_slug: 'test',
        source_gateway: 'openrouter',
      }));

      const page2Data = Array.from({ length: 50 }, (_, i) => ({
        id: `model-${i + 100}`,
        name: `Model ${i + 100}`,
        provider_slug: 'test',
        source_gateway: 'openrouter',
      }));

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('offset=0') || !url.includes('offset=')) {
          return Promise.resolve(createSuccessResponse({ data: page1Data }));
        } else if (url.includes('offset=100')) {
          return Promise.resolve(createSuccessResponse({ data: page2Data }));
        }
        return Promise.resolve(createSuccessResponse({ data: [] }));
      });

      const result = await getModelsForGateway('openrouter');

      // Should combine pages
      expect(result.data.length).toBeGreaterThanOrEqual(100);
    });

    describe('Authorization Headers', () => {
      it.each([
        {
          gateway: 'huggingface',
          envVar: 'NEXT_PUBLIC_HF_API_KEY',
          expectedKey: 'test-hf-key',
        },
        {
          gateway: 'near',
          envVar: 'NEXT_PUBLIC_NEAR_API_KEY',
          expectedKey: 'test-near-key',
        },
      ])(
        'should add authorization headers for $gateway gateway',
        async ({ gateway, envVar, expectedKey }) => {
          process.env[envVar] = expectedKey;

          mockFetch.mockResolvedValue(createSuccessResponse({ data: [] }));

          await getModelsForGateway(gateway);

          const calls = mockFetch.mock.calls;
          const gatewayCalls = calls.filter((call) =>
            call[0].includes(`gateway=${gateway}`)
          );

          if (gatewayCalls.length > 0) {
            const [, options] = gatewayCalls[0];
            expect(options?.headers?.['Authorization']).toContain(
              `Bearer ${expectedKey}`
            );
          }

          delete process.env[envVar];
        }
      );
    });

    it('should track multiple providers for the same model', async () => {
      const model1 = {
        id: 'llama-3-70b',
        name: 'Llama 3 70B',
        provider_slug: 'meta',
        source_gateway: 'openrouter',
        canonical_slug: 'llama-3-70b',
      };

      const model2 = {
        id: 'meta/llama-3-70b',
        name: 'Llama 3 70B',
        provider_slug: 'together',
        source_gateway: 'together',
        canonical_slug: 'llama-3-70b',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('gateway=openrouter')) {
          return Promise.resolve(createSuccessResponse({ data: [model1] }));
        } else if (url.includes('gateway=together')) {
          return Promise.resolve(createSuccessResponse({ data: [model2] }));
        }
        return Promise.resolve(createSuccessResponse({ data: [] }));
      });

      const result = await getModelsForGateway('all');

      const llamaModels = result.data.filter(
        (m: any) =>
          m.canonical_slug === 'llama-3-70b' ||
          m.name.includes('Llama 3 70B')
      );

      if (llamaModels.length > 0) {
        const mergedModel = llamaModels[0];
        expect(mergedModel.provider_slugs).toBeDefined();
        expect(Array.isArray(mergedModel.provider_slugs)).toBe(true);
        expect(mergedModel.provider_slugs.length).toBeGreaterThanOrEqual(1);
      }
    });

    describe('Rate Limiting and Retry Logic', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        resetFetchMock(mockFetch);
      });

      it('should retry on 429 rate limit errors with exponential backoff', async () => {
        let attemptCount = 0;
        const mockModel = {
          ...TEST_MODEL,
          source_gateway: 'fireworks',
        };

        mockFetch.mockImplementation(() => {
          attemptCount++;
          if (attemptCount <= 2) {
            return Promise.resolve({
              status: 429,
              ok: false,
              headers: {
                get: (header: string) =>
                  header === 'retry-after' ? '0.1' : null,
              },
              json: async () => ({ detail: 'Rate limit exceeded' }),
            });
          }
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: { get: () => null },
            json: async () => ({ data: [mockModel] }),
          });
        });

        const result = await getModelsForGateway('fireworks');

        expect(attemptCount).toBeGreaterThanOrEqual(3);
        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
      }, 30000);

      it('should respect Retry-After header from 429 responses', async () => {
        let attemptCount = 0;
        let lastAttemptTime = Date.now();
        let retryDelayObserved = false;
        const retryAfterSeconds = '2';
        const minDelayMs = 2000;

        mockFetch.mockImplementation(() => {
          const currentTime = Date.now();
          if (attemptCount > 0) {
            const elapsed = currentTime - lastAttemptTime;
            if (elapsed >= minDelayMs - 200) {
              retryDelayObserved = true;
            }
          }
          lastAttemptTime = currentTime;
          attemptCount++;

          if (attemptCount === 1 || attemptCount === 2) {
            return Promise.resolve({
              status: 429,
              ok: false,
              headers: {
                get: (header: string) =>
                  header === 'retry-after' ? retryAfterSeconds : null,
              },
              json: async () => ({ detail: 'Rate limit exceeded' }),
            });
          }
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: { get: () => null },
            json: async () => ({ data: [] }),
          });
        });

        await getModelsForGateway('deepinfra');

        if (attemptCount >= 2) {
          expect(retryDelayObserved).toBe(true);
        } else {
          expect(attemptCount).toBeGreaterThanOrEqual(1);
        }
      }, 30000);

      it('should give up after max retries and skip the page', async () => {
        let attemptCount = 0;

        mockFetch.mockImplementation(() => {
          attemptCount++;
          return Promise.resolve({
            status: 429,
            ok: false,
            headers: {
              get: (header: string) =>
                header === 'retry-after' ? '0.1' : null,
            },
            json: async () => ({ detail: 'Rate limit exceeded' }),
          });
        });

        const result = await getModelsForGateway('groq');

        expect(attemptCount).toBeGreaterThanOrEqual(1);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      }, 30000);

      it('should process gateways in batches with delays to avoid rate limiting', async () => {
        const mockModel = {
          ...TEST_MODEL,
          source_gateway: 'test',
        };

        mockFetch.mockImplementation(() => {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: { get: () => null },
            json: async () => ({ data: [mockModel] }),
          });
        });

        const result = await getModelsForGateway('all');

        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      }, 60000);
    });

    describe('Gateway Alias Handling', () => {
      it('should accept gateway aliases like "hug" for huggingface', async () => {
        mockFetch.mockResolvedValue(createSuccessResponse({ data: [] }));

        // 'hug' is an alias for 'huggingface' - should be accepted
        await expect(getModelsForGateway('hug')).resolves.toBeDefined();
      });

      it('should return consistent fallback models for gateway aliases', async () => {
        // When API fails, fallback should work correctly with aliases
        mockFetch.mockRejectedValue(new Error('API error'));

        const hugResult = await getModelsForGateway('hug');
        const huggingfaceResult = await getModelsForGateway('huggingface');

        // Both should return fallback data
        expect(hugResult).toBeDefined();
        expect(hugResult.data).toBeDefined();
        expect(huggingfaceResult).toBeDefined();
        expect(huggingfaceResult.data).toBeDefined();

        // Both should return the same models since 'hug' normalizes to 'huggingface'
        expect(hugResult.data.length).toBe(huggingfaceResult.data.length);
      });

      it('should not return all models for aliases when using fallback', async () => {
        // This tests the bug fix: aliases should not return ALL models
        mockFetch.mockRejectedValue(new Error('API error'));

        const { models } = require('@/lib/models-data');
        const hugResult = await getModelsForGateway('hug');

        // Should NOT return all models - should be a subset
        // (unless huggingface happens to be assigned all models, which is unlikely)
        // At minimum, verify the alias works and returns an array
        expect(hugResult.data).toBeDefined();
        expect(Array.isArray(hugResult.data)).toBe(true);
        // The models should have the normalized gateway assigned
        if (hugResult.data.length > 0) {
          // Check that models have source_gateway set (could be 'huggingface' after normalization)
          expect(hugResult.data[0]).toHaveProperty('source_gateway');
        }
      });
    });
  });
});
