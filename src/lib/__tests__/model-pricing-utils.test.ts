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
    it('should return true for gateways that report pricing per-million-tokens', () => {
      const perMillionGateways = [
        'onerouter', 'groq', 'deepinfra', 'featherless',
        'chutes', 'together', 'near', 'fireworks', 'cerebras', 'novita',
        'nebius', 'xai', 'google', 'google-vertex', 'helicone',
        'vercel-ai-gateway', 'alibaba', 'alibaba-cloud', 'clarifai',
        'simplismart', 'akash', 'cloudflare-workers-ai', 'alpaca-network',
        'alpaca', 'aimo', 'fal', 'canopywave', 'sybil', 'anannas',
        'morpheus', 'nosana',
      ];

      perMillionGateways.forEach((gateway) => {
        expect(isPerMillionPricingGateway(gateway)).toBe(true);
      });
    });

    it('should return false for gateways that report pricing per-token (default path)', () => {
      // openrouter, openai, anthropic, and similar gateways return per-token
      // pricing and are deliberately NOT in PER_MILLION_PRICING_GATEWAYS — the
      // default per-token path (x 1,000,000) handles them.
      const perTokenGateways = [
        'openai', 'anthropic', 'openrouter', 'aihubmix', 'modelz',
        'huggingface', 'cohere', 'zai',
      ];

      perTokenGateways.forEach((gateway) => {
        expect(isPerMillionPricingGateway(gateway)).toBe(false);
      });
    });

    it('should return false for unknown gateways', () => {
      expect(isPerMillionPricingGateway('unknown-gateway')).toBe(false);
    });
  });

  describe('isPerBillionPricingGateway', () => {
    it('should return false for all known gateways', () => {
      // Backend normalizes ALL gateway pricing to per-token or per-million
      // before returning to the frontend — no gateway needs per-billion handling.
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
    it('should normalize per-token gateway pricing to per-million and apply the platform markup', () => {
      // openrouter/openai/anthropic report pricing per-token (e.g. 0.00000015
      // for $0.15/MTok). formatPricingForDisplay multiplies by 1,000,000 to get
      // per-million, then applies PRICING_MARKUP (1.25x default) so the
      // displayed price matches what the backend actually charges.

      // OpenRouter: $0.15/MTok raw -> $0.1875/MTok after 1.25x markup
      expect(formatPricingForDisplay('0.00000015', 'openrouter')).toBe('0.19');
      // OpenRouter: $0.60/MTok raw -> $0.75/MTok after markup
      expect(formatPricingForDisplay('0.0000006', 'openrouter')).toBe('0.75');

      // OpenAI: $2.50/MTok raw -> $3.13/MTok after markup
      expect(formatPricingForDisplay('0.0000025', 'openai')).toBe('3.13');
      // OpenAI: $10.00/MTok raw -> $12.50/MTok after markup
      expect(formatPricingForDisplay('0.00001', 'openai')).toBe('12.50');

      // Anthropic: $3.00/MTok raw -> $3.75/MTok after markup
      expect(formatPricingForDisplay('0.000003', 'anthropic')).toBe('3.75');
      // Anthropic: $15.00/MTok raw -> $18.75/MTok after markup
      expect(formatPricingForDisplay('0.000015', 'anthropic')).toBe('18.75');
    });

    it('should display per-million gateway pricing as-is, still with markup applied', () => {
      // Groq: $0.05/MTok raw -> $0.0625/MTok after markup (displays as 0.06)
      expect(formatPricingForDisplay('0.05', 'groq')).toBe('0.06');

      // DeepInfra: $0.35/MTok raw -> $0.4375/MTok after markup
      expect(formatPricingForDisplay('0.35', 'deepinfra')).toBe('0.44');

      // OneRouter: $0.15/MTok raw -> $0.1875/MTok after markup
      expect(formatPricingForDisplay('0.15', 'onerouter')).toBe('0.19');

      // Google Vertex: $0.075/MTok raw -> $0.09375/MTok after markup
      expect(formatPricingForDisplay('0.075', 'google-vertex')).toBe('0.09');

      // Fireworks: $15.00/MTok raw -> $18.75/MTok after markup
      expect(formatPricingForDisplay('15.00', 'fireworks')).toBe('18.75');
    });

    it('should return null for undefined or empty price', () => {
      expect(formatPricingForDisplay(undefined, 'openrouter')).toBeNull();
      expect(formatPricingForDisplay('', 'openrouter')).toBeNull();
    });

    it('should return null for non-numeric price', () => {
      expect(formatPricingForDisplay('N/A', 'openrouter')).toBeNull();
      expect(formatPricingForDisplay('free', 'openrouter')).toBeNull();
    });

    it('should handle zero pricing (markup is skipped for free models)', () => {
      expect(formatPricingForDisplay('0', 'openrouter')).toBe('0.00');
      expect(formatPricingForDisplay('0', 'onerouter')).toBe('0.00');
      expect(formatPricingForDisplay('0', 'groq')).toBe('0.00');
    });
  });

  describe('getNormalizedPerTokenPrice', () => {
    it('should convert to a per-token price (post-markup) regardless of gateway pricing convention', () => {
      // OpenRouter: 0.00000015 (=$0.15/M raw) -> $0.1875/M post-markup -> 1.875e-7 per-token
      expect(getNormalizedPerTokenPrice('0.00000015', 'openrouter')).toBeCloseTo(1.875e-7, 12);

      // Groq: 0.05 (=$0.05/M raw) -> $0.0625/M post-markup -> 6.25e-8 per-token
      expect(getNormalizedPerTokenPrice('0.05', 'groq')).toBeCloseTo(6.25e-8, 12);

      // DeepInfra: 0.35 -> $0.4375/M post-markup -> 4.375e-7 per-token
      expect(getNormalizedPerTokenPrice('0.35', 'deepinfra')).toBeCloseTo(4.375e-7, 12);

      // OneRouter: 1.00 -> $1.25/M post-markup -> 1.25e-6 per-token
      expect(getNormalizedPerTokenPrice('1.00', 'onerouter')).toBe(0.00000125);

      // OpenAI: 0.0000025 (=$2.50/M raw) -> $3.125/M post-markup -> 3.125e-6 per-token
      expect(getNormalizedPerTokenPrice('0.0000025', 'openai')).toBeCloseTo(0.000003125, 12);
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

      // OpenRouter per-token input equivalent to $200/M raw, capped at $100/M
      expect(getNormalizedPerTokenPrice('0.0002', 'openrouter')).toBe(maxPerToken);
      // Groq per-million input of $200/M raw, capped at $100/M
      expect(getNormalizedPerTokenPrice('200', 'groq')).toBe(maxPerToken);
    });

    it('should be consistent with formatPricingForDisplay', () => {
      const testCases = [
        { price: '0.00000015', gateway: 'openrouter' },
        { price: '0.15', gateway: 'onerouter' },
        { price: '0.05', gateway: 'groq' },
        { price: '0.0002', gateway: 'openrouter' },  // exceeds cap
        { price: '200', gateway: 'groq' },             // exceeds cap
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
    it('should display the same $/M price for equivalent per-token and per-million inputs', () => {
      // GPT-4o-mini costs $0.15/MTok. openrouter reports it as a per-token
      // price (0.00000015); groq/deepinfra report the equivalent per-million
      // price (0.15) directly. Both normalize to the same displayed price
      // once markup is applied.
      const openrouterPrice = formatPricingForDisplay('0.00000015', 'openrouter');
      const groqPrice = formatPricingForDisplay('0.15', 'groq');
      const deepinfraPrice = formatPricingForDisplay('0.15', 'deepinfra');

      expect(openrouterPrice).toBe('0.19');
      expect(groqPrice).toBe('0.19');
      expect(deepinfraPrice).toBe('0.19');
    });

    it('should filter models consistently regardless of gateway pricing convention', () => {
      // Filter range: models costing less than $1/M input
      const maxPerTokenPrice = 1 / 1000000; // $1/M = $0.000001/token

      const cheapOpenRouter = getNormalizedPerTokenPrice('0.00000015', 'openrouter'); // $0.15/M raw
      expect(cheapOpenRouter).toBeLessThan(maxPerTokenPrice);

      const cheapGroq = getNormalizedPerTokenPrice('0.05', 'groq'); // $0.05/M raw
      expect(cheapGroq).toBeLessThan(maxPerTokenPrice);

      // Expensive models within the cap ($100)
      const expensiveModel = getNormalizedPerTokenPrice('0.000015', 'openrouter'); // $15/M raw
      expect(expensiveModel).toBeGreaterThan(maxPerTokenPrice);

      // Verify that capped prices still filter correctly
      const cappedPerToken = MAX_PRICE_PER_MILLION / 1000000; // $100/M = $0.0001/token
      const cappedOpenrouter = getNormalizedPerTokenPrice('0.0005', 'openrouter'); // $500/M raw, capped to $100/M
      expect(cappedOpenrouter).toBe(cappedPerToken);
    });

    it('should enforce MAX_PRICE_PER_MILLION constant', () => {
      // Verify the constant is set to $100
      expect(MAX_PRICE_PER_MILLION).toBe(100);
    });

    it('should cap prices at $100/M regardless of gateway', () => {
      expect(formatPricingForDisplay('0.0002', 'openrouter')).toBe('100.00'); // per-token $200/M raw
      expect(formatPricingForDisplay('200', 'groq')).toBe('100.00');           // per-million $200/M raw
      expect(formatPricingForDisplay('200', 'deepinfra')).toBe('100.00');      // per-million $200/M raw
    });

    it('should never return a price higher than $100', () => {
      const testPrices = [
        { price: '0.0005', gateway: 'openrouter' },   // per-token: $500/M raw, capped
        { price: '500', gateway: 'groq' },              // per-million: $500/M raw, capped
        { price: '500', gateway: 'deepinfra' },         // per-million: $500/M raw, capped
        { price: '500', gateway: 'onerouter' },         // per-million: $500/M raw, capped
      ];

      testPrices.forEach(({ price, gateway }) => {
        const result = formatPricingForDisplay(price, gateway);
        if (result !== null) {
          const numericResult = parseFloat(result);
          expect(numericResult).toBeLessThanOrEqual(MAX_PRICE_PER_MILLION);
        }
      });
    });

    it('should allow prices comfortably under the $100/M cap', () => {
      expect(formatPricingForDisplay('0.00001', 'openrouter')).toBe('12.50');  // per-token $10/M raw
      expect(formatPricingForDisplay('0.05', 'groq')).toBe('0.06');
      expect(formatPricingForDisplay('0.35', 'deepinfra')).toBe('0.44');
      expect(formatPricingForDisplay('15.00', 'fireworks')).toBe('18.75');
      expect(formatPricingForDisplay('0.000003', 'anthropic')).toBe('3.75');
    });
  });
});
