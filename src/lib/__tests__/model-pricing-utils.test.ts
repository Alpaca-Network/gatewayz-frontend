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
    it('should return false for all gateways (backend normalizes all pricing to per-token)', () => {
      // After the backend pricing normalization fix, ALL pricing is returned in per-token format.
      // The frontend treats everything as per-token and multiplies by 1M for display.
      // No gateways need special per-million handling.
      const allGateways = [
        'openrouter', 'onerouter', 'groq', 'deepinfra', 'featherless',
        'chutes', 'together', 'near', 'fireworks', 'cerebras', 'novita',
        'nebius', 'xai', 'google', 'google-vertex', 'helicone',
        'vercel-ai-gateway', 'alibaba', 'alibaba-cloud', 'clarifai',
        'simplismart', 'akash', 'cloudflare-workers-ai', 'alpaca-network',
        'openai', 'anthropic', 'huggingface', 'aihubmix',
      ];

      allGateways.forEach((gateway) => {
        expect(isPerMillionPricingGateway(gateway)).toBe(false);
      });
    });
  });

  describe('isPerBillionPricingGateway', () => {
    it('should return false for all gateways (backend normalizes all pricing to per-token)', () => {
      // After the backend pricing normalization fix, ALL pricing is returned in per-token format.
      // No gateways need special per-billion handling.
      const allGateways = [
        'openrouter', 'aihubmix', 'onerouter', 'groq', 'deepinfra',
        'openai', 'anthropic', 'huggingface',
      ];

      allGateways.forEach((gateway) => {
        expect(isPerBillionPricingGateway(gateway)).toBe(false);
      });
    });
  });

  describe('formatPricingForDisplay', () => {
    it('should multiply per-token pricing by 1,000,000 for display', () => {
      // Backend returns per-token pricing for ALL gateways
      // Frontend multiplies by 1M to show per-million-tokens for display

      // OpenRouter GPT-4o-mini: $0.00000015/token = $0.15/MTok
      expect(formatPricingForDisplay('0.00000015', 'openrouter')).toBe('0.15');
      expect(formatPricingForDisplay('0.0000006', 'openrouter')).toBe('0.60');
    });

    it('should multiply per-token pricing for all gateways consistently', () => {
      // All gateways now return per-token from backend

      // OpenAI direct: $0.0000025/token = $2.50/MTok
      expect(formatPricingForDisplay('0.0000025', 'openai')).toBe('2.50');
      expect(formatPricingForDisplay('0.00001', 'openai')).toBe('10.00');
      expect(formatPricingForDisplay('0.00000015', 'openai')).toBe('0.15');

      // Anthropic direct: $0.000003/token = $3.00/MTok
      expect(formatPricingForDisplay('0.000003', 'anthropic')).toBe('3.00');
      expect(formatPricingForDisplay('0.000015', 'anthropic')).toBe('15.00');

      // Groq: $0.00000005/token = $0.05/MTok
      expect(formatPricingForDisplay('0.00000005', 'groq')).toBe('0.05');

      // DeepInfra: $0.00000035/token = $0.35/MTok
      expect(formatPricingForDisplay('0.00000035', 'deepinfra')).toBe('0.35');

      // OneRouter: $0.000001/token = $1.00/MTok
      expect(formatPricingForDisplay('0.000001', 'onerouter')).toBe('1.00');

      // Google Vertex: $0.000000075/token = $0.075/MTok
      expect(formatPricingForDisplay('0.000000075', 'google-vertex')).toBe('0.07');
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
    it('should return per-token price as-is (within cap limits)', () => {
      // Backend returns per-token, frontend normalizeToPerMillion multiplies by 1M then divides back
      expect(getNormalizedPerTokenPrice('0.00000015', 'openrouter')).toBe(0.00000015);
    });

    it('should return consistent per-token prices for all gateways', () => {
      // All gateways return per-token from backend
      expect(getNormalizedPerTokenPrice('0.00000005', 'groq')).toBeCloseTo(0.00000005, 12);
      expect(getNormalizedPerTokenPrice('0.00000035', 'deepinfra')).toBeCloseTo(0.00000035, 12);
      expect(getNormalizedPerTokenPrice('0.000001', 'onerouter')).toBe(0.000001);
      expect(getNormalizedPerTokenPrice('0.000015', 'onerouter')).toBe(0.000015);
    });

    it('should return null for undefined or empty price', () => {
      expect(getNormalizedPerTokenPrice(undefined, 'openrouter')).toBeNull();
      expect(getNormalizedPerTokenPrice('', 'openrouter')).toBeNull();
    });

    it('should return null for non-numeric price', () => {
      expect(getNormalizedPerTokenPrice('N/A', 'openrouter')).toBeNull();
    });

    it('should apply price cap at MAX_PRICE_PER_MILLION', () => {
      // $100/M = $0.0001/token is the cap
      const maxPerToken = MAX_PRICE_PER_MILLION / 1000000; // 0.0001

      // Prices exceeding cap should be capped
      expect(getNormalizedPerTokenPrice('0.0002', 'openrouter')).toBe(maxPerToken); // $200/M, capped
    });

    it('should be consistent with formatPricingForDisplay', () => {
      // Verify that the same price gives consistent results in both functions
      const testCases = [
        { price: '0.00000015', gateway: 'openrouter' },
        { price: '0.000001', gateway: 'onerouter' },
        { price: '0.00000005', gateway: 'groq' },
        { price: '0.0002', gateway: 'openrouter' }, // Exceeds cap
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
      // After backend normalization fix, all gateways return per-token format
      // GPT-4o-mini costs $0.15/MTok = $0.00000015/token

      const openrouterPrice = formatPricingForDisplay('0.00000015', 'openrouter');
      const groqPrice = formatPricingForDisplay('0.00000015', 'groq');
      const deepinfraPrice = formatPricingForDisplay('0.00000015', 'deepinfra');

      // All should display as $0.15/M
      expect(openrouterPrice).toBe('0.15');
      expect(groqPrice).toBe('0.15');
      expect(deepinfraPrice).toBe('0.15');
    });

    it('should filter models consistently regardless of gateway', () => {
      // Filter range: models costing less than $1/M input
      const maxPerTokenPrice = 1 / 1000000; // $1/M = $0.000001/token

      // All gateways return per-token from backend
      const cheapModel = getNormalizedPerTokenPrice('0.00000015', 'openrouter');
      expect(cheapModel).toBeLessThan(maxPerTokenPrice); // $0.15/M < $1/M

      const cheapGroqModel = getNormalizedPerTokenPrice('0.00000005', 'groq');
      expect(cheapGroqModel).toBeLessThan(maxPerTokenPrice); // $0.05/M < $1/M

      // Expensive models within the cap ($100)
      const expensiveModel = getNormalizedPerTokenPrice('0.000015', 'openrouter');
      expect(expensiveModel).toBeGreaterThan(maxPerTokenPrice); // $15/M > $1/M

      // Verify that capped prices still filter correctly within range
      const cappedPerToken = MAX_PRICE_PER_MILLION / 1000000; // $100/M = $0.0001/token
      const cappedOpenrouter = getNormalizedPerTokenPrice('0.001', 'openrouter'); // Would be $1000/M, capped to $100/M
      expect(cappedOpenrouter).toBe(cappedPerToken);
    });

    it('should enforce MAX_PRICE_PER_MILLION constant', () => {
      // Verify the constant is set to $100
      expect(MAX_PRICE_PER_MILLION).toBe(100);
    });

    it('should cap prices at $100/M regardless of gateway', () => {
      // Per-token prices that would exceed $100/M when multiplied by 1M
      // $0.0002/token * 1M = $200/M, capped at $100
      expect(formatPricingForDisplay('0.0002', 'openrouter')).toBe('100.00');
      expect(formatPricingForDisplay('0.0002', 'groq')).toBe('100.00');
      expect(formatPricingForDisplay('0.0005', 'deepinfra')).toBe('100.00');
    });

    it('should never return a price higher than $100', () => {
      const testPrices = [
        { price: '0.001', gateway: 'openrouter' },   // $1000/M, capped
        { price: '0.001', gateway: 'groq' },          // $1000/M, capped
        { price: '0.001', gateway: 'deepinfra' },     // $1000/M, capped
        { price: '0.0005', gateway: 'onerouter' },    // $500/M, capped
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
      // Per-token values that result in valid per-million display
      expect(formatPricingForDisplay('0.00000015', 'openrouter')).toBe('0.15');
      expect(formatPricingForDisplay('0.00001', 'openrouter')).toBe('10.00');
      expect(formatPricingForDisplay('0.0001', 'openrouter')).toBe('100.00'); // Exactly $100

      expect(formatPricingForDisplay('0.00000005', 'groq')).toBe('0.05');
      expect(formatPricingForDisplay('0.00000035', 'deepinfra')).toBe('0.35');
    });
  });
});
