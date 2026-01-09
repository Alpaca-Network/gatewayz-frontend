import {
  getSourceGateway,
  isFreeModel,
  getModelPricingCategory,
  isPerMillionPricingGateway,
  formatPricingForDisplay,
  getNormalizedPerTokenPrice,
  ModelPricingInfo,
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
    it('should return price as-is for standard per-token gateways', () => {
      expect(getNormalizedPerTokenPrice('0.00000015', 'openrouter')).toBe(0.00000015);
      expect(getNormalizedPerTokenPrice('0.000001', 'groq')).toBe(0.000001);
    });

    it('should divide by 1,000,000 for onerouter gateway', () => {
      // OneRouter $1.00/M = $0.000001/token
      expect(getNormalizedPerTokenPrice('1.00', 'onerouter')).toBe(0.000001);
      // OneRouter $15.00/M = $0.000015/token
      expect(getNormalizedPerTokenPrice('15.00', 'onerouter')).toBe(0.000015);
    });

    it('should return 0 for undefined or empty price', () => {
      expect(getNormalizedPerTokenPrice(undefined, 'openrouter')).toBe(0);
      expect(getNormalizedPerTokenPrice('', 'openrouter')).toBe(0);
    });

    it('should return 0 for non-numeric price', () => {
      expect(getNormalizedPerTokenPrice('N/A', 'openrouter')).toBe(0);
    });
  });

  describe('pricing normalization integration', () => {
    it('should display consistent pricing for same model from different gateways', () => {
      // GPT-4o-mini from OpenRouter (per-token: 0.00000015)
      const openrouterPrice = formatPricingForDisplay('0.00000015', 'openrouter');

      // Same model from OneRouter (per-million: 0.15)
      const onerouterPrice = formatPricingForDisplay('0.15', 'onerouter');

      // Both should display as $0.15/M
      expect(openrouterPrice).toBe('0.15');
      expect(onerouterPrice).toBe('0.15');
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

      // Expensive model should be filtered out
      const expensiveOpenrouter = getNormalizedPerTokenPrice('0.000015', 'openrouter');
      expect(expensiveOpenrouter).toBeGreaterThan(maxPerTokenPrice); // $15/M > $1/M

      const expensiveOnerouter = getNormalizedPerTokenPrice('15', 'onerouter');
      expect(expensiveOnerouter).toBeGreaterThan(maxPerTokenPrice); // $15/M > $1/M
    });
  });
});
