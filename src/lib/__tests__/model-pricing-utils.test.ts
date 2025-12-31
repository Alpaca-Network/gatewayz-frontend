import {
  getSourceGateway,
  isFreeModel,
  getModelPricingCategory,
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
});
