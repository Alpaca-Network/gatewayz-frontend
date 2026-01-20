import {
  extractModelNameFromId,
  findModelByRouteParams,
  getModelGateways,
  getRelatedModels,
  transformStaticModel,
  type ModelDetailRecord,
  type ModelLookupParams,
} from '../model-detail-utils';
import type { Model as StaticModelDefinition } from '@/lib/models-data';
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

  describe('transformStaticModel', () => {
    it('should transform a static model to ModelDetailRecord', () => {
      const staticModel: StaticModelDefinition = {
        name: 'OpenAI: GPT-4',
        isFree: false,
        tokens: '8K',
        category: 'Chat',
        description: 'Advanced language model',
        developer: 'openai',
        context: 8,
        inputCost: 0.03,
        outputCost: 0.06,
        modalities: ['Text'],
        series: 'gpt-4',
        supportedParameters: ['temperature', 'top_p'],
      };

      const result = transformStaticModel(staticModel);

      expect(result.id).toBe('openai/gpt-4');
      expect(result.name).toBe('OpenAI: GPT-4');
      expect(result.description).toBe('Advanced language model');
      expect(result.context_length).toBe(8000);
      // Pricing should be converted from per-million to per-token format
      // inputCost: 0.03 (per-million) -> 0.00000003 (per-token)
      expect(result.pricing?.prompt).toBe('3e-8'); // 0.03 / 1000000
      expect(result.pricing?.completion).toBe('6e-8'); // 0.06 / 1000000
      expect(result.architecture?.input_modalities).toEqual(['text']);
      expect(result.supported_parameters).toEqual(['temperature', 'top_p']);
      expect(result.provider_slug).toBe('openai');
      expect(result.provider_slugs).toEqual(['openai']);
    });

    it('should handle model names without colon', () => {
      const staticModel: StaticModelDefinition = {
        name: 'GPT-4',
        isFree: false,
        tokens: '8K',
        category: 'Chat',
        description: 'Test',
        developer: 'openai',
        context: 8,
        inputCost: 0.03,
        outputCost: 0.06,
        modalities: ['Text'],
        series: 'gpt-4',
        supportedParameters: [],
      };

      const result = transformStaticModel(staticModel);
      expect(result.id).toBe('openai/gpt-4');
    });

    it('should handle private models', () => {
      const staticModel: StaticModelDefinition = {
        name: 'Private Model',
        isFree: false,
        tokens: '8K',
        category: 'Chat',
        description: 'Test',
        developer: 'custom',
        context: 8,
        inputCost: 0.03,
        outputCost: 0.06,
        modalities: ['Text'],
        series: 'custom',
        supportedParameters: [],
        is_private: true,
      };

      const result = transformStaticModel(staticModel);
      expect(result.is_private).toBe(true);
    });

    it('should normalize modalities to lowercase', () => {
      const staticModel: StaticModelDefinition = {
        name: 'Multimodal Model',
        isFree: false,
        tokens: '8K',
        category: 'Chat',
        description: 'Test',
        developer: 'test',
        context: 8,
        inputCost: 0.03,
        outputCost: 0.06,
        modalities: ['TEXT', 'Image', 'AuDiO'],
        series: 'test',
        supportedParameters: [],
      };

      const result = transformStaticModel(staticModel);
      expect(result.architecture?.input_modalities).toEqual(['text', 'image', 'audio']);
    });

    it('should convert context from K to actual number', () => {
      const staticModel: StaticModelDefinition = {
        name: 'Test Model',
        isFree: false,
        tokens: '128K',
        category: 'Chat',
        description: 'Test',
        developer: 'test',
        context: 128,
        inputCost: 0.01,
        outputCost: 0.02,
        modalities: ['Text'],
        series: 'test',
        supportedParameters: [],
      };

      const result = transformStaticModel(staticModel);
      expect(result.context_length).toBe(128000);
    });

    it('should convert pricing from per-million to per-token format for standard gateways', () => {
      // This test verifies the pricing conversion for display purposes
      const { formatPricingForDisplay } = require('@/lib/model-pricing-utils');

      const staticModel: StaticModelDefinition = {
        name: 'GPT-4o mini',
        isFree: false,
        tokens: '21B',
        category: 'Chat',
        description: 'Test',
        developer: 'openai',
        context: 128,
        inputCost: 0.15, // $0.15/M in static data
        outputCost: 0.60, // $0.60/M in static data
        modalities: ['Text'],
        series: 'gpt-4',
        supportedParameters: [],
      };

      const result = transformStaticModel(staticModel);

      // Verify pricing is converted to per-token format
      const promptPrice = parseFloat(result.pricing?.prompt || '0');
      const completionPrice = parseFloat(result.pricing?.completion || '0');

      // Should be very small numbers (per-token)
      expect(promptPrice).toBeCloseTo(0.00000015, 10);
      expect(completionPrice).toBeCloseTo(0.0000006, 10);

      // Verify formatPricingForDisplay correctly converts back for display
      // Using 'openrouter' as a standard per-token gateway
      const displayPrompt = formatPricingForDisplay(result.pricing?.prompt, 'openrouter');
      const displayCompletion = formatPricingForDisplay(result.pricing?.completion, 'openrouter');

      expect(displayPrompt).toBe('0.15');
      expect(displayCompletion).toBe('0.60');
    });

    it('should keep pricing as per-million format for per-million gateways like onerouter', () => {
      // This test verifies that per-million gateways receive pricing in the correct format
      const { formatPricingForDisplay } = require('@/lib/model-pricing-utils');

      const staticModel: StaticModelDefinition = {
        name: 'GPT-4o mini',
        isFree: false,
        tokens: '21B',
        category: 'Chat',
        description: 'Test',
        developer: 'openai',
        context: 128,
        inputCost: 0.15, // $0.15/M in static data
        outputCost: 0.60, // $0.60/M in static data
        modalities: ['Text'],
        series: 'gpt-4',
        supportedParameters: [],
      };

      // Transform with onerouter gateway (per-million pricing gateway)
      const result = transformStaticModel(staticModel, 'onerouter');

      // Verify pricing is kept as per-million format (not converted)
      const promptPrice = parseFloat(result.pricing?.prompt || '0');
      const completionPrice = parseFloat(result.pricing?.completion || '0');

      // Should be the original per-million values
      expect(promptPrice).toBe(0.15);
      expect(completionPrice).toBe(0.60);

      // Verify formatPricingForDisplay correctly displays for per-million gateway
      // It skips the multiplication since onerouter is a per-million gateway
      const displayPrompt = formatPricingForDisplay(result.pricing?.prompt, 'onerouter');
      const displayCompletion = formatPricingForDisplay(result.pricing?.completion, 'onerouter');

      expect(displayPrompt).toBe('0.15');
      expect(displayCompletion).toBe('0.60');
    });

    it('should use default empty gateway (standard per-token) when no gateway specified', () => {
      const { formatPricingForDisplay } = require('@/lib/model-pricing-utils');

      const staticModel: StaticModelDefinition = {
        name: 'Test Model',
        isFree: false,
        tokens: '8K',
        category: 'Chat',
        description: 'Test',
        developer: 'test',
        context: 8,
        inputCost: 1.0, // $1.00/M in static data
        outputCost: 2.0, // $2.00/M in static data
        modalities: ['Text'],
        series: 'test',
        supportedParameters: [],
      };

      // No gateway specified - should use default empty string (standard per-token gateway)
      const result = transformStaticModel(staticModel);

      // Pricing should be converted to per-token format
      const promptPrice = parseFloat(result.pricing?.prompt || '0');
      expect(promptPrice).toBeCloseTo(0.000001, 10); // 1.0 / 1000000

      // formatPricingForDisplay with empty gateway treats it as per-token gateway
      const displayPrompt = formatPricingForDisplay(result.pricing?.prompt, '');
      expect(displayPrompt).toBe('1.00');
    });
  });
});
