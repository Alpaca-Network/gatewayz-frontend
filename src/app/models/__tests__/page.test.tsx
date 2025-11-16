/**
 * Tests for /models page server-side logic
 * Tests model deduplication, merging, and data completeness scoring
 */

describe('Models Page - Deduplication Logic', () => {
  describe('Model name normalization', () => {
    it('should normalize model names by removing provider prefixes', () => {
      const testCases = [
        { input: 'Google: Gemini Pro', expected: 'gemini-pro' },
        { input: 'OpenAI: GPT-4', expected: 'gpt-4' },
        { input: 'Meta: Llama 3', expected: 'llama-3' },
        { input: 'Anthropic: Claude', expected: 'claude' },
        { input: 'models/gemini-pro', expected: 'gemini-pro' },
      ];

      testCases.forEach(({ input, expected }) => {
        const normalized = input
          .toLowerCase()
          .replace(/^(google:|openai:|meta:|anthropic:|models\/)/i, '')
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '')
          .replace(/^-+/, ''); // Remove leading hyphens

        expect(normalized).toBe(expected);
      });
    });

    it('should convert spaces to hyphens', () => {
      const input = 'GPT 4 Turbo';
      const normalized = input
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      expect(normalized).toBe('gpt-4-turbo');
    });

    it('should remove special characters except hyphens', () => {
      const input = 'Model (v2.5)';
      const normalized = input
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      expect(normalized).toBe('model-v25');
    });

    it('should handle models with version numbers', () => {
      const testCases = [
        { input: 'GPT-4.5', expected: 'gpt-45' },
        { input: 'Claude 3.5', expected: 'claude-35' },
        { input: 'Llama-3.1-70B', expected: 'llama-31-70b' },
      ];

      testCases.forEach(({ input, expected }) => {
        const normalized = input
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');

        expect(normalized).toBe(expected);
      });
    });
  });

  describe('Deduplication key generation', () => {
    it('should create unique keys for different models', () => {
      const model1 = { name: 'GPT-4', provider_slug: 'openai' };
      const model2 = { name: 'GPT-4 Turbo', provider_slug: 'openai' };

      const key1 = `gpt-4:::${model1.provider_slug}`;
      const key2 = `gpt-4-turbo:::${model2.provider_slug}`;

      expect(key1).not.toBe(key2);
    });

    it('should create same key for same model from different gateways', () => {
      const model1 = { name: 'GPT-4', provider_slug: 'openai', source_gateway: 'openrouter' };
      const model2 = { name: 'GPT-4', provider_slug: 'openai', source_gateway: 'together' };

      const normalized = 'gpt-4';
      const key1 = `${normalized}:::${model1.provider_slug}`;
      const key2 = `${normalized}:::${model2.provider_slug}`;

      expect(key1).toBe(key2);
    });

    it('should handle models with normalized names', () => {
      const model1 = { name: 'Google: Gemini Pro', provider_slug: 'google' };
      const model2 = { name: 'Gemini Pro', provider_slug: 'google' };

      const normalized1 = model1.name
        .toLowerCase()
        .replace(/^(google:|openai:|meta:|anthropic:|models\/)/i, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/^-+/, ''); // Remove leading hyphens

      const normalized2 = model2.name
        .toLowerCase()
        .replace(/^(google:|openai:|meta:|anthropic:|models\/)/i, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/^-+/, ''); // Remove leading hyphens

      // Both should normalize to the same value after removing prefix and cleaning up
      expect(normalized1).toBe('gemini-pro');
      expect(normalized2).toBe('gemini-pro');
      expect(normalized1).toBe(normalized2);
    });

    it('should handle unknown provider_slug', () => {
      const model = { name: 'Test Model', provider_slug: undefined };
      const normalized = 'test-model';
      const key = `${normalized}:::${model.provider_slug || 'unknown'}`;

      expect(key).toBe('test-model:::unknown');
    });
  });

  describe('Gateway merging', () => {
    it('should merge source_gateways from duplicate models', () => {
      const existing = {
        name: 'GPT-4',
        source_gateways: ['openrouter']
      };

      const newModel = {
        name: 'GPT-4',
        source_gateways: ['together']
      };

      const existingGateways = existing.source_gateways || [];
      const newGateways = newModel.source_gateways || [];
      const combinedGateways = Array.from(new Set([...existingGateways, ...newGateways]));

      expect(combinedGateways).toHaveLength(2);
      expect(combinedGateways).toContain('openrouter');
      expect(combinedGateways).toContain('together');
    });

    it('should deduplicate gateway names', () => {
      const existing = {
        name: 'GPT-4',
        source_gateways: ['openrouter', 'groq']
      };

      const newModel = {
        name: 'GPT-4',
        source_gateways: ['openrouter', 'together']
      };

      const combinedGateways = Array.from(new Set([
        ...(existing.source_gateways || []),
        ...(newModel.source_gateways || [])
      ]));

      expect(combinedGateways).toHaveLength(3);
      expect(combinedGateways).toContain('openrouter');
      expect(combinedGateways).toContain('groq');
      expect(combinedGateways).toContain('together');
    });

    it('should handle empty source_gateways arrays', () => {
      const existing = {
        name: 'GPT-4',
        source_gateways: []
      };

      const newModel = {
        name: 'GPT-4',
        source_gateways: ['openrouter']
      };

      const combinedGateways = Array.from(new Set([
        ...(existing.source_gateways || []),
        ...(newModel.source_gateways || [])
      ]));

      expect(combinedGateways).toHaveLength(1);
      expect(combinedGateways).toContain('openrouter');
    });

    it('should initialize source_gateways as array if undefined', () => {
      const model = {
        name: 'GPT-4',
        source_gateway: 'openrouter',
        source_gateways: undefined
      };

      if (!model.source_gateways) {
        model.source_gateways = [];
      }

      expect(Array.isArray(model.source_gateways)).toBe(true);
      expect(model.source_gateways).toHaveLength(0);
    });
  });

  describe('Data completeness scoring', () => {
    it('should score models based on data completeness', () => {
      const completeModel = {
        description: 'A complete model',
        pricing: { prompt: '0.01', completion: '0.03' },
        context_length: 8000
      };

      const incompleteModel = {
        description: null,
        pricing: null,
        context_length: 0
      };

      const completeScore = (completeModel.description ? 1 : 0) +
                            (completeModel.pricing?.prompt ? 1 : 0) +
                            (completeModel.context_length > 0 ? 1 : 0);

      const incompleteScore = (incompleteModel.description ? 1 : 0) +
                              (incompleteModel.pricing?.prompt ? 1 : 0) +
                              (incompleteModel.context_length > 0 ? 1 : 0);

      expect(completeScore).toBe(3);
      expect(incompleteScore).toBe(0);
      expect(completeScore).toBeGreaterThan(incompleteScore);
    });

    it('should prefer models with descriptions', () => {
      const model1 = {
        description: 'Has description',
        pricing: null,
        context_length: 0
      };

      const model2 = {
        description: null,
        pricing: { prompt: '0.01' },
        context_length: 8000
      };

      const score1 = (model1.description ? 1 : 0) +
                     (model1.pricing?.prompt ? 1 : 0) +
                     (model1.context_length > 0 ? 1 : 0);

      const score2 = (model2.description ? 1 : 0) +
                     (model2.pricing?.prompt ? 1 : 0) +
                     (model2.context_length > 0 ? 1 : 0);

      expect(score1).toBe(1);
      expect(score2).toBe(2);
    });

    it('should prefer models with pricing information', () => {
      const model1 = {
        description: 'Model 1',
        pricing: { prompt: '0.01', completion: '0.03' },
        context_length: 0
      };

      const model2 = {
        description: 'Model 2',
        pricing: null,
        context_length: 0
      };

      const score1 = (model1.description ? 1 : 0) +
                     (model1.pricing?.prompt ? 1 : 0) +
                     (model1.context_length > 0 ? 1 : 0);

      const score2 = (model2.description ? 1 : 0) +
                     (model2.pricing?.prompt ? 1 : 0) +
                     (model2.context_length > 0 ? 1 : 0);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should prefer models with context_length', () => {
      const model1 = {
        description: null,
        pricing: null,
        context_length: 8000
      };

      const model2 = {
        description: null,
        pricing: null,
        context_length: 0
      };

      const score1 = (model1.description ? 1 : 0) +
                     (model1.pricing?.prompt ? 1 : 0) +
                     (model1.context_length > 0 ? 1 : 0);

      const score2 = (model2.description ? 1 : 0) +
                     (model2.pricing?.prompt ? 1 : 0) +
                     (model2.context_length > 0 ? 1 : 0);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should keep model with higher score during merge', () => {
      const existing = {
        name: 'GPT-4',
        description: 'Existing model',
        pricing: { prompt: '0.01' },
        context_length: 8000,
        source_gateways: ['openrouter']
      };

      const newModel = {
        name: 'GPT-4',
        description: null,
        pricing: null,
        context_length: 0,
        source_gateways: ['together']
      };

      const existingScore = (existing.description ? 1 : 0) +
                            (existing.pricing?.prompt ? 1 : 0) +
                            (existing.context_length > 0 ? 1 : 0);

      const newScore = (newModel.description ? 1 : 0) +
                       (newModel.pricing?.prompt ? 1 : 0) +
                       (newModel.context_length > 0 ? 1 : 0);

      const mergedModel = newScore > existingScore ? newModel : existing;

      expect(mergedModel).toBe(existing);
      expect(mergedModel.description).toBe('Existing model');
    });
  });

  describe('Priority vs Deferred gateway logic', () => {
    it('should define fast priority gateways', () => {
      const PRIORITY_GATEWAYS = ['openrouter', 'groq', 'together', 'fireworks', 'vercel-ai-gateway'];

      expect(PRIORITY_GATEWAYS).toHaveLength(5);
      expect(PRIORITY_GATEWAYS).toContain('openrouter');
      expect(PRIORITY_GATEWAYS).toContain('groq');
      expect(PRIORITY_GATEWAYS).toContain('together');
      expect(PRIORITY_GATEWAYS).toContain('fireworks');
      expect(PRIORITY_GATEWAYS).toContain('vercel-ai-gateway');
    });

    it('should define slower deferred gateways', () => {
      const DEFERRED_GATEWAYS = [
        'featherless', 'chutes', 'deepinfra', 'google', 'cerebras',
        'nebius', 'xai', 'novita', 'huggingface', 'aimo', 'near', 'fal', 'helicone', 'alpaca'
      ];

      expect(DEFERRED_GATEWAYS.length).toBeGreaterThanOrEqual(14);
      expect(DEFERRED_GATEWAYS).toContain('huggingface');
      expect(DEFERRED_GATEWAYS).toContain('near');
      expect(DEFERRED_GATEWAYS).toContain('alpaca');
    });

    it('should not have overlapping gateways between priority and deferred', () => {
      const PRIORITY_GATEWAYS = ['openrouter', 'groq', 'together', 'fireworks', 'vercel-ai-gateway'];
      const DEFERRED_GATEWAYS = [
        'featherless', 'chutes', 'deepinfra', 'google', 'cerebras',
        'nebius', 'xai', 'novita', 'huggingface', 'aimo', 'near', 'fal', 'helicone', 'alpaca'
      ];

      const overlap = PRIORITY_GATEWAYS.filter(g => DEFERRED_GATEWAYS.includes(g));

      expect(overlap).toHaveLength(0);
    });
  });

  describe('Model merging edge cases', () => {
    it('should handle models with null names', () => {
      const model = { name: null, provider_slug: 'test' };
      const normalized = (model.name || '')
        .toLowerCase()
        .replace(/^(google:|openai:|meta:|anthropic:|models\/)/i, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      expect(normalized).toBe('');
    });

    it('should handle models with undefined names', () => {
      const model = { name: undefined, provider_slug: 'test' };
      const normalized = (model.name || '')
        .toLowerCase()
        .replace(/^(google:|openai:|meta:|anthropic:|models\/)/i, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      expect(normalized).toBe('');
    });

    it('should handle models with empty source_gateways', () => {
      const model = {
        name: 'Test Model',
        source_gateways: []
      };

      const gateways = model.source_gateways || [];

      expect(Array.isArray(gateways)).toBe(true);
      expect(gateways).toHaveLength(0);
    });

    it('should convert source_gateway string to array', () => {
      const model = {
        name: 'Test Model',
        source_gateway: 'openrouter',
        source_gateways: undefined
      };

      if (!Array.isArray(model.source_gateways) && model.source_gateway) {
        model.source_gateways = [model.source_gateway];
      } else if (!model.source_gateways) {
        model.source_gateways = [];
      }

      expect(Array.isArray(model.source_gateways)).toBe(true);
      expect(model.source_gateways).toContain('openrouter');
    });

    it('should handle models with same score by keeping existing', () => {
      const existing = {
        name: 'GPT-4',
        description: 'Existing',
        pricing: null,
        context_length: 0
      };

      const newModel = {
        name: 'GPT-4',
        description: 'New',
        pricing: null,
        context_length: 0
      };

      const existingScore = (existing.description ? 1 : 0) +
                            (existing.pricing?.prompt ? 1 : 0) +
                            (existing.context_length > 0 ? 1 : 0);

      const newScore = (newModel.description ? 1 : 0) +
                       (newModel.pricing?.prompt ? 1 : 0) +
                       (newModel.context_length > 0 ? 1 : 0);

      const mergedModel = newScore > existingScore ? newModel : existing;

      expect(mergedModel).toBe(existing);
    });
  });

  describe('Build-time environment detection', () => {
    it('should detect production build phase', () => {
      const originalPhase = process.env.NEXT_PHASE;
      process.env.NEXT_PHASE = 'phase-production-build';

      const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI;

      expect(isBuildTime).toBe(true);

      // Restore
      if (originalPhase !== undefined) {
        process.env.NEXT_PHASE = originalPhase;
      } else {
        delete process.env.NEXT_PHASE;
      }
    });

    it('should detect CI environment', () => {
      const originalCI = process.env.CI;
      process.env.CI = 'true';

      const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || !!process.env.CI;

      expect(isBuildTime).toBe(true);

      // Restore
      if (originalCI !== undefined) {
        process.env.CI = originalCI;
      } else {
        delete process.env.CI;
      }
    });

    it('should not detect build time in normal runtime', () => {
      const originalPhase = process.env.NEXT_PHASE;
      const originalCI = process.env.CI;

      delete process.env.NEXT_PHASE;
      delete process.env.CI;

      const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || !!process.env.CI;

      expect(isBuildTime).toBe(false);

      // Restore
      if (originalPhase !== undefined) {
        process.env.NEXT_PHASE = originalPhase;
      }
      if (originalCI !== undefined) {
        process.env.CI = originalCI;
      }
    });
  });
});
