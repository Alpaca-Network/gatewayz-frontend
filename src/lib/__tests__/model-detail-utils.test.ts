import {
  extractModelNameFromId,
  findModelByRouteParams,
  getModelGateways,
  getRelatedModels,
  type ModelDetailRecord,
  type ModelLookupParams,
} from '../model-detail-utils';
import * as Sentry from '@sentry/nextjs';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

describe('model-detail-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractModelNameFromId', () => {
    it('should extract model name from colon-separated ID', () => {
      expect(extractModelNameFromId('openai:gpt-4')).toBe('gpt-4');
    });

    it('should extract model name from slash-separated ID', () => {
      expect(extractModelNameFromId('openai/gpt-4')).toBe('gpt-4');
    });

    it('should handle multi-part slash IDs', () => {
      expect(extractModelNameFromId('org/developer/model-name')).toBe('developer/model-name');
    });

    it('should handle multi-part colon IDs', () => {
      expect(extractModelNameFromId('provider:namespace:model')).toBe('namespace:model');
    });

    it('should return the ID itself if no separator', () => {
      expect(extractModelNameFromId('simple-model')).toBe('simple-model');
    });

    it('should return empty string for empty input', () => {
      expect(extractModelNameFromId('')).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(extractModelNameFromId(null as any)).toBe('');
      expect(extractModelNameFromId(undefined)).toBe('');
    });
  });

  describe('findModelByRouteParams', () => {
    const mockModels: ModelDetailRecord[] = [
      {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        provider_slug: 'openai',
      },
      {
        id: 'anthropic/claude-3-opus',
        name: 'Claude 3 Opus',
        provider_slug: 'anthropic',
        canonical_slug: 'claude-3-opus',
      },
      {
        id: 'google/gemini-pro',
        name: 'Gemini Pro',
        provider_slug: 'google',
        provider_slugs: ['google', 'gemini'],
      },
    ];

    it('should find model by exact ID match', () => {
      const params: ModelLookupParams = { modelId: 'openai/gpt-4' };
      const result = findModelByRouteParams(mockModels, params);
      expect(result?.id).toBe('openai/gpt-4');
    });

    it('should find model by case-insensitive ID', () => {
      const params: ModelLookupParams = { modelId: 'OPENAI/GPT-4' };
      const result = findModelByRouteParams(mockModels, params);
      expect(result?.id).toBe('openai/gpt-4');
    });

    it('should find model by collapsed ID (ignoring special characters)', () => {
      const params: ModelLookupParams = { modelId: 'anthropic/claude-3-opus' };
      const result = findModelByRouteParams(mockModels, params);
      expect(result?.id).toBe('anthropic/claude-3-opus');
    });

    it('should find model by developer and model name', () => {
      const params: ModelLookupParams = {
        developer: 'openai',
        modelNameParam: 'gpt-4',
      };
      const result = findModelByRouteParams(mockModels, params);
      expect(result?.id).toBe('openai/gpt-4');
    });

    it('should handle URL-encoded model IDs', () => {
      const params: ModelLookupParams = { modelId: 'openai%2Fgpt-4' };
      const result = findModelByRouteParams(mockModels, params);
      expect(result?.id).toBe('openai/gpt-4');
    });

    it('should return undefined for non-existent model', () => {
      const params: ModelLookupParams = { modelId: 'nonexistent/model' };
      const result = findModelByRouteParams(mockModels, params);
      expect(result).toBeUndefined();
    });

    it('should handle models without ID', () => {
      const modelsWithInvalid = [
        { name: 'Invalid Model' } as ModelDetailRecord,
        ...mockModels,
      ];
      const params: ModelLookupParams = { modelId: 'openai/gpt-4' };
      const result = findModelByRouteParams(modelsWithInvalid, params);
      expect(result?.id).toBe('openai/gpt-4');
    });

    it('should match by canonical slug', () => {
      const params: ModelLookupParams = { modelNameParam: 'claude-3-opus' };
      const result = findModelByRouteParams(mockModels, params);
      expect(result?.id).toBe('anthropic/claude-3-opus');
    });

    it('should match with provider slug arrays', () => {
      const params: ModelLookupParams = {
        developer: 'gemini',
        modelNameParam: 'gemini-pro',
      };
      const result = findModelByRouteParams(mockModels, params);
      expect(result?.id).toBe('google/gemini-pro');
    });

    it('should match by collapsed name when normalization differs (dots vs hyphens)', () => {
      // Model has version with dot, URL has version with hyphen
      const modelsWithDot: ModelDetailRecord[] = [
        {
          id: 'openai/gpt-4.5',
          name: 'GPT-4.5',
          provider_slug: 'openai',
        },
      ];
      // URL /models/openai/gpt-4-5 produces modelNameParam 'gpt-4-5'
      const params: ModelLookupParams = {
        developer: 'openai',
        modelNameParam: 'gpt-4-5',
      };
      const result = findModelByRouteParams(modelsWithDot, params);
      expect(result?.id).toBe('openai/gpt-4.5');
    });

    it('should match nested paths like NEAR models', () => {
      const nearModels: ModelDetailRecord[] = [
        {
          id: 'near/deepseek-ai/deepseek-v3-1',
          name: 'DeepSeek V3',
          provider_slug: 'near',
        },
      ];
      // URL /models/near/deepseek-ai/deepseek-v3-1 produces:
      // developer = 'near', modelNameParam = 'deepseek-ai/deepseek-v3-1'
      const params: ModelLookupParams = {
        developer: 'near',
        modelNameParam: 'deepseek-ai/deepseek-v3-1',
      };
      const result = findModelByRouteParams(nearModels, params);
      expect(result?.id).toBe('near/deepseek-ai/deepseek-v3-1');
    });

    it('should not match when collapsed name differs completely', () => {
      // Test case where collapsed matching is attempted but fails
      const models: ModelDetailRecord[] = [
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          provider_slug: 'openai',
        },
      ];
      // Search for a completely different model name
      const params: ModelLookupParams = {
        developer: 'openai',
        modelNameParam: 'claude-3',
      };
      const result = findModelByRouteParams(models, params);
      expect(result).toBeUndefined();
    });

    it('should handle model name with multiple special characters via collapsed matching', () => {
      // Test case: model with underscores and dots matches URL with hyphens
      const models: ModelDetailRecord[] = [
        {
          id: 'meta/llama_3.1_8b',
          name: 'Llama 3.1 8B',
          provider_slug: 'meta',
        },
      ];
      // URL normalization converts to hyphens: llama-3-1-8b
      const params: ModelLookupParams = {
        developer: 'meta',
        modelNameParam: 'llama-3-1-8b',
      };
      const result = findModelByRouteParams(models, params);
      expect(result?.id).toBe('meta/llama_3.1_8b');
    });

    it('should return false when provider mismatches even if collapsed name matches', () => {
      const models: ModelDetailRecord[] = [
        {
          id: 'openai/gpt-4.5',
          name: 'GPT-4.5',
          provider_slug: 'openai',
        },
      ];
      // Correct model name but wrong provider
      const params: ModelLookupParams = {
        developer: 'anthropic',
        modelNameParam: 'gpt-4-5',
      };
      const result = findModelByRouteParams(models, params);
      expect(result).toBeUndefined();
    });
  });

  describe('getModelGateways', () => {
    it('should extract gateways from source_gateways array', () => {
      const model: ModelDetailRecord = {
        id: 'test-model',
        name: 'Test Model',
        source_gateways: ['openrouter', 'together'],
      };
      const result = getModelGateways(model);
      expect(result).toContain('openrouter');
      expect(result).toContain('together');
    });

    it('should extract gateway from source_gateway string', () => {
      const model: ModelDetailRecord = {
        id: 'test-model',
        name: 'Test Model',
        source_gateway: 'openrouter',
      };
      const result = getModelGateways(model);
      expect(result).toContain('openrouter');
    });

    it('should combine gateways from multiple sources', () => {
      const model: ModelDetailRecord = {
        id: 'test-model',
        name: 'Test Model',
        source_gateways: ['openrouter'],
        source_gateway: 'together',
        gateways: ['groq'],
        gateway: 'fireworks',
      };
      const result = getModelGateways(model);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should normalize gateways to lowercase', () => {
      const model: ModelDetailRecord = {
        id: 'test-model',
        name: 'Test Model',
        source_gateways: ['OpenRouter', 'TOGETHER'],
      };
      const result = getModelGateways(model);
      expect(result).toContain('openrouter');
      expect(result).toContain('together');
    });

    it('should filter out invalid gateways and use fallback', () => {
      const model: ModelDetailRecord = {
        id: 'test-model',
        name: 'Test Model',
        source_gateways: ['invalid-gateway', 'unknown-provider'],
      };
      const result = getModelGateways(model);
      expect(result).toEqual(['gatewayz']);
      expect(Sentry.captureMessage).toHaveBeenCalled();
    });

    it('should return fallback when no gateways present', () => {
      const model: ModelDetailRecord = {
        id: 'test-model',
        name: 'Test Model',
      };
      const result = getModelGateways(model);
      expect(result).toEqual(['gatewayz']);
    });

    it('should handle null and undefined gateway values', () => {
      const model: ModelDetailRecord = {
        id: 'test-model',
        name: 'Test Model',
        source_gateway: null,
        source_gateways: undefined,
      };
      const result = getModelGateways(model);
      expect(result).toEqual(['gatewayz']);
    });

    it('should capture exception on error and return fallback', () => {
      const model: any = {
        id: 'test-model',
        name: 'Test Model',
        get source_gateways() {
          throw new Error('Getter error');
        },
      };
      const result = getModelGateways(model);
      expect(result).toEqual(['gatewayz']);
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should deduplicate gateways', () => {
      const model: ModelDetailRecord = {
        id: 'test-model',
        name: 'Test Model',
        source_gateways: ['openrouter', 'openrouter', 'together'],
      };
      const result = getModelGateways(model);
      const uniqueResult = [...new Set(result)];
      expect(result.length).toBe(uniqueResult.length);
    });
  });

  describe('getRelatedModels', () => {
    const mockModels: ModelDetailRecord[] = [
      {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        provider_slug: 'openai',
      },
      {
        id: 'openai/gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider_slug: 'openai',
      },
      {
        id: 'anthropic/claude-3-opus',
        name: 'Claude 3 Opus',
        provider_slug: 'anthropic',
      },
      {
        id: 'anthropic/claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        provider_slug: 'anthropic',
      },
    ];

    it('should find related models from same provider', () => {
      const target = mockModels[0]; // openai/gpt-4
      const result = getRelatedModels(mockModels, target);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(m => m.id === 'openai/gpt-3.5-turbo')).toBe(true);
    });

    it('should exclude the target model from results', () => {
      const target = mockModels[0];
      const result = getRelatedModels(mockModels, target);
      expect(result.some(m => m.id === target.id)).toBe(false);
    });

    it('should respect the limit parameter', () => {
      const target = mockModels[0];
      const result = getRelatedModels(mockModels, target, 1);
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for null target', () => {
      const result = getRelatedModels(mockModels, null as any);
      expect(result).toEqual([]);
    });

    it('should handle target with no provider info', () => {
      const target: ModelDetailRecord = {
        id: 'unknown/model',
        name: 'Unknown Model',
      };
      const result = getRelatedModels(mockModels, target);
      expect(result).toEqual([]);
    });

    it('should deduplicate models with same ID', () => {
      const duplicateModels = [
        ...mockModels,
        { ...mockModels[1] }, // duplicate
      ];
      const target = mockModels[0];
      const result = getRelatedModels(duplicateModels, target);
      const ids = result.map(m => m.id);
      expect(ids.length).toBe(new Set(ids).size);
    });

    it('should handle models without ID', () => {
      const modelsWithInvalid = [
        ...mockModels,
        { name: 'Invalid' } as ModelDetailRecord,
      ];
      const target = mockModels[0];
      const result = getRelatedModels(modelsWithInvalid, target);
      expect(result.every(m => m.id)).toBe(true);
    });
  });

});
