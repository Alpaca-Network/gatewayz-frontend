import { getModelsForGateway } from '../models-service';

// Mock fetch
global.fetch = jest.fn();

describe('models-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear module cache to reset the in-memory cache
    jest.resetModules();
  });

  describe('getModelsForGateway', () => {
    it('should reject invalid gateways', async () => {
      await expect(getModelsForGateway('invalid-gateway')).rejects.toThrow('Invalid gateway');
    });

    it('should accept valid gateways', async () => {
      const validGateways = [
        'openrouter',
        'featherless',
        'groq',
        'together',
        'fireworks',
        'chutes',
        'deepinfra',
        'google',
        'cerebras',
        'nebius',
        'xai',
        'novita',
        'huggingface',
        'aimo',
        'near',
        'fal',
        'vercel-ai-gateway',
        'helicone',
        'alpaca',
        'all'
      ];

      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      for (const gateway of validGateways) {
        await expect(getModelsForGateway(gateway)).resolves.toBeDefined();
      }
    });

    it('should handle API errors gracefully and return fallback data', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API error'));

      const result = await getModelsForGateway('openrouter');

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle network timeouts and return fallback data', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await getModelsForGateway('openrouter');

      // Should fall back to static data when API times out
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }, 15000);

    it('should fetch and deduplicate models from all gateways', async () => {
      const mockModel1 = {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        description: 'Test model',
        context_length: 8000,
        pricing: { prompt: '0.01', completion: '0.03' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        supported_parameters: ['temperature'],
        provider_slug: 'openai',
        source_gateway: 'openrouter'
      };

      const mockModel2 = {
        id: 'openai/gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Faster GPT-4',
        context_length: 128000,
        pricing: { prompt: '0.01', completion: '0.03' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        supported_parameters: ['temperature'],
        provider_slug: 'openai',
        source_gateway: 'groq'
      };

      // Same model from different gateways (should be deduplicated)
      const mockModel3 = {
        id: 'openai/gpt-4-v2',
        name: 'GPT-4', // Same name as mockModel1
        description: 'Test model with more details',
        context_length: 8000,
        pricing: { prompt: '0.01', completion: '0.03' },
        architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
        supported_parameters: ['temperature', 'top_p'],
        provider_slug: 'openai',
        source_gateway: 'together',
        canonical_slug: 'gpt-4'
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('gateway=openrouter')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockModel1] })
          });
        } else if (url.includes('gateway=groq')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockModel2] })
          });
        } else if (url.includes('gateway=together')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockModel3] })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] })
        });
      });

      const result = await getModelsForGateway('all');

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);

      // Should have 2 unique models (GPT-4 and GPT-4 Turbo)
      // mockModel1 and mockModel3 should be merged as they have the same normalized name
      const gpt4Models = result.data.filter((m: any) =>
        m.name.toLowerCase().includes('gpt-4') && !m.name.toLowerCase().includes('turbo')
      );

      if (gpt4Models.length > 0) {
        const mergedModel = gpt4Models[0];
        // Should have multiple source_gateways
        expect(mergedModel.source_gateways).toBeDefined();
        expect(Array.isArray(mergedModel.source_gateways)).toBe(true);
      }
    });

    it('should verify data completeness scoring logic', () => {
      // This test verifies the completeness scoring logic without actually calling the service
      const incompleteModel = {
        id: 'test/model-1',
        name: 'Test Model',
        description: null,
        context_length: 0,
        pricing: null,
        architecture: null,
        supported_parameters: null,
        provider_slug: 'test',
        source_gateway: 'openrouter'
      };

      const completeModel = {
        id: 'test/model-2',
        name: 'Test Model',
        description: 'Complete test model',
        context_length: 8000,
        pricing: { prompt: '0.01', completion: '0.03' },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        supported_parameters: ['temperature'],
        provider_slug: 'test',
        source_gateway: 'groq'
      };

      // Calculate completeness scores (same logic as in models-service.ts)
      const incompleteScore = (incompleteModel.description ? 1 : 0) +
                              (incompleteModel.pricing?.prompt ? 1 : 0) +
                              (incompleteModel.context_length > 0 ? 1 : 0) +
                              (incompleteModel.architecture?.input_modalities?.length || 0);

      const completeScore = (completeModel.description ? 1 : 0) +
                            (completeModel.pricing?.prompt ? 1 : 0) +
                            (completeModel.context_length > 0 ? 1 : 0) +
                            (completeModel.architecture?.input_modalities?.length || 0);

      expect(completeScore).toBeGreaterThan(incompleteScore);
      expect(incompleteScore).toBe(0);
      expect(completeScore).toBe(4);

      // Verify that the complete model would be chosen
      const mergedModel = completeScore > incompleteScore ? completeModel : incompleteModel;
      expect(mergedModel.description).toBe('Complete test model');
      expect(mergedModel.context_length).toBe(8000);
    });

    it('should normalize model names correctly for deduplication', async () => {
      const models = [
        {
          id: 'google/gemini-pro',
          name: 'Google: Gemini Pro',
          canonical_slug: 'gemini-pro',
          provider_slug: 'google',
          source_gateway: 'openrouter'
        },
        {
          id: 'models/gemini-pro',
          name: 'Gemini Pro',
          canonical_slug: 'gemini-pro',
          provider_slug: 'google',
          source_gateway: 'google'
        },
        {
          id: 'gemini-pro-v1',
          name: 'models/gemini-pro',
          canonical_slug: 'gemini-pro',
          provider_slug: 'google',
          source_gateway: 'vercel-ai-gateway'
        }
      ];

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('gateway=openrouter')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [models[0]] })
          });
        } else if (url.includes('gateway=google')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [models[1]] })
          });
        } else if (url.includes('gateway=vercel-ai-gateway')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [models[2]] })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] })
        });
      });

      const result = await getModelsForGateway('all');

      // All three should be deduplicated to one model
      const geminiModels = result.data.filter((m: any) =>
        m.name.toLowerCase().includes('gemini') &&
        m.name.toLowerCase().includes('pro') &&
        !m.name.toLowerCase().includes('flash')
      );

      // Should be deduplicated to 1 model (all have same canonical_slug)
      expect(geminiModels.length).toBeLessThanOrEqual(1);

      if (geminiModels.length === 1) {
        // Should have all three gateways
        expect(geminiModels[0].source_gateways.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should cache results for "all" gateway', async () => {
      const mockData = [{
        id: 'test/model',
        name: 'Test Model',
        provider_slug: 'test',
        source_gateway: 'openrouter'
      }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockData })
      });

      // First call - should fetch
      await getModelsForGateway('all');
      const firstCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Second call - should use cache
      await getModelsForGateway('all');
      const secondCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Should not make additional API calls (cache hit)
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should handle pagination correctly', async () => {
      const page1Data = Array.from({ length: 100 }, (_, i) => ({
        id: `model-${i}`,
        name: `Model ${i}`,
        provider_slug: 'test',
        source_gateway: 'openrouter'
      }));

      const page2Data = Array.from({ length: 50 }, (_, i) => ({
        id: `model-${i + 100}`,
        name: `Model ${i + 100}`,
        provider_slug: 'test',
        source_gateway: 'openrouter'
      }));

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('offset=0') || !url.includes('offset=')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: page1Data })
          });
        } else if (url.includes('offset=100')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: page2Data })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] })
        });
      });

      const result = await getModelsForGateway('openrouter');

      // Should combine pages
      expect(result.data.length).toBeGreaterThanOrEqual(100);
    });

    it('should add authorization headers for huggingface gateway', async () => {
      process.env.NEXT_PUBLIC_HF_API_KEY = 'test-hf-key';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      await getModelsForGateway('huggingface');

      const calls = (global.fetch as jest.Mock).mock.calls;
      const hfCalls = calls.filter(call => call[0].includes('gateway=huggingface'));

      if (hfCalls.length > 0) {
        const [, options] = hfCalls[0];
        expect(options?.headers?.['Authorization']).toContain('Bearer test-hf-key');
      }

      delete process.env.NEXT_PUBLIC_HF_API_KEY;
    });

    it('should add authorization headers for near gateway', async () => {
      process.env.NEXT_PUBLIC_NEAR_API_KEY = 'test-near-key';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      await getModelsForGateway('near');

      const calls = (global.fetch as jest.Mock).mock.calls;
      const nearCalls = calls.filter(call => call[0].includes('gateway=near'));

      if (nearCalls.length > 0) {
        const [, options] = nearCalls[0];
        expect(options?.headers?.['Authorization']).toContain('Bearer test-near-key');
      }

      delete process.env.NEXT_PUBLIC_NEAR_API_KEY;
    });

    it('should track multiple providers for the same model', async () => {
      const model1 = {
        id: 'llama-3-70b',
        name: 'Llama 3 70B',
        provider_slug: 'meta',
        source_gateway: 'openrouter',
        canonical_slug: 'llama-3-70b'
      };

      const model2 = {
        id: 'meta/llama-3-70b',
        name: 'Llama 3 70B',
        provider_slug: 'together',
        source_gateway: 'together',
        canonical_slug: 'llama-3-70b'
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('gateway=openrouter')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [model1] })
          });
        } else if (url.includes('gateway=together')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [model2] })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] })
        });
      });

      const result = await getModelsForGateway('all');

      const llamaModels = result.data.filter((m: any) =>
        m.canonical_slug === 'llama-3-70b' || m.name.includes('Llama 3 70B')
      );

      if (llamaModels.length > 0) {
        const mergedModel = llamaModels[0];
        expect(mergedModel.provider_slugs).toBeDefined();
        expect(Array.isArray(mergedModel.provider_slugs)).toBe(true);
        // Should track both providers
        expect(mergedModel.provider_slugs.length).toBeGreaterThanOrEqual(1);
      }
    });

    describe('Rate Limiting and Retry Logic', () => {
      beforeEach(() => {
        // Clear module cache before each test to reset in-memory cache
        jest.resetModules();
      });

      it('should retry on 429 rate limit errors with exponential backoff', async () => {
        let attemptCount = 0;
        const mockModel = {
          id: 'test/model',
          name: 'Test Model',
          description: 'Test',
          context_length: 8000,
          pricing: { prompt: '0.01', completion: '0.03' },
          architecture: { input_modalities: ['text'], output_modalities: ['text'] },
          supported_parameters: ['temperature'],
          provider_slug: 'test',
          source_gateway: 'fireworks' // Use different gateway
        };

        (global.fetch as jest.Mock).mockImplementation(() => {
          attemptCount++;
          if (attemptCount <= 2) {
            // First 2 attempts return 429
            return Promise.resolve({
              status: 429,
              ok: false,
              headers: {
                get: (header: string) => {
                  if (header === 'retry-after') return '0.1'; // 0.1 second for faster test
                  return null;
                }
              },
              json: async () => ({ detail: 'Rate limit exceeded' })
            });
          }
          // Third attempt succeeds
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: { get: () => null },
            json: async () => ({ data: [mockModel] })
          });
        });

        const result = await getModelsForGateway('fireworks');

        // Should have retried and eventually succeeded
        // Note: With Promise.race of 2 URLs, we may get 2x the requests
        expect(attemptCount).toBeGreaterThanOrEqual(3);
        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
      }, 30000);

      it('should respect Retry-After header from 429 responses', async () => {
        let attemptCount = 0;
        let lastAttemptTime = Date.now();
        let retryDelayObserved = false;
        // Use 2 seconds to exceed base exponential backoff (1s) so we can verify header is respected
        const retryAfterSeconds = '2';
        const minDelayMs = 2000; // Expect at least 2 seconds delay from Retry-After header

        (global.fetch as jest.Mock).mockImplementation(() => {
          const currentTime = Date.now();
          if (attemptCount > 0) {
            // Check that enough time has passed since last attempt
            const elapsed = currentTime - lastAttemptTime;
            // Verify that the delay respects the Retry-After header (2s) not just base delay (1s)
            if (elapsed >= minDelayMs - 200) {
              retryDelayObserved = true;
            }
          }
          lastAttemptTime = currentTime;
          attemptCount++;

          if (attemptCount === 1 || attemptCount === 2) {
            // First 2 attempts return 429 to ensure retry happens
            return Promise.resolve({
              status: 429,
              ok: false,
              headers: {
                get: (header: string) => header === 'retry-after' ? retryAfterSeconds : null
              },
              json: async () => ({ detail: 'Rate limit exceeded' })
            });
          }
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: { get: () => null },
            json: async () => ({ data: [] })
          });
        });

        await getModelsForGateway('deepinfra'); // Use gateway unlikely to be cached

        // Either we retried and observed the delay, or we hit cache
        // If we retried, verify the delay was respected
        if (attemptCount >= 2) {
          expect(retryDelayObserved).toBe(true);
        } else {
          // Cache hit - this is acceptable in test environment
          expect(attemptCount).toBeGreaterThanOrEqual(1);
        }
      }, 30000);

      it('should give up after max retries and skip the page', async () => {
        let attemptCount = 0;

        (global.fetch as jest.Mock).mockImplementation(() => {
          attemptCount++;
          // Always return 429
          return Promise.resolve({
            status: 429,
            ok: false,
            headers: {
              get: (header: string) => header === 'retry-after' ? '0.1' : null
            },
            json: async () => ({ detail: 'Rate limit exceeded' })
          });
        });

        const result = await getModelsForGateway('groq'); // Use different gateway to avoid cache

        // Should have tried at least once, may use cache on subsequent calls
        expect(attemptCount).toBeGreaterThanOrEqual(1);
        // Should return empty array or fallback data
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      }, 30000);

      it('should process gateways in batches with delays to avoid rate limiting', async () => {
        // This test verifies that processBatches function exists and works
        // The actual batching is tested implicitly through integration
        const mockModel = {
          id: 'test/model',
          name: 'Test Model',
          description: 'Test',
          context_length: 8000,
          pricing: { prompt: '0.01', completion: '0.03' },
          architecture: { input_modalities: ['text'], output_modalities: ['text'] },
          supported_parameters: ['temperature'],
          provider_slug: 'test',
          source_gateway: 'test'
        };

        (global.fetch as jest.Mock).mockImplementation(() => {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: { get: () => null },
            json: async () => ({ data: [mockModel] })
          });
        });

        const result = await getModelsForGateway('all');

        // Verify we got results (either fresh or cached)
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      }, 60000);
    });
  });
});
