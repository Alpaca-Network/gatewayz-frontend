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
      // OpenRouter returns prices per-token. Display applies the platform
      // markup (PRICING_MARKUP, 1.25x default) on top of the raw price.
      const price = '0.00000015'; // $0.15/M raw -> $0.1875/M after markup
      const gateway = 'openrouter';

      const formatted = formatPricingForDisplay(price, gateway);
      expect(formatted).toBe('0.19');
    });

    it('should format OneRouter per-million pricing for display', () => {
      // OneRouter is in PER_MILLION_PRICING_GATEWAYS — it reports pricing
      // already per-million-tokens (NOT per-token like OpenRouter).
      const price = '0.15'; // $0.15/M raw -> $0.1875/M after markup
      const gateway = 'onerouter';

      const formatted = formatPricingForDisplay(price, gateway);
      expect(formatted).toBe('0.19');
    });

    it('should handle various pricing formats from OpenRouter', () => {
      const testCases = [
        { price: '0.00000015', expected: '0.19' }, // GPT-4o-mini input: $0.15/M -> $0.1875/M
        { price: '0.0000006', expected: '0.75' }, // GPT-4o-mini output: $0.60/M -> $0.75/M
        { price: '0.000003', expected: '3.75' }, // Claude 3 Haiku input: $3.00/M -> $3.75/M
        { price: '0.000015', expected: '18.75' }, // Claude 3 Sonnet input: $15.00/M -> $18.75/M
        { price: '0', expected: '0.00' }, // Free model (markup skipped)
      ];

      testCases.forEach(({ price, expected }) => {
        expect(formatPricingForDisplay(price, 'openrouter')).toBe(expected);
      });
    });

    it('should handle various pricing formats from OneRouter', () => {
      // OneRouter reports the same real-world prices as OpenRouter above,
      // but in per-million (not per-token) format.
      const testCases = [
        { price: '0.15', expected: '0.19' }, // GPT-4o-mini input
        { price: '0.60', expected: '0.75' }, // GPT-4o-mini output
        { price: '3', expected: '3.75' }, // Claude 3 Haiku input
        { price: '15', expected: '18.75' }, // Claude 3 Sonnet input
        { price: '0', expected: '0.00' }, // Free model (markup skipped)
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
          inputCost: 0.00000015, // per-token
          outputCost: 0.0000006,
        },
        {
          name: 'OneRouter',
          source_gateway: 'onerouter',
          inputCost: 0.15, // per-million (same real $0.15/M price as OpenRouter above)
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

      // Both should show the same post-markup price despite differing raw formats
      expect(formattedProviders[0].inputDisplay).toBe('0.19');
      expect(formattedProviders[0].outputDisplay).toBe('0.75');
      expect(formattedProviders[1].inputDisplay).toBe('0.19');
      expect(formattedProviders[1].outputDisplay).toBe('0.75');
    });
  });

  describe('Price comparison across providers', () => {
    it('should correctly compare prices from different gateway formats', () => {
      const openrouterPrice = '0.00000015'; // Per-token: $0.15/M
      const onerouterPrice = '0.15'; // Per-million: $0.15/M (same real price)

      const normalizedOpenrouter = getNormalizedPerTokenPrice(openrouterPrice, 'openrouter');
      const normalizedOnerouter = getNormalizedPerTokenPrice(onerouterPrice, 'onerouter');

      // They should be equal (same real price, different raw formats)
      expect(normalizedOpenrouter).toBeCloseTo(normalizedOnerouter!);
    });

    it('should correctly identify cheaper provider regardless of format', () => {
      const providers = [
        { gateway: 'openrouter', price: '0.00000020' }, // $0.20/M (per-token format)
        { gateway: 'onerouter', price: '0.15' }, // $0.15/M (per-million format)
        { gateway: 'groq', price: '0.25' }, // $0.25/M (per-million format)
      ];

      const normalizedPrices = providers.map((p) => ({
        ...p,
        normalized: getNormalizedPerTokenPrice(p.price, p.gateway),
      }));

      const sorted = normalizedPrices.sort((a, b) => a.normalized! - b.normalized!);

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
      // Very cheap model: $0.01/M raw -> $0.0125/M after markup, displays as 0.01
      const verySmallOpenrouter = formatPricingForDisplay('0.00000001', 'openrouter'); // per-token
      const verySmallOnerouter = formatPricingForDisplay('0.01', 'onerouter'); // per-million

      expect(verySmallOpenrouter).toBe('0.01');
      expect(verySmallOnerouter).toBe('0.01');
    });

    it('should handle very large prices', () => {
      // Very expensive model: $100/M raw -> $125/M after markup, capped at MAX_PRICE_PER_MILLION
      const veryLargeOpenrouter = formatPricingForDisplay('0.0001', 'openrouter'); // per-token
      const veryLargeOnerouter = formatPricingForDisplay('100', 'onerouter'); // per-million

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
