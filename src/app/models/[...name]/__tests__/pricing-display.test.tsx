/**
 * Tests for Model Detail Page pricing display
 * Verifies that pricing is correctly normalized for display across different gateways
 */

import {
  getSourceGateway,
  formatPricingForDisplay,
  getNormalizedPerTokenPrice,
} from '@/lib/model-pricing-utils';

describe('Model Detail Page - Pricing Display', () => {
  describe('formatPrice function behavior', () => {
    it('should format OpenRouter per-token pricing for display', () => {
      // OpenRouter returns prices per-token
      const price = '0.00000015'; // $0.00000015/token = $0.15/M
      const gateway = 'openrouter';

      const formatted = formatPricingForDisplay(price, gateway);
      expect(formatted).toBe('0.15');
    });

    it('should format OneRouter per-million pricing for display', () => {
      // OneRouter returns prices per-million
      const price = '0.15'; // Already $0.15/M
      const gateway = 'onerouter';

      const formatted = formatPricingForDisplay(price, gateway);
      expect(formatted).toBe('0.15');
    });

    it('should handle various pricing formats from OpenRouter', () => {
      const testCases = [
        { price: '0.00000015', expected: '0.15' }, // GPT-4o-mini input
        { price: '0.0000006', expected: '0.60' }, // GPT-4o-mini output
        { price: '0.000003', expected: '3.00' }, // Claude 3 Haiku input
        { price: '0.000015', expected: '15.00' }, // Claude 3 Sonnet input
        { price: '0', expected: '0.00' }, // Free model
      ];

      testCases.forEach(({ price, expected }) => {
        expect(formatPricingForDisplay(price, 'openrouter')).toBe(expected);
      });
    });

    it('should handle various pricing formats from OneRouter', () => {
      const testCases = [
        { price: '0.15', expected: '0.15' },
        { price: '0.60', expected: '0.60' },
        { price: '3.00', expected: '3.00' },
        { price: '15.00', expected: '15.00' },
        { price: '0', expected: '0.00' },
      ];

      testCases.forEach(({ price, expected }) => {
        expect(formatPricingForDisplay(price, 'onerouter')).toBe(expected);
      });
    });
  });

  describe('Provider row pricing display', () => {
    interface Provider {
      name: string;
      source_gateway?: string;
      inputCost?: number | string;
      outputCost?: number | string;
    }

    it('should display correct pricing for providers from different gateways', () => {
      const providers: Provider[] = [
        {
          name: 'OpenRouter',
          source_gateway: 'openrouter',
          inputCost: 0.00000015,
          outputCost: 0.0000006,
        },
        {
          name: 'OneRouter',
          source_gateway: 'onerouter',
          inputCost: 0.15,
          outputCost: 0.6,
        },
      ];

      const formattedProviders = providers.map((provider) => ({
        name: provider.name,
        inputDisplay: formatPricingForDisplay(
          provider.inputCost?.toString(),
          provider.source_gateway || ''
        ),
        outputDisplay: formatPricingForDisplay(
          provider.outputCost?.toString(),
          provider.source_gateway || ''
        ),
      }));

      // Both should show same price
      expect(formattedProviders[0].inputDisplay).toBe('0.15');
      expect(formattedProviders[0].outputDisplay).toBe('0.60');
      expect(formattedProviders[1].inputDisplay).toBe('0.15');
      expect(formattedProviders[1].outputDisplay).toBe('0.60');
    });
  });

  describe('Price comparison across providers', () => {
    it('should correctly compare prices from different gateway formats', () => {
      const openrouterPrice = 0.00000015; // Per-token
      const onerouterPrice = 0.15; // Per-million

      // Normalize both to per-token
      const normalizedOpenrouter = getNormalizedPerTokenPrice(
        openrouterPrice.toString(),
        'openrouter'
      );
      const normalizedOnerouter = getNormalizedPerTokenPrice(onerouterPrice.toString(), 'onerouter');

      // They should be equal (same price, different formats)
      expect(normalizedOpenrouter).toBeCloseTo(normalizedOnerouter);
    });

    it('should correctly identify cheaper provider regardless of format', () => {
      const providers = [
        { gateway: 'openrouter', price: '0.00000020' }, // $0.20/M (per-token format)
        { gateway: 'onerouter', price: '0.15' }, // $0.15/M (per-million format)
        { gateway: 'groq', price: '0.25' }, // $0.25/M (per-million format - groq uses per-million)
      ];

      const normalizedPrices = providers.map((p) => ({
        ...p,
        normalized: getNormalizedPerTokenPrice(p.price, p.gateway),
      }));

      const sorted = normalizedPrices.sort((a, b) => a.normalized - b.normalized);

      expect(sorted[0].gateway).toBe('onerouter'); // Cheapest at $0.15/M
      expect(sorted[1].gateway).toBe('openrouter'); // $0.20/M
      expect(sorted[2].gateway).toBe('groq'); // Most expensive at $0.25/M
    });
  });

  describe('Edge cases in pricing display', () => {
    it('should handle undefined pricing', () => {
      expect(formatPricingForDisplay(undefined, 'openrouter')).toBeNull();
      expect(formatPricingForDisplay(undefined, 'onerouter')).toBeNull();
    });

    it('should handle empty string pricing', () => {
      expect(formatPricingForDisplay('', 'openrouter')).toBeNull();
      expect(formatPricingForDisplay('', 'onerouter')).toBeNull();
    });

    it('should handle non-numeric pricing', () => {
      expect(formatPricingForDisplay('N/A', 'openrouter')).toBeNull();
      expect(formatPricingForDisplay('Contact us', 'onerouter')).toBeNull();
    });

    it('should handle very small prices', () => {
      // Very cheap model: $0.01/M
      const verySmallOpenrouter = formatPricingForDisplay('0.00000001', 'openrouter');
      const verySmallOnerouter = formatPricingForDisplay('0.01', 'onerouter');

      expect(verySmallOpenrouter).toBe('0.01');
      expect(verySmallOnerouter).toBe('0.01');
    });

    it('should handle very large prices', () => {
      // Very expensive model: $100/M
      const veryLargeOpenrouter = formatPricingForDisplay('0.0001', 'openrouter');
      const veryLargeOnerouter = formatPricingForDisplay('100', 'onerouter');

      expect(veryLargeOpenrouter).toBe('100.00');
      expect(veryLargeOnerouter).toBe('100.00');
    });
  });

  describe('Source gateway extraction from model data', () => {
    it('should extract gateway from various model formats', () => {
      // Model with source_gateway field
      expect(getSourceGateway({ id: 'test', source_gateway: 'openrouter' })).toBe('openrouter');

      // Model with source_gateways array
      expect(
        getSourceGateway({ id: 'test', source_gateways: ['onerouter', 'groq'] })
      ).toBe('onerouter');

      // Model with both (source_gateway takes precedence)
      expect(
        getSourceGateway({
          id: 'test',
          source_gateway: 'openrouter',
          source_gateways: ['onerouter'],
        })
      ).toBe('openrouter');

      // Model with no gateway info
      expect(getSourceGateway({ id: 'test' })).toBe('');
    });
  });
});
