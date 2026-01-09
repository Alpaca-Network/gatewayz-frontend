/**
 * Tests for Organization Page pricing display
 * Verifies that model pricing is correctly normalized in organization model listings
 */

import {
  getSourceGateway,
  formatPricingForDisplay,
  getNormalizedPerTokenPrice,
} from '@/lib/model-pricing-utils';

describe('Organization Page - Pricing Display', () => {
  interface Model {
    id: string;
    name: string;
    pricing?: {
      prompt?: string | number;
      completion?: string | number;
    };
    source_gateway?: string;
    source_gateways?: string[];
  }

  const createModel = (overrides: Partial<Model> = {}): Model => ({
    id: 'test/model',
    name: 'Test Model',
    pricing: { prompt: '0.000001', completion: '0.000003' },
    source_gateway: 'openrouter',
    ...overrides,
  });

  describe('Model pricing in organization listing', () => {
    it('should format pricing correctly for OpenRouter models', () => {
      const model = createModel({
        id: 'openai/gpt-4o-mini',
        pricing: { prompt: '0.00000015', completion: '0.0000006' },
        source_gateway: 'openrouter',
      });

      const gateway = getSourceGateway(model);
      const promptPrice = formatPricingForDisplay(model.pricing?.prompt?.toString(), gateway);
      const completionPrice = formatPricingForDisplay(model.pricing?.completion?.toString(), gateway);

      expect(promptPrice).toBe('0.15');
      expect(completionPrice).toBe('0.60');
    });

    it('should format pricing correctly for OneRouter models', () => {
      const model = createModel({
        id: 'openai/gpt-4o-mini',
        pricing: { prompt: '0.15', completion: '0.60' },
        source_gateway: 'onerouter',
      });

      const gateway = getSourceGateway(model);
      const promptPrice = formatPricingForDisplay(model.pricing?.prompt?.toString(), gateway);
      const completionPrice = formatPricingForDisplay(model.pricing?.completion?.toString(), gateway);

      expect(promptPrice).toBe('0.15');
      expect(completionPrice).toBe('0.60');
    });
  });

  describe('Model sorting by price', () => {
    it('should sort models by price correctly across different gateways', () => {
      const models: Model[] = [
        createModel({
          id: 'expensive-model',
          name: 'Expensive Model',
          pricing: { prompt: '0.000015', completion: '0.00003' }, // $15 + $30 = $45/M
          source_gateway: 'openrouter',
        }),
        createModel({
          id: 'cheap-onerouter',
          name: 'Cheap Model',
          pricing: { prompt: '0.15', completion: '0.30' }, // $0.15 + $0.30 = $0.45/M
          source_gateway: 'onerouter',
        }),
        createModel({
          id: 'mid-model',
          name: 'Mid Model',
          pricing: { prompt: '0.000003', completion: '0.000006' }, // $3 + $6 = $9/M
          source_gateway: 'openrouter',
        }),
      ];

      // Sort by total price ascending
      const sorted = [...models].sort((a, b) => {
        const aGateway = getSourceGateway(a);
        const bGateway = getSourceGateway(b);
        const aTotal =
          getNormalizedPerTokenPrice(a.pricing?.prompt?.toString(), aGateway) +
          getNormalizedPerTokenPrice(a.pricing?.completion?.toString(), aGateway);
        const bTotal =
          getNormalizedPerTokenPrice(b.pricing?.prompt?.toString(), bGateway) +
          getNormalizedPerTokenPrice(b.pricing?.completion?.toString(), bGateway);
        return aTotal - bTotal;
      });

      expect(sorted[0].id).toBe('cheap-onerouter');
      expect(sorted[1].id).toBe('mid-model');
      expect(sorted[2].id).toBe('expensive-model');
    });
  });

  describe('Price filtering', () => {
    it('should filter models by price range correctly', () => {
      const models: Model[] = [
        createModel({
          id: 'cheap',
          pricing: { prompt: '0.00000015', completion: '0.0000006' }, // $0.15 + $0.60 = $0.75/M
          source_gateway: 'openrouter',
        }),
        createModel({
          id: 'expensive',
          pricing: { prompt: '0.000015', completion: '0.00006' }, // $15 + $60 = $75/M
          source_gateway: 'openrouter',
        }),
        createModel({
          id: 'onerouter-cheap',
          pricing: { prompt: '0.10', completion: '0.40' }, // $0.10 + $0.40 = $0.50/M
          source_gateway: 'onerouter',
        }),
      ];

      // Filter for models with total price under $10/M
      const maxTotalPricePerMillion = 10;
      const maxPerToken = maxTotalPricePerMillion / 1000000;

      const filtered = models.filter((model) => {
        const gateway = getSourceGateway(model);
        const totalPerToken =
          getNormalizedPerTokenPrice(model.pricing?.prompt?.toString(), gateway) +
          getNormalizedPerTokenPrice(model.pricing?.completion?.toString(), gateway);
        return totalPerToken <= maxPerToken;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.id)).toContain('cheap');
      expect(filtered.map((m) => m.id)).toContain('onerouter-cheap');
    });
  });

  describe('Edge cases', () => {
    it('should handle models with numeric pricing values', () => {
      const model = createModel({
        pricing: { prompt: 0.00000015, completion: 0.0000006 },
        source_gateway: 'openrouter',
      });

      const gateway = getSourceGateway(model);
      const promptPrice = formatPricingForDisplay(model.pricing?.prompt?.toString(), gateway);

      expect(promptPrice).toBe('0.15');
    });

    it('should handle models with missing gateway info', () => {
      const model = createModel({
        source_gateway: undefined,
        source_gateways: undefined,
      });

      const gateway = getSourceGateway(model);
      expect(gateway).toBe('');

      // Should still format pricing (defaulting to per-token multiplication)
      const price = formatPricingForDisplay('0.000001', gateway);
      expect(price).toBe('1.00');
    });

    it('should handle models with null pricing', () => {
      const model = createModel({
        pricing: undefined,
      });

      const gateway = getSourceGateway(model);
      const price = formatPricingForDisplay(undefined, gateway);

      expect(price).toBeNull();
    });

    it('should handle free models (zero pricing)', () => {
      const model = createModel({
        pricing: { prompt: '0', completion: '0' },
        source_gateway: 'openrouter',
      });

      const gateway = getSourceGateway(model);
      const promptPrice = formatPricingForDisplay(model.pricing?.prompt?.toString(), gateway);
      const completionPrice = formatPricingForDisplay(model.pricing?.completion?.toString(), gateway);

      expect(promptPrice).toBe('0.00');
      expect(completionPrice).toBe('0.00');

      // Normalized should also be 0
      expect(getNormalizedPerTokenPrice('0', gateway)).toBe(0);
    });
  });

  describe('Gateway precedence', () => {
    it('should use source_gateway over source_gateways when both present', () => {
      const model = createModel({
        source_gateway: 'openrouter',
        source_gateways: ['onerouter', 'groq'],
      });

      expect(getSourceGateway(model)).toBe('openrouter');
    });

    it('should fall back to source_gateways[0] when source_gateway is undefined', () => {
      const model = createModel({
        source_gateway: undefined,
        source_gateways: ['onerouter', 'groq'],
      });

      expect(getSourceGateway(model)).toBe('onerouter');
    });
  });
});
