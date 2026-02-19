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
    it('should return true for known per-million gateways', () => {
      // Backend normalizes ALL gateway pricing to per-million in merged responses
      const perMillionGateways = [
        'onerouter', 'groq', 'deepinfra', 'featherless',
        'chutes', 'together', 'near', 'fireworks', 'cerebras', 'novita',
        'nebius', 'xai', 'google', 'google-vertex', 'helicone',
        'vercel-ai-gateway', 'alibaba', 'alibaba-cloud', 'clarifai',
        'simplismart', 'akash', 'cloudflare-workers-ai', 'alpaca-network',
        'alpaca', 'aimo', 'fal', 'canopywave', 'sybil', 'anannas',
        'morpheus', 'nosana',
        'openai', 'anthropic', 'openrouter', 'aihubmix', 'modelz',
        'huggingface', 'cohere', 'zai',
      ];

      perMillionGateways.forEach((gateway) => {
        expect(isPerMillionPricingGateway(gateway)).toBe(true);
      });
    });

    it('should return false for unknown gateways', () => {
      expect(isPerMillionPricingGateway('unknown-gateway')).toBe(false);
    });
  });

  describe('isPerBillionPricingGateway', () => {
    it('should return false for all known gateways', () => {
      const allGateways = [
        'openrouter', 'onerouter', 'groq', 'deepinfra',
        'openai', 'anthropic', 'huggingface',
      ];

      allGateways.forEach((gateway) => {
        expect(isPerBillionPricingGateway(gateway)).toBe(false);
      });
    });
  });

  describe('formatPricingForDisplay', () => {
    it('should display per-million pricing as-is for all gateways', () => {
      // Backend normalizes ALL pricing to per-million format
      // All gateways are treated as per-million

      // OpenRouter: 0.15 = $0.15/MTok
      expect(formatPricingForDisplay('0.15', 'openrouter')).toBe('0.15');
      expect(formatPricingForDisplay('0.60', 'openrouter')).toBe('0.60');

      // Groq: 0.05 = $0.05/MTok
      expect(formatPricingForDisplay('0.05', 'groq')).toBe('0.05');

      // DeepInfra: 0.35 = $0.35/MTok
      expect(formatPricingForDisplay('0.35', 'deepinfra')).toBe('0.35');

      // OneRouter: 0.15 = $0.15/MTok
      expect(formatPricingForDisplay('0.15', 'onerouter')).toBe('0.15');

      // Google Vertex: 0.075 = $0.075/MTok
      expect(formatPricingForDisplay('0.075', 'google-vertex')).toBe('0.07');

      // OpenAI: 2.50 = $2.50/MTok
      expect(formatPricingForDisplay('2.50', 'openai')).toBe('2.50');
      expect(formatPricingForDisplay('10.00', 'openai')).toBe('10.00');

      // Anthropic: 3.00 = $3.00/MTok
      expect(formatPricingForDisplay('3.00', 'anthropic')).toBe('3.00');
      expect(formatPricingForDisplay('15.00', 'anthropic')).toBe('15.00');
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
      expect(formatPricingForDisplay('0', 'groq')).toBe('0.00');
    });
  });

  describe('getNormalizedPerTokenPrice', () => {
    it('should convert per-million pricing to per-token for all gateways', () => {
      // All gateways return per-million from the backend

      // OpenRouter: 0.15 per-million → 0.15/1M = 1.5e-7 per-token
      expect(getNormalizedPerTokenPrice('0.15', 'openrouter')).toBeCloseTo(0.00000015, 12);

      // Groq: 0.05 per-million → 0.05/1M = 5e-8 per-token
      expect(getNormalizedPerTokenPrice('0.05', 'groq')).toBeCloseTo(0.00000005, 12);

      // DeepInfra: 0.35 per-million → 0.35/1M = 3.5e-7 per-token
      expect(getNormalizedPerTokenPrice('0.35', 'deepinfra')).toBeCloseTo(0.00000035, 12);

      // OneRouter: 1.00 per-million → 1.00/1M = 1e-6 per-token
      expect(getNormalizedPerTokenPrice('1.00', 'onerouter')).toBe(0.000001);

      // OpenAI: 2.50 per-million → 2.50/1M = 2.5e-6 per-token
      expect(getNormalizedPerTokenPrice('2.50', 'openai')).toBeCloseTo(0.0000025, 12);
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

      // Per-million: $200/M, capped at $100/M
      expect(getNormalizedPerTokenPrice('200', 'openrouter')).toBe(maxPerToken);
      expect(getNormalizedPerTokenPrice('200', 'groq')).toBe(maxPerToken);
    });

    it('should be consistent with formatPricingForDisplay', () => {
      const testCases = [
        { price: '0.15', gateway: 'openrouter' },
        { price: '0.15', gateway: 'onerouter' },
        { price: '0.05', gateway: 'groq' },
        { price: '200', gateway: 'openrouter' },          // exceeds cap
        { price: '200', gateway: 'groq' },                 // exceeds cap
      ];

      testCases.forEach(({ price, gateway }) => {
        const displayPrice = parseFloat(formatPricingForDisplay(price, gateway) || '0');
        const normalizedPrice = getNormalizedPerTokenPrice(price, gateway);

        // normalizedPrice * 1,000,000 should equal displayPrice
        expect(normalizedPrice! * 1000000).toBeCloseTo(displayPrice, 2);
      });
    });
  });

  describe('pricing normalization integration', () => {
    it('should display consistent pricing for same model from different gateways', () => {
      // GPT-4o-mini costs $0.15/MTok
      // All gateways return per-million: 0.15

      const openrouterPrice = formatPricingForDisplay('0.15', 'openrouter');
      const groqPrice = formatPricingForDisplay('0.15', 'groq');
      const deepinfraPrice = formatPricingForDisplay('0.15', 'deepinfra');
      const openaiPrice = formatPricingForDisplay('0.15', 'openai');

      // All should display as $0.15/M
      expect(openrouterPrice).toBe('0.15');
      expect(groqPrice).toBe('0.15');
      expect(deepinfraPrice).toBe('0.15');
      expect(openaiPrice).toBe('0.15');
    });

    it('should filter models consistently regardless of gateway', () => {
      // Filter range: models costing less than $1/M input
      const maxPerTokenPrice = 1 / 1000000; // $1/M = $0.000001/token

      // All gateways return per-million
      const cheapOpenRouter = getNormalizedPerTokenPrice('0.15', 'openrouter');
      expect(cheapOpenRouter).toBeLessThan(maxPerTokenPrice); // $0.15/M < $1/M

      const cheapGroq = getNormalizedPerTokenPrice('0.05', 'groq');
      expect(cheapGroq).toBeLessThan(maxPerTokenPrice); // $0.05/M < $1/M

      // Expensive models within the cap ($100)
      const expensiveModel = getNormalizedPerTokenPrice('15.00', 'openrouter');
      expect(expensiveModel).toBeGreaterThan(maxPerTokenPrice); // $15/M > $1/M

      // Verify that capped prices still filter correctly
      const cappedPerToken = MAX_PRICE_PER_MILLION / 1000000; // $100/M = $0.0001/token
      const cappedOpenrouter = getNormalizedPerTokenPrice('500', 'openrouter'); // $500/M, capped to $100/M
      expect(cappedOpenrouter).toBe(cappedPerToken);
    });

    it('should enforce MAX_PRICE_PER_MILLION constant', () => {
      // Verify the constant is set to $100
      expect(MAX_PRICE_PER_MILLION).toBe(100);
    });

    it('should cap prices at $100/M regardless of gateway', () => {
      // All per-million: $200/M, capped at $100
      expect(formatPricingForDisplay('200', 'openrouter')).toBe('100.00');
      expect(formatPricingForDisplay('200', 'groq')).toBe('100.00');
      expect(formatPricingForDisplay('200', 'deepinfra')).toBe('100.00');
    });

    it('should never return a price higher than $100', () => {
      const testPrices = [
        { price: '500', gateway: 'openrouter' },      // per-million: $500/M, capped
        { price: '500', gateway: 'groq' },             // per-million: $500/M, capped
        { price: '500', gateway: 'deepinfra' },        // per-million: $500/M, capped
        { price: '500', gateway: 'onerouter' },        // per-million: $500/M, capped
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
      // All gateways return per-million
      expect(formatPricingForDisplay('0.15', 'openrouter')).toBe('0.15');
      expect(formatPricingForDisplay('10.00', 'openrouter')).toBe('10.00');
      expect(formatPricingForDisplay('100.00', 'openrouter')).toBe('100.00'); // Exactly $100

      expect(formatPricingForDisplay('0.05', 'groq')).toBe('0.05');
      expect(formatPricingForDisplay('0.35', 'deepinfra')).toBe('0.35');
      expect(formatPricingForDisplay('15.00', 'fireworks')).toBe('15.00');
      expect(formatPricingForDisplay('3.00', 'anthropic')).toBe('3.00');
    });
  });
});
