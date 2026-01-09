/**
 * Tests for ModelsClient Multi-Provider component pricing normalization
 * Verifies that pricing is correctly normalized across different gateways
 */

import {
  getSourceGateway,
  formatPricingForDisplay,
  getNormalizedPerTokenPrice,
} from '@/lib/model-pricing-utils';

describe('ModelsClient Multi-Provider - Pricing Normalization', () => {
  const mockModel = (overrides = {}) => ({
    id: 'test/model',
    name: 'Test Model',
    description: 'A test model',
    context_length: 8000,
    pricing: { prompt: '0.01', completion: '0.03' },
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    supported_parameters: ['temperature', 'top_p'],
    provider_slug: 'test-provider',
    source_gateways: ['openrouter'],
    source_gateway: undefined,
    created: Date.now() / 1000,
    ...overrides,
  });

  describe('ModelCard pricing display', () => {
    it('should display correct pricing for OpenRouter models (per-token format)', () => {
      const model = mockModel({
        id: 'openai/gpt-4o-mini',
        pricing: { prompt: '0.00000015', completion: '0.0000006' },
        source_gateway: 'openrouter',
      });

      const sourceGateway = getSourceGateway(model);
      const inputCost = formatPricingForDisplay(model.pricing?.prompt, sourceGateway);
      const outputCost = formatPricingForDisplay(model.pricing?.completion, sourceGateway);

      expect(inputCost).toBe('0.15');
      expect(outputCost).toBe('0.60');
    });

    it('should display correct pricing for OneRouter models (per-million format)', () => {
      const model = mockModel({
        id: 'openai/gpt-4o-mini',
        pricing: { prompt: '0.15', completion: '0.60' },
        source_gateway: 'onerouter',
      });

      const sourceGateway = getSourceGateway(model);
      const inputCost = formatPricingForDisplay(model.pricing?.prompt, sourceGateway);
      const outputCost = formatPricingForDisplay(model.pricing?.completion, sourceGateway);

      expect(inputCost).toBe('0.15');
      expect(outputCost).toBe('0.60');
    });

    it('should detect free models correctly', () => {
      const freeModel = mockModel({
        pricing: { prompt: '0', completion: '0' },
      });

      const hasPricing = freeModel.pricing !== null && freeModel.pricing !== undefined;
      const isFree =
        hasPricing &&
        parseFloat(freeModel.pricing?.prompt || '0') === 0 &&
        parseFloat(freeModel.pricing?.completion || '0') === 0;

      expect(isFree).toBe(true);
    });

    it('should handle models without pricing', () => {
      const modelNoPricing = mockModel({
        pricing: null,
      });

      const hasPricing = modelNoPricing.pricing !== null && modelNoPricing.pricing !== undefined;

      expect(hasPricing).toBe(false);
    });
  });

  describe('Price filtering with normalized prices', () => {
    const models = [
      mockModel({
        id: 'cheap-openrouter',
        pricing: { prompt: '0.00000015', completion: '0.0000006' }, // $0.15/M + $0.60/M
        source_gateway: 'openrouter',
      }),
      mockModel({
        id: 'cheap-onerouter',
        pricing: { prompt: '0.15', completion: '0.60' }, // $0.15/M + $0.60/M
        source_gateway: 'onerouter',
      }),
      mockModel({
        id: 'expensive-openrouter',
        pricing: { prompt: '0.000015', completion: '0.00006' }, // $15/M + $60/M
        source_gateway: 'openrouter',
      }),
      mockModel({
        id: 'free-model',
        pricing: { prompt: '0', completion: '0' },
        source_gateway: 'openrouter',
      }),
    ];

    it('should filter models by price range correctly', () => {
      const promptPricingRange: [number, number] = [0, 1]; // $0-$1 per M tokens

      const filtered = models.filter((model) => {
        const isFree =
          parseFloat(model.pricing?.prompt || '0') === 0 &&
          parseFloat(model.pricing?.completion || '0') === 0;
        const modelSourceGateway = getSourceGateway(model);
        const normalizedPromptPrice = getNormalizedPerTokenPrice(
          model.pricing?.prompt,
          modelSourceGateway
        );
        const normalizedCompletionPrice = getNormalizedPerTokenPrice(
          model.pricing?.completion,
          modelSourceGateway
        );
        const avgPrice = (normalizedPromptPrice + normalizedCompletionPrice) / 2;
        const priceMatch =
          isFree ||
          (avgPrice >= promptPricingRange[0] / 1000000 &&
            avgPrice <= promptPricingRange[1] / 1000000);

        return priceMatch;
      });

      // Should include free model, cheap-openrouter, cheap-onerouter (all under $1/M avg)
      // Should exclude expensive-openrouter ($37.50/M avg)
      expect(filtered).toHaveLength(3);
      expect(filtered.map((m) => m.id)).toEqual([
        'cheap-openrouter',
        'cheap-onerouter',
        'free-model',
      ]);
    });
  });

  describe('Price sorting with normalized prices', () => {
    it('should sort by price-asc correctly across gateways', () => {
      const models = [
        mockModel({
          id: 'expensive',
          pricing: { prompt: '0.000015', completion: '0.00006' }, // $75/M total
          source_gateway: 'openrouter',
        }),
        mockModel({
          id: 'cheap-onerouter',
          pricing: { prompt: '0.15', completion: '0.60' }, // $0.75/M total
          source_gateway: 'onerouter',
        }),
        mockModel({
          id: 'mid',
          pricing: { prompt: '0.000001', completion: '0.000003' }, // $4/M total
          source_gateway: 'openrouter',
        }),
      ];

      // Sort by price ascending using normalized prices
      const sorted = [...models].sort((a, b) => {
        const aGateway = getSourceGateway(a);
        const bGateway = getSourceGateway(b);
        const aTotalPrice =
          getNormalizedPerTokenPrice(a.pricing?.prompt, aGateway) +
          getNormalizedPerTokenPrice(a.pricing?.completion, aGateway);
        const bTotalPrice =
          getNormalizedPerTokenPrice(b.pricing?.prompt, bGateway) +
          getNormalizedPerTokenPrice(b.pricing?.completion, bGateway);
        return aTotalPrice - bTotalPrice;
      });

      expect(sorted.map((m) => m.id)).toEqual(['cheap-onerouter', 'mid', 'expensive']);
    });

    it('should sort by price-desc correctly across gateways', () => {
      const models = [
        mockModel({
          id: 'expensive',
          pricing: { prompt: '0.000015', completion: '0.00006' }, // $75/M total
          source_gateway: 'openrouter',
        }),
        mockModel({
          id: 'cheap-onerouter',
          pricing: { prompt: '0.15', completion: '0.60' }, // $0.75/M total
          source_gateway: 'onerouter',
        }),
        mockModel({
          id: 'mid',
          pricing: { prompt: '0.000001', completion: '0.000003' }, // $4/M total
          source_gateway: 'openrouter',
        }),
      ];

      // Sort by price descending using normalized prices
      const sorted = [...models].sort((a, b) => {
        const aGateway = getSourceGateway(a);
        const bGateway = getSourceGateway(b);
        const aTotalPrice =
          getNormalizedPerTokenPrice(a.pricing?.prompt, aGateway) +
          getNormalizedPerTokenPrice(a.pricing?.completion, aGateway);
        const bTotalPrice =
          getNormalizedPerTokenPrice(b.pricing?.prompt, bGateway) +
          getNormalizedPerTokenPrice(b.pricing?.completion, bGateway);
        return bTotalPrice - aTotalPrice;
      });

      expect(sorted.map((m) => m.id)).toEqual(['expensive', 'mid', 'cheap-onerouter']);
    });

    it('should handle mixed gateways with same actual price', () => {
      const models = [
        mockModel({
          id: 'model-openrouter',
          pricing: { prompt: '0.00000015', completion: '0.0000006' },
          source_gateway: 'openrouter',
        }),
        mockModel({
          id: 'model-onerouter',
          pricing: { prompt: '0.15', completion: '0.60' },
          source_gateway: 'onerouter',
        }),
      ];

      // Both should have the same normalized price
      const aGateway = getSourceGateway(models[0]);
      const bGateway = getSourceGateway(models[1]);

      const aTotal =
        getNormalizedPerTokenPrice(models[0].pricing?.prompt, aGateway) +
        getNormalizedPerTokenPrice(models[0].pricing?.completion, aGateway);
      const bTotal =
        getNormalizedPerTokenPrice(models[1].pricing?.prompt, bGateway) +
        getNormalizedPerTokenPrice(models[1].pricing?.completion, bGateway);

      // Prices should be equal (within floating point tolerance)
      expect(Math.abs(aTotal - bTotal)).toBeLessThan(0.0000000001);
    });
  });

  describe('Gateway extraction edge cases', () => {
    it('should prefer source_gateway over source_gateways', () => {
      const model = mockModel({
        source_gateway: 'openrouter',
        source_gateways: ['onerouter', 'groq'],
      });

      expect(getSourceGateway(model)).toBe('openrouter');
    });

    it('should fall back to source_gateways[0] when source_gateway is undefined', () => {
      const model = mockModel({
        source_gateway: undefined,
        source_gateways: ['onerouter', 'groq'],
      });

      expect(getSourceGateway(model)).toBe('onerouter');
    });

    it('should return empty string when no gateway info available', () => {
      const model = mockModel({
        source_gateway: undefined,
        source_gateways: undefined,
      });

      expect(getSourceGateway(model)).toBe('');
    });

    it('should return empty string for empty source_gateways array', () => {
      const model = mockModel({
        source_gateway: undefined,
        source_gateways: [],
      });

      expect(getSourceGateway(model)).toBe('');
    });
  });
});
