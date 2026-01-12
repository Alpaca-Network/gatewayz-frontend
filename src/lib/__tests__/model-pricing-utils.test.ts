import {
  getSourceGateway,
  isFreeModel,
  getModelPricingCategory,
  isPerMillionPricingGateway,
  isPerBillionPricingGateway,
  formatPricingForDisplay,
  getNormalizedPerTokenPrice,
  ModelPricingInfo,
  MAX_PRICE_PER_MILLION,
} from '../model-pricing-utils';

describe('model-pricing-utils', () => {
  describe('getSourceGateway', () => {
    it('should return source_gateway when available', () => {
      const model: ModelPricingInfo = {
        id: 'test/model',
        source_gateway: 'openrouter',
        source_gateways: ['groq'],
      };

      expect(getSourceGateway(model)).toBe('openrouter');
    });

    it('should fall back to source_gateways[0] when source_gateway is not set', () => {
      const model: ModelPricingInfo = {
        id: 'test/model',
        source_gateways: ['openrouter', 'groq'],
      };

      expect(getSourceGateway(model)).toBe('openrouter');
    });

    it('should return empty string when no gateway info is available', () => {
      const model: ModelPricingInfo = {
        id: 'test/model',
      };

      expect(getSourceGateway(model)).toBe('');
    });

    it('should return empty string when source_gateways is empty array', () => {
      const model: ModelPricingInfo = {
        id: 'test/model',
        source_gateways: [],
      };

      expect(getSourceGateway(model)).toBe('');
    });
  });

  describe('isFreeModel', () => {
    describe('OpenRouter :free suffix detection', () => {
      it('should identify OpenRouter models with :free suffix as free', () => {
        const model: ModelPricingInfo = {
          id: 'google/gemini-2.0-flash-exp:free',
          source_gateway: 'openrouter',
        };

        expect(isFreeModel(model)).toBe(true);
      });

      it('should identify multiple :free suffix models correctly', () => {
        const models: ModelPricingInfo[] = [
          { id: 'meta-llama/llama-3.2-11b-vision-instruct:free', source_gateway: 'openrouter' },
          { id: 'qwen/qwen-2-7b-instruct:free', source_gateway: 'openrouter' },
          { id: 'mistralai/mistral-7b-instruct:free', source_gateway: 'openrouter' },
        ];

        models.forEach((model) => {
          expect(isFreeModel(model)).toBe(true);
        });
      });

      it('should NOT identify models with is_free=true as free (only :free suffix matters)', () => {
        const model: ModelPricingInfo = {
          id: 'openrouter/some-model',
          is_free: true,
          source_gateway: 'openrouter',
        };

        // is_free field is ignored - only :free suffix matters
        expect(isFreeModel(model)).toBe(false);
      });

      it('should identify OpenRouter models without :free suffix as not free', () => {
        const model: ModelPricingInfo = {
          id: 'openai/gpt-4o',
          source_gateway: 'openrouter',
        };

        expect(isFreeModel(model)).toBe(false);
      });

      it('should not mark :free-preview or :free-tier as free (must end with :free)', () => {
        const models: ModelPricingInfo[] = [
          { id: 'model:free-preview', source_gateway: 'openrouter' },
          { id: 'model:free-tier', source_gateway: 'openrouter' },
          { id: 'model:freebie', source_gateway: 'openrouter' },
        ];

        models.forEach((model) => {
          expect(isFreeModel(model)).toBe(false);
        });
      });
    });

    describe('non-OpenRouter gateways', () => {
      it('should not mark non-OpenRouter models as free even with :free suffix', () => {
        const model: ModelPricingInfo = {
          id: 'some-model:free',
          source_gateway: 'groq',
        };

        expect(isFreeModel(model)).toBe(false);
      });

      it('should not mark models from other gateways as free', () => {
        const gateways = ['groq', 'cerebras', 'fireworks', 'together', 'deepinfra', 'near'];

        gateways.forEach((gateway) => {
          const model: ModelPricingInfo = {
            id: 'test-model:free',
            source_gateway: gateway,
          };

          expect(isFreeModel(model)).toBe(false);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle undefined id', () => {
        const model: ModelPricingInfo = {
          source_gateway: 'openrouter',
        };

        expect(isFreeModel(model)).toBe(false);
      });

      it('should handle empty id', () => {
        const model: ModelPricingInfo = {
          id: '',
          source_gateway: 'openrouter',
        };

        expect(isFreeModel(model)).toBe(false);
      });

      it('should use source_gateways fallback correctly', () => {
        const model: ModelPricingInfo = {
          id: 'google/gemini:free',
          source_gateways: ['openrouter'],
        };

        expect(isFreeModel(model)).toBe(true);
      });
    });
  });

  describe('getModelPricingCategory', () => {
    it('should return "Free" for OpenRouter models with :free suffix', () => {
      const model: ModelPricingInfo = {
        id: 'google/gemini-2.0-flash-exp:free',
        source_gateway: 'openrouter',
      };

      expect(getModelPricingCategory(model)).toBe('Free');
    });

    it('should return "Paid" for OpenRouter models without :free suffix', () => {
      const model: ModelPricingInfo = {
        id: 'openai/gpt-4o',
        source_gateway: 'openrouter',
      };

      expect(getModelPricingCategory(model)).toBe('Paid');
    });

    it('should return "Paid" for OpenRouter models with is_free=true but no :free suffix', () => {
      const model: ModelPricingInfo = {
        id: 'openai/gpt-4o',
        is_free: true,
        source_gateway: 'openrouter',
      };

      // is_free field is intentionally ignored
      expect(getModelPricingCategory(model)).toBe('Paid');
    });

    it('should return "Portkey" for portkey gateway models', () => {
      const model: ModelPricingInfo = {
        id: 'portkey/model',
        source_gateway: 'portkey',
      };

      expect(getModelPricingCategory(model)).toBe('Portkey');
    });

    it('should return "Portkey" for portkey models even with :free suffix', () => {
      const model: ModelPricingInfo = {
        id: 'portkey/model:free',
        source_gateway: 'portkey',
      };

      // Portkey takes precedence over :free suffix
      expect(getModelPricingCategory(model)).toBe('Portkey');
    });

    it('should return "Paid" for non-OpenRouter models with :free suffix', () => {
      const model: ModelPricingInfo = {
        id: 'groq/model:free',
        source_gateway: 'groq',
      };

      expect(getModelPricingCategory(model)).toBe('Paid');
    });

    it('should return "Paid" when no gateway info is available', () => {
      const model: ModelPricingInfo = {
        id: 'unknown/model:free',
      };

      expect(getModelPricingCategory(model)).toBe('Paid');
    });

    it('should correctly categorize a batch of mixed models', () => {
      const models: Array<{ model: ModelPricingInfo; expected: string }> = [
        {
          model: { id: 'google/gemini-2.0-flash-exp:free', source_gateway: 'openrouter' },
          expected: 'Free',
        },
        {
          model: { id: 'openai/gpt-4o', source_gateway: 'openrouter' },
          expected: 'Paid',
        },
        {
          model: { id: 'openai/gpt-4o', is_free: true, source_gateway: 'openrouter' },
          expected: 'Paid', // is_free ignored
        },
        {
          model: { id: 'groq/llama-3', source_gateway: 'groq' },
          expected: 'Paid',
        },
        {
          model: { id: 'portkey/custom-model', source_gateway: 'portkey' },
          expected: 'Portkey',
        },
      ];

      models.forEach(({ model, expected }) => {
        expect(getModelPricingCategory(model)).toBe(expected);
      });
    });
  });

  describe('isPerMillionPricingGateway', () => {
    it('should return true for onerouter gateway', () => {
      expect(isPerMillionPricingGateway('onerouter')).toBe(true);
      expect(isPerMillionPricingGateway('OneRouter')).toBe(true);
      expect(isPerMillionPricingGateway('ONEROUTER')).toBe(true);
    });

    it('should return false for standard per-token pricing gateways', () => {
      const perTokenGateways = [
        'openrouter',
        'groq',
        'together',
        'fireworks',
        'deepinfra',
        'cerebras',
        'huggingface',
        'openai',
        'anthropic',
      ];

      perTokenGateways.forEach((gateway) => {
        expect(isPerMillionPricingGateway(gateway)).toBe(false);
      });
    });

    it('should return false for per-billion pricing gateways', () => {
      expect(isPerMillionPricingGateway('aihubmix')).toBe(false);
    });
  });

  describe('isPerBillionPricingGateway', () => {
    it('should return true for aihubmix gateway', () => {
      expect(isPerBillionPricingGateway('aihubmix')).toBe(true);
      expect(isPerBillionPricingGateway('AiHubMix')).toBe(true);
      expect(isPerBillionPricingGateway('AIHUBMIX')).toBe(true);
    });

    it('should return false for standard per-token pricing gateways', () => {
      const perTokenGateways = [
        'openrouter',
        'groq',
        'together',
        'fireworks',
        'deepinfra',
        'cerebras',
        'huggingface',
        'openai',
        'anthropic',
      ];

      perTokenGateways.forEach((gateway) => {
        expect(isPerBillionPricingGateway(gateway)).toBe(false);
      });
    });

    it('should return false for per-million pricing gateways', () => {
      expect(isPerBillionPricingGateway('onerouter')).toBe(false);
    });
  });

  describe('formatPricingForDisplay', () => {
    it('should multiply per-token pricing by 1,000,000 for standard gateways', () => {
      // OpenRouter GPT-4o-mini pricing: $0.00000015/token = $0.15/M
      expect(formatPricingForDisplay('0.00000015', 'openrouter')).toBe('0.15');
      expect(formatPricingForDisplay('0.0000006', 'openrouter')).toBe('0.60');

      // Claude Haiku: $0.000001/token = $1.00/M
      expect(formatPricingForDisplay('0.000001', 'groq')).toBe('1.00');
    });

    it('should NOT multiply for onerouter gateway (already per-million)', () => {
      // OneRouter returns pricing in per-million format
      expect(formatPricingForDisplay('1.00', 'onerouter')).toBe('1.00');
      expect(formatPricingForDisplay('3.00', 'onerouter')).toBe('3.00');
      expect(formatPricingForDisplay('15.00', 'onerouter')).toBe('15.00');
    });

    it('should divide by 1,000 for aihubmix gateway (per-billion format)', () => {
      // AiHubMix returns pricing in per-billion format
      // GPT-4o mini: 150.0 per-billion = $0.15 per-million
      expect(formatPricingForDisplay('150', 'aihubmix')).toBe('0.15');
      expect(formatPricingForDisplay('600', 'aihubmix')).toBe('0.60');

      // Gemini 2.5 Flash: 75000 per-billion = $75.00 per-million
      expect(formatPricingForDisplay('75000', 'aihubmix')).toBe('75.00');

      // Prices above $100/M are capped at $100.00
      // Gemini 2.5 Flash output: 300000 per-billion = $300.00 per-million, but capped at $100
      expect(formatPricingForDisplay('300000', 'aihubmix')).toBe('100.00');

      // Gemini 2.5 Pro: 1250000 per-billion = $1250.00 per-million, but capped at $100
      expect(formatPricingForDisplay('1250000', 'aihubmix')).toBe('100.00');
    });

    it('should return null for undefined or empty price', () => {
      expect(formatPricingForDisplay(undefined, 'openrouter')).toBeNull();
      expect(formatPricingForDisplay('', 'openrouter')).toBeNull();
    });

    it('should return null for non-numeric price', () => {
      expect(formatPricingForDisplay('N/A', 'openrouter')).toBeNull();
      expect(formatPricingForDisplay('free', 'openrouter')).toBeNull();
    });

    it('should handle zero pricing', () => {
      expect(formatPricingForDisplay('0', 'openrouter')).toBe('0.00');
      expect(formatPricingForDisplay('0', 'onerouter')).toBe('0.00');
    });
  });

  describe('getNormalizedPerTokenPrice', () => {
    it('should return price as-is for standard per-token gateways (within limits)', () => {
      expect(getNormalizedPerTokenPrice('0.00000015', 'openrouter')).toBe(0.00000015);
      expect(getNormalizedPerTokenPrice('0.000001', 'groq')).toBe(0.000001);
    });

    it('should divide by 1,000,000 for onerouter gateway', () => {
      // OneRouter $1.00/M = $0.000001/token
      expect(getNormalizedPerTokenPrice('1.00', 'onerouter')).toBe(0.000001);
      // OneRouter $15.00/M = $0.000015/token
      expect(getNormalizedPerTokenPrice('15.00', 'onerouter')).toBe(0.000015);
    });

    it('should handle aihubmix gateway (per-billion format)', () => {
      // AiHubMix 150 per-billion = $0.15/M = $0.00000015/token
      expect(getNormalizedPerTokenPrice('150', 'aihubmix')).toBe(0.00000015);
      // AiHubMix 600 per-billion = $0.60/M = $0.0000006/token
      expect(getNormalizedPerTokenPrice('600', 'aihubmix')).toBe(0.0000006);
    });

    it('should return 0 for undefined or empty price', () => {
      expect(getNormalizedPerTokenPrice(undefined, 'openrouter')).toBe(0);
      expect(getNormalizedPerTokenPrice('', 'openrouter')).toBe(0);
    });

    it('should return 0 for non-numeric price', () => {
      expect(getNormalizedPerTokenPrice('N/A', 'openrouter')).toBe(0);
    });

    it('should apply same price cap as formatPricingForDisplay', () => {
      // $100/M = $0.0001/token is the cap
      const maxPerToken = MAX_PRICE_PER_MILLION / 1000000; // 0.0001

      // Prices exceeding cap should be capped
      expect(getNormalizedPerTokenPrice('0.0002', 'openrouter')).toBe(maxPerToken); // $200/M, capped
      expect(getNormalizedPerTokenPrice('150', 'onerouter')).toBe(maxPerToken); // $150/M, capped
      expect(getNormalizedPerTokenPrice('200000', 'aihubmix')).toBe(maxPerToken); // $200/M, capped
    });

    it('should be consistent with formatPricingForDisplay', () => {
      // Verify that the same price gives consistent results in both functions
      const testCases = [
        { price: '0.00000015', gateway: 'openrouter' },
        { price: '15.00', gateway: 'onerouter' },
        { price: '150', gateway: 'aihubmix' },
        { price: '0.001', gateway: 'openrouter' }, // Exceeds cap
        { price: '500', gateway: 'onerouter' }, // Exceeds cap
      ];

      testCases.forEach(({ price, gateway }) => {
        const displayPrice = parseFloat(formatPricingForDisplay(price, gateway) || '0');
        const normalizedPrice = getNormalizedPerTokenPrice(price, gateway);

        // normalizedPrice * 1,000,000 should equal displayPrice
        expect(normalizedPrice * 1000000).toBeCloseTo(displayPrice, 2);
      });
    });
  });

  describe('pricing normalization integration', () => {
    it('should display consistent pricing for same model from different gateways', () => {
      // GPT-4o-mini from OpenRouter (per-token: 0.00000015)
      const openrouterPrice = formatPricingForDisplay('0.00000015', 'openrouter');

      // Same model from OneRouter (per-million: 0.15)
      const onerouterPrice = formatPricingForDisplay('0.15', 'onerouter');

      // Same model from AiHubMix (per-billion: 150)
      const aihubmixPrice = formatPricingForDisplay('150', 'aihubmix');

      // All should display as $0.15/M
      expect(openrouterPrice).toBe('0.15');
      expect(onerouterPrice).toBe('0.15');
      expect(aihubmixPrice).toBe('0.15');
    });

    it('should filter models consistently regardless of gateway pricing format', () => {
      // Filter range: models costing less than $1/M input
      const maxPerTokenPrice = 1 / 1000000; // $1/M = $0.000001/token

      // OpenRouter model with per-token pricing
      const openrouterPerToken = getNormalizedPerTokenPrice('0.00000015', 'openrouter');
      expect(openrouterPerToken).toBeLessThan(maxPerTokenPrice); // $0.15/M < $1/M

      // OneRouter model with per-million pricing
      const onerouterPerToken = getNormalizedPerTokenPrice('0.15', 'onerouter');
      expect(onerouterPerToken).toBeLessThan(maxPerTokenPrice); // $0.15/M < $1/M

      // AiHubMix model with per-billion pricing
      const aihubmixPerToken = getNormalizedPerTokenPrice('150', 'aihubmix');
      expect(aihubmixPerToken).toBeLessThan(maxPerTokenPrice); // $0.15/M < $1/M

      // Expensive models within the cap ($100) should still be filtered correctly
      const expensiveOpenrouter = getNormalizedPerTokenPrice('0.000015', 'openrouter');
      expect(expensiveOpenrouter).toBeGreaterThan(maxPerTokenPrice); // $15/M > $1/M

      const expensiveOnerouter = getNormalizedPerTokenPrice('15', 'onerouter');
      expect(expensiveOnerouter).toBeGreaterThan(maxPerTokenPrice); // $15/M > $1/M

      const expensiveAihubmix = getNormalizedPerTokenPrice('15000', 'aihubmix');
      expect(expensiveAihubmix).toBeGreaterThan(maxPerTokenPrice); // $15/M > $1/M

      // Verify that capped prices still filter correctly within range
      const cappedPerToken = MAX_PRICE_PER_MILLION / 1000000; // $100/M = $0.0001/token
      const cappedOpenrouter = getNormalizedPerTokenPrice('0.001', 'openrouter'); // Would be $1000/M, capped to $100/M
      expect(cappedOpenrouter).toBe(cappedPerToken);
    });

    it('should correctly handle Gemini pricing from aihubmix (reported bug case)', () => {
      // This test case covers the exact bug reported in the screenshot
      // Gemini 2.5 Flash from aihubmix with per-billion pricing
      // Input: 75000 per-billion should display as $75.00/M (NOT $75,000,000/M!)
      const geminiFlashInput = formatPricingForDisplay('75000', 'aihubmix');
      expect(geminiFlashInput).toBe('75.00');

      // Output: 300000 per-billion = $300.00/M, but capped at $100
      const geminiFlashOutput = formatPricingForDisplay('300000', 'aihubmix');
      expect(geminiFlashOutput).toBe('100.00');

      // Gemini 2.5 Flash Lite
      const geminiFlashLiteInput = formatPricingForDisplay('30000', 'aihubmix');
      expect(geminiFlashLiteInput).toBe('30.00');

      // Output: 120000 per-billion = $120.00/M, but capped at $100
      const geminiFlashLiteOutput = formatPricingForDisplay('120000', 'aihubmix');
      expect(geminiFlashLiteOutput).toBe('100.00');

      // Gemini 2.5 Pro: prices above $100 are capped
      const geminiProInput = formatPricingForDisplay('1250000', 'aihubmix');
      expect(geminiProInput).toBe('100.00');

      const geminiProOutput = formatPricingForDisplay('5000000', 'aihubmix');
      expect(geminiProOutput).toBe('100.00');
    });

    it('should enforce MAX_PRICE_PER_MILLION constant', () => {
      // Verify the constant is set to $100
      expect(MAX_PRICE_PER_MILLION).toBe(100);
    });

    it('should cap prices at $100/M regardless of gateway', () => {
      // Test price capping for various gateways

      // Standard per-token gateway: huge per-token price would exceed cap
      // $200/M = $0.0002/token, when multiplied by 1,000,000 = $200/M, capped at $100
      expect(formatPricingForDisplay('0.0002', 'openrouter')).toBe('100.00');
      expect(formatPricingForDisplay('0.001', 'groq')).toBe('100.00'); // $1000/M, capped

      // Per-million gateway: direct pricing exceeding cap
      expect(formatPricingForDisplay('150', 'onerouter')).toBe('100.00');
      expect(formatPricingForDisplay('500', 'onerouter')).toBe('100.00');

      // Per-billion gateway: pricing that converts to > $100/M
      expect(formatPricingForDisplay('200000', 'aihubmix')).toBe('100.00'); // $200/M, capped
    });

    it('should never return a price higher than $100', () => {
      // This is the key test that ensures the fix works for the reported issue
      const testPrices = [
        // Prices that caused the original bug (Gemini models showing $75000, $300000, etc.)
        { price: '75000', gateway: 'google' },      // Would be $75B/M without cap
        { price: '300000', gateway: 'helicone' },   // Would be $300B/M without cap
        { price: '1250000', gateway: 'vercel-ai-gateway' },  // Would be $1.25T/M without cap
        // Various gateway scenarios
        { price: '0.001', gateway: 'openrouter' },   // $1000/M
        { price: '1000', gateway: 'onerouter' },     // $1000/M
        { price: '500000', gateway: 'aihubmix' },    // $500/M
      ];

      testPrices.forEach(({ price, gateway }) => {
        const result = formatPricingForDisplay(price, gateway);
        if (result !== null) {
          const numericResult = parseFloat(result);
          expect(numericResult).toBeLessThanOrEqual(MAX_PRICE_PER_MILLION);
        }
      });
    });

    it('should allow prices at or below $100/M', () => {
      // Test that legitimate prices under $100 are not affected
      expect(formatPricingForDisplay('0.00000015', 'openrouter')).toBe('0.15');
      expect(formatPricingForDisplay('0.00001', 'openrouter')).toBe('10.00');
      expect(formatPricingForDisplay('0.0001', 'openrouter')).toBe('100.00'); // Exactly $100

      expect(formatPricingForDisplay('50', 'onerouter')).toBe('50.00');
      expect(formatPricingForDisplay('99.99', 'onerouter')).toBe('99.99');
      expect(formatPricingForDisplay('100', 'onerouter')).toBe('100.00');

      expect(formatPricingForDisplay('50000', 'aihubmix')).toBe('50.00');
      expect(formatPricingForDisplay('100000', 'aihubmix')).toBe('100.00');
    });
  });
});
