import { useEagerModelPreload } from '../useEagerModelPreload';

// Test the hook exports correctly
describe('useEagerModelPreload', () => {
  it('should be defined and exportable', () => {
    expect(useEagerModelPreload).toBeDefined();
    expect(typeof useEagerModelPreload).toBe('function');
  });

  describe('Function signature', () => {
    it('should be a valid React hook (starts with use)', () => {
      expect(useEagerModelPreload.name).toBe('useEagerModelPreload');
    });
  });
});

// Test the free model detection logic used in preloadModels
describe('useEagerModelPreload free model detection logic', () => {
  // Helper that mirrors the preloadModels logic - only OpenRouter :free models are free
  const isFreeModel = (model: { id?: string; is_free?: boolean; source_gateway?: string; source_gateways?: string[] }): boolean => {
    const sourceGateway = model.source_gateway || model.source_gateways?.[0] || '';
    return sourceGateway === 'openrouter' && model.id?.endsWith(':free') === true;
  };

  const getCategoryForModel = (model: { id?: string; is_free?: boolean; source_gateway?: string; source_gateways?: string[] }): string => {
    const sourceGateway = model.source_gateway || model.source_gateways?.[0] || '';
    const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free') === true;
    return sourceGateway === 'portkey' ? 'Portkey' : (isFree ? 'Free' : 'Paid');
  };

  describe('OpenRouter :free suffix detection', () => {
    it('should identify OpenRouter models with :free suffix as free', () => {
      const model = {
        id: 'google/gemini-2.0-flash-exp:free',
        source_gateway: 'openrouter'
      };

      expect(isFreeModel(model)).toBe(true);
      expect(getCategoryForModel(model)).toBe('Free');
    });

    it('should NOT identify models with is_free=true as free (only :free suffix matters)', () => {
      const model = {
        id: 'openrouter/some-model',
        is_free: true,
        source_gateway: 'openrouter'
      };

      // is_free field is ignored - only :free suffix matters
      expect(isFreeModel(model)).toBe(false);
      expect(getCategoryForModel(model)).toBe('Paid');
    });

    it('should identify OpenRouter models without :free suffix as not free', () => {
      const model = {
        id: 'openai/gpt-4o',
        source_gateway: 'openrouter'
      };

      expect(isFreeModel(model)).toBe(false);
      expect(getCategoryForModel(model)).toBe('Paid');
    });
  });

  describe('sourceGateway fallback logic', () => {
    it('should use source_gateway when available', () => {
      const model = {
        id: 'google/gemini:free',
        source_gateway: 'openrouter',
        source_gateways: ['groq']
      };

      expect(isFreeModel(model)).toBe(true);
    });

    it('should fall back to source_gateways[0] when source_gateway is not set', () => {
      const model = {
        id: 'google/gemini:free',
        source_gateways: ['openrouter']
      };

      expect(isFreeModel(model)).toBe(true);
    });

    it('should default to empty string when no gateway info is available', () => {
      const model = {
        id: 'some-model:free'
      };

      // Empty sourceGateway means not OpenRouter, so :free suffix doesn't apply
      expect(isFreeModel(model)).toBe(false);
      expect(getCategoryForModel(model)).toBe('Paid');
    });

    it('should not mark non-OpenRouter models as free even with :free suffix', () => {
      const model = {
        id: 'some-model:free',
        source_gateway: 'groq'
      };

      expect(isFreeModel(model)).toBe(false);
      expect(getCategoryForModel(model)).toBe('Paid');
    });
  });

  describe('model transformation to ModelOption format', () => {
    it('should correctly transform free OpenRouter model with :free suffix', () => {
      const apiModel = {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash (Free)',
        source_gateway: 'openrouter',
        provider_slug: 'google',
        architecture: { input_modalities: ['text', 'image'] }
      };

      const sourceGateway = apiModel.source_gateway || '';
      const isFree = sourceGateway === 'openrouter' && apiModel.id?.endsWith(':free');
      const category = sourceGateway === 'portkey' ? 'Portkey' : (isFree ? 'Free' : 'Paid');

      expect(category).toBe('Free');
    });

    it('should correctly transform paid OpenRouter model', () => {
      const apiModel = {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        source_gateway: 'openrouter',
        provider_slug: 'openai',
        architecture: { input_modalities: ['text'] }
      };

      const sourceGateway = apiModel.source_gateway || '';
      const isFree = sourceGateway === 'openrouter' && apiModel.id?.endsWith(':free');
      const category = sourceGateway === 'portkey' ? 'Portkey' : (isFree ? 'Free' : 'Paid');

      expect(category).toBe('Paid');
    });

    it('should correctly transform mixed batch of models (only :free suffix makes a model free)', () => {
      const apiModels = [
        {
          id: 'google/gemini-2.0-flash-exp:free',
          name: 'Gemini 2.0 Flash (Free)',
          source_gateway: 'openrouter'
        },
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          source_gateway: 'openrouter'
        },
        {
          id: 'groq/llama-3',
          name: 'Llama 3',
          source_gateway: 'groq'
        }
      ];

      const results = apiModels.map(model => {
        const sourceGateway = model.source_gateway || '';
        const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free');
        return sourceGateway === 'portkey' ? 'Portkey' : (isFree ? 'Free' : 'Paid');
      });

      expect(results).toEqual(['Free', 'Paid', 'Paid']);
    });
  });
});
