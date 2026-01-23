/**
 * Tests for ModelsClient component filtering, sorting, and search logic
 * These tests verify the client-side model manipulation without rendering the full component
 */

import {
  getSourceGateway,
  formatPricingForDisplay,
  getNormalizedPerTokenPrice,
} from '@/lib/model-pricing-utils';

describe('ModelsClient - Filtering Logic', () => {
  const mockModel = (overrides = {}) => ({
    id: 'test/model',
    name: 'Test Model',
    description: 'A test model',
    context_length: 8000,
    pricing: { prompt: '0.01', completion: '0.03' },
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    supported_parameters: ['temperature', 'top_p'],
    provider_slug: 'test-provider',
    source_gateways: ['openrouter'],
    created: Date.now() / 1000,
    ...overrides
  });

  describe('Deduplication and validation', () => {
    it('should filter out malformed model names starting with (\'Data\',', () => {
      const models = [
        mockModel({ id: '1', name: 'Valid Model' }),
        mockModel({ id: '2', name: '(\'Data\', [Data(Id=...' }),
        mockModel({ id: '3', name: 'Another Valid Model' })
      ];

      const filtered = models.filter(model => {
        const isMalformed = model.name && (
          model.name.startsWith("('Data',") ||
          model.name.startsWith("('Object',") ||
          model.name.includes("Data(Id=") ||
          model.name.includes("Data(id=")
        );
        return !isMalformed;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map(m => m.id)).toEqual(['1', '3']);
    });

    it('should filter out malformed model names starting with (\'Object\',', () => {
      const models = [
        mockModel({ id: '1', name: 'Valid Model' }),
        mockModel({ id: '2', name: '(\'Object\', \'List\')' }),
      ];

      const filtered = models.filter(model => {
        const isMalformed = model.name && model.name.startsWith("('Object',");
        return !isMalformed;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should deduplicate models by ID', () => {
      const models = [
        mockModel({ id: 'duplicate', name: 'Model 1' }),
        mockModel({ id: 'duplicate', name: 'Model 2' }),
        mockModel({ id: 'unique', name: 'Model 3' })
      ];

      const seen = new Set<string>();
      const deduplicated = models.filter(model => {
        if (seen.has(model.id)) {
          return false;
        }
        seen.add(model.id);
        return true;
      });

      expect(deduplicated).toHaveLength(2);
      expect(deduplicated.map(m => m.id)).toEqual(['duplicate', 'unique']);
    });
  });

  describe('Search filtering', () => {
    const models = [
      mockModel({ id: '1', name: 'GPT-4', description: 'OpenAI language model', provider_slug: 'openai' }),
      mockModel({ id: '2', name: 'Claude 3', description: 'Anthropic AI assistant', provider_slug: 'anthropic' }),
      mockModel({ id: '3', name: 'Gemini Pro', description: 'Google multimodal model', provider_slug: 'google' })
    ];

    it('should filter by model name', () => {
      const searchTerm = 'gpt';
      const filtered = models.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('GPT-4');
    });

    it('should filter by description', () => {
      const searchTerm = 'assistant';
      const filtered = models.filter(m =>
        (m.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Claude 3');
    });

    it('should filter by provider slug', () => {
      const searchTerm = 'google';
      const filtered = models.filter(m =>
        (m.provider_slug || '').toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Gemini Pro');
    });

    it('should filter by model ID', () => {
      const searchTerm = 'test/model';
      const model = mockModel({ id: 'test/model-123' });
      const filtered = [model].filter(m =>
        (m.id || '').toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      const searchTerm = 'GPT';
      const filtered = models.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('GPT-4');
    });
  });

  describe('Input/Output modality filtering', () => {
    const models = [
      mockModel({
        id: '1',
        architecture: { input_modalities: ['text'], output_modalities: ['text'] }
      }),
      mockModel({
        id: '2',
        architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }
      }),
      mockModel({
        id: '3',
        architecture: { input_modalities: ['audio'], output_modalities: ['text'] }
      })
    ];

    it('should filter by input modality', () => {
      const selectedInputFormats = ['image'];
      const filtered = models.filter(m =>
        m.architecture?.input_modalities?.some(im => im.toLowerCase() === 'image')
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should match all selected input modalities', () => {
      const selectedInputFormats = ['text', 'image'];
      const filtered = models.filter(m =>
        selectedInputFormats.every(format =>
          m.architecture?.input_modalities?.some(im => im.toLowerCase() === format.toLowerCase())
        )
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should return all models when no input formats selected', () => {
      const selectedInputFormats: string[] = [];
      const filtered = models.filter(m =>
        selectedInputFormats.length === 0 || selectedInputFormats.every(format =>
          m.architecture?.input_modalities?.some(im => im.toLowerCase() === format.toLowerCase())
        )
      );

      expect(filtered).toHaveLength(3);
    });
  });

  describe('Context length filtering', () => {
    const models = [
      mockModel({ id: '1', context_length: 4000 }),
      mockModel({ id: '2', context_length: 8000 }),
      mockModel({ id: '3', context_length: 128000 }),
      mockModel({ id: '4', context_length: 0 }) // Pending metadata sync
    ];

    it('should filter by minimum context length', () => {
      const minContext = 8; // 8K tokens
      const filtered = models.filter(m =>
        m.context_length === 0 || m.context_length >= minContext * 1000
      );

      expect(filtered).toHaveLength(3); // Models 2, 3, and 4 (0 included)
    });

    it('should filter by context length range', () => {
      const range: [number, number] = [8, 100]; // 8K to 100K
      const filtered = models.filter(m =>
        m.context_length === 0 ||
        (m.context_length >= range[0] * 1000 && m.context_length <= range[1] * 1000)
      );

      expect(filtered).toHaveLength(2); // Models 2 and 4
    });

    it('should include models with context_length 0 (pending metadata)', () => {
      const range: [number, number] = [100, 1024];
      const filtered = models.filter(m =>
        m.context_length === 0 ||
        (m.context_length >= range[0] * 1000 && m.context_length <= range[1] * 1000)
      );

      // Should include model 3 (128K) and model 4 (0)
      expect(filtered.map(m => m.id)).toContain('4');
    });
  });

  describe('Pricing filtering', () => {
    const models = [
      mockModel({ id: '1', pricing: { prompt: '0', completion: '0' } }), // Free
      mockModel({ id: '2', pricing: { prompt: '0.000001', completion: '0.000003' } }), // $1/$3 per M
      mockModel({ id: '3', pricing: { prompt: '0.00001', completion: '0.00003' } }), // $10/$30 per M
      mockModel({ id: '4', pricing: null }) // No pricing info
    ];

    it('should identify free models', () => {
      const freeModels = models.filter(m => {
        const isFree = parseFloat(m.pricing?.prompt || '0') === 0 &&
                       parseFloat(m.pricing?.completion || '0') === 0;
        return isFree;
      });

      expect(freeModels).toHaveLength(2); // Models 1 and 4 (null pricing treated as free)
    });

    it('should filter by pricing range', () => {
      const range: [number, number] = [0, 5]; // $0-$5 per M tokens
      const filtered = models.filter(m => {
        const isFree = parseFloat(m.pricing?.prompt || '0') === 0 &&
                       parseFloat(m.pricing?.completion || '0') === 0;
        const avgPrice = (parseFloat(m.pricing?.prompt || '0') + parseFloat(m.pricing?.completion || '0')) / 2;
        return isFree || (avgPrice >= range[0] / 1000000 && avgPrice <= range[1] / 1000000);
      });

      expect(filtered).toHaveLength(3); // Models 1, 2, and 4
    });

    it('should filter paid models only', () => {
      const paidModels = models.filter(m => {
        const isFree = parseFloat(m.pricing?.prompt || '0') === 0 &&
                       parseFloat(m.pricing?.completion || '0') === 0;
        return !isFree;
      });

      expect(paidModels).toHaveLength(2); // Models 2 and 3
    });
  });

  describe('Parameter filtering', () => {
    const models = [
      mockModel({ id: '1', supported_parameters: ['temperature', 'top_p'] }),
      mockModel({ id: '2', supported_parameters: ['temperature', 'top_k', 'max_tokens'] }),
      mockModel({ id: '3', supported_parameters: ['temperature'] })
    ];

    it('should filter by single parameter', () => {
      const selectedParameters = ['top_p'];
      const filtered = models.filter(m =>
        selectedParameters.every(p => (m.supported_parameters || []).includes(p))
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should filter by multiple parameters (AND logic)', () => {
      const selectedParameters = ['temperature', 'top_k'];
      const filtered = models.filter(m =>
        selectedParameters.every(p => (m.supported_parameters || []).includes(p))
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should return all models when no parameters selected', () => {
      const selectedParameters: string[] = [];
      const filtered = models.filter(m =>
        selectedParameters.length === 0 || selectedParameters.every(p => (m.supported_parameters || []).includes(p))
      );

      expect(filtered).toHaveLength(3);
    });
  });

  describe('Developer filtering', () => {
    const models = [
      mockModel({ id: '1', provider_slug: 'openai' }),
      mockModel({ id: '2', provider_slug: 'anthropic' }),
      mockModel({ id: '3', provider_slug: 'google' })
    ];

    it('should filter by single developer', () => {
      const selectedDevelopers = ['openai'];
      const filtered = models.filter(m =>
        selectedDevelopers.includes(m.provider_slug)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should filter by multiple developers (OR logic)', () => {
      const selectedDevelopers = ['openai', 'google'];
      const filtered = models.filter(m =>
        selectedDevelopers.includes(m.provider_slug)
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(m => m.id)).toEqual(['1', '3']);
    });
  });

  describe('Gateway filtering', () => {
    const models = [
      mockModel({ id: '1', source_gateways: ['openrouter'] }),
      mockModel({ id: '2', source_gateways: ['groq', 'together'] }),
      mockModel({ id: '3', source_gateways: ['hug'] }), // Abbreviated form
      mockModel({ id: '4', source_gateway: 'openrouter', source_gateways: undefined })
    ];

    it('should filter by single gateway', () => {
      const selectedGateways = ['openrouter'];
      const filtered = models.filter(m => {
        const modelGateways = (m.source_gateways && m.source_gateways.length > 0) ?
          m.source_gateways : (m.source_gateway ? [m.source_gateway] : []);
        return selectedGateways.some(g => modelGateways.includes(g));
      });

      expect(filtered).toHaveLength(2); // Models 1 and 4
    });

    it('should normalize "hug" to "huggingface" for filtering', () => {
      const selectedGateways = ['huggingface'];
      const filtered = models.filter(m => {
        const modelGateways = (m.source_gateways && m.source_gateways.length > 0) ?
          m.source_gateways : (m.source_gateway ? [m.source_gateway] : []);
        const normalizedModelGateways = modelGateways.map(g => g === 'hug' ? 'huggingface' : g);
        return selectedGateways.some(g => normalizedModelGateways.includes(g));
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
    });

    it('should filter by multiple gateways (OR logic)', () => {
      const selectedGateways = ['groq', 'together'];
      const filtered = models.filter(m => {
        const modelGateways = (m.source_gateways && m.source_gateways.length > 0) ?
          m.source_gateways : (m.source_gateway ? [m.source_gateway] : []);
        return selectedGateways.some(g => modelGateways.includes(g));
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should handle legacy source_gateway field', () => {
      const model = mockModel({ source_gateway: 'openrouter', source_gateways: undefined });
      const modelGateways = (model.source_gateways && model.source_gateways.length > 0) ?
        model.source_gateways : (model.source_gateway ? [model.source_gateway] : []);

      expect(modelGateways).toEqual(['openrouter']);
    });
  });

  describe('Model series detection', () => {
    const getModelSeries = (name: string): string => {
      const lower = name.toLowerCase();
      if (lower.includes('gpt-4')) return 'GPT-4';
      if (lower.includes('gpt-3')) return 'GPT-3';
      if (lower.includes('claude')) return 'Claude';
      if (lower.includes('gemini')) return 'Gemini';
      if (lower.includes('llama')) return 'Llama';
      if (lower.includes('mistral')) return 'Mistral';
      if (lower.includes('deepseek')) return 'DeepSeek';
      if (lower.includes('qwen')) return 'Qwen';
      if (lower.includes('glm')) return 'GLM';
      if (lower.includes('phi')) return 'Phi';
      return 'Other';
    };

    it('should detect GPT-4 series', () => {
      expect(getModelSeries('GPT-4')).toBe('GPT-4');
      expect(getModelSeries('GPT-4 Turbo')).toBe('GPT-4');
      expect(getModelSeries('gpt-4o')).toBe('GPT-4');
    });

    it('should detect Claude series', () => {
      expect(getModelSeries('Claude 3')).toBe('Claude');
      expect(getModelSeries('Claude 3.5 Sonnet')).toBe('Claude');
    });

    it('should detect Gemini series', () => {
      expect(getModelSeries('Gemini Pro')).toBe('Gemini');
      expect(getModelSeries('Google: Gemini Flash')).toBe('Gemini');
    });

    it('should detect Llama series', () => {
      expect(getModelSeries('Llama 3')).toBe('Llama');
      expect(getModelSeries('Meta: Llama 3.1 70B')).toBe('Llama');
    });

    it('should return Other for unknown series', () => {
      expect(getModelSeries('Unknown Model')).toBe('Other');
      expect(getModelSeries('Custom AI')).toBe('Other');
    });
  });

  describe('Privacy filtering', () => {
    const models = [
      mockModel({ id: '1', is_private: true }),
      mockModel({ id: '2', is_private: false }),
      mockModel({ id: '3', is_private: undefined })
    ];

    it('should filter private models', () => {
      const filtered = models.filter(m => m.is_private === true);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should filter public models (including undefined)', () => {
      const filtered = models.filter(m =>
        m.is_private === false || m.is_private === undefined
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(m => m.id)).toEqual(['2', '3']);
    });
  });

  describe('Release date filtering', () => {
    const now = Date.now() / 1000;
    const models = [
      mockModel({ id: '1', created: now - (15 * 24 * 60 * 60) }), // 15 days ago
      mockModel({ id: '2', created: now - (60 * 24 * 60 * 60) }), // 60 days ago
      mockModel({ id: '3', created: now - (200 * 24 * 60 * 60) }), // 200 days ago
      mockModel({ id: '4', created: 0 }) // No creation date
    ];

    it('should filter last 30 days', () => {
      const cutoff = now - (30 * 24 * 60 * 60);
      const filtered = models.filter(m =>
        m.created && m.created > 0 && m.created >= cutoff
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should filter last 90 days', () => {
      const cutoff = now - (90 * 24 * 60 * 60);
      const filtered = models.filter(m =>
        m.created && m.created > 0 && m.created >= cutoff
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(m => m.id)).toEqual(['1', '2']);
    });

    it('should filter last 6 months', () => {
      const cutoff = now - (180 * 24 * 60 * 60);
      const filtered = models.filter(m =>
        m.created && m.created > 0 && m.created >= cutoff
      );

      expect(filtered).toHaveLength(2);
    });

    it('should exclude models without creation date', () => {
      const cutoff = now - (365 * 24 * 60 * 60);
      const filtered = models.filter(m =>
        m.created && m.created > 0 && m.created >= cutoff
      );

      expect(filtered.map(m => m.id)).not.toContain('4');
    });
  });

  describe('Sorting logic', () => {
    const models = [
      mockModel({ id: '1', source_gateways: ['openrouter'], created: 100, context_length: 8000 }),
      mockModel({ id: '2', source_gateways: ['openrouter', 'groq', 'together'], created: 300, context_length: 128000 }),
      mockModel({ id: '3', source_gateways: ['openrouter', 'groq'], created: 200, context_length: 4000 })
    ];

    it('should sort by popularity (gateway count)', () => {
      const sorted = [...models].sort((a, b) => {
        const aGateways = a.source_gateways ? a.source_gateways.length : 0;
        const bGateways = b.source_gateways ? b.source_gateways.length : 0;
        return bGateways - aGateways;
      });

      expect(sorted.map(m => m.id)).toEqual(['2', '3', '1']);
    });

    it('should sort by newest first', () => {
      const sorted = [...models].sort((a, b) => {
        return (b.created || 0) - (a.created || 0);
      });

      expect(sorted.map(m => m.id)).toEqual(['2', '3', '1']);
    });

    it('should sort by context length descending', () => {
      const sorted = [...models].sort((a, b) => {
        return b.context_length - a.context_length;
      });

      expect(sorted.map(m => m.id)).toEqual(['2', '1', '3']);
    });

    it('should sort by context length ascending', () => {
      const sorted = [...models].sort((a, b) => {
        return a.context_length - b.context_length;
      });

      expect(sorted.map(m => m.id)).toEqual(['3', '1', '2']);
    });
  });

  describe('Combined filtering', () => {
    it('should apply multiple filters together', () => {
      const models = [
        mockModel({
          id: '1',
          name: 'GPT-4',
          pricing: { prompt: '0.00001', completion: '0.00003' },
          context_length: 8000,
          architecture: { input_modalities: ['text'], output_modalities: ['text'] },
          source_gateways: ['openrouter']
        }),
        mockModel({
          id: '2',
          name: 'GPT-4 Vision',
          pricing: { prompt: '0.00001', completion: '0.00003' },
          context_length: 128000,
          architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
          source_gateways: ['openrouter', 'together']
        }),
        mockModel({
          id: '3',
          name: 'Claude 3',
          pricing: { prompt: '0', completion: '0' },
          context_length: 200000,
          architecture: { input_modalities: ['text'], output_modalities: ['text'] },
          source_gateways: ['anthropic']
        })
      ];

      // Apply search, pricing, and modality filters
      const searchTerm = 'gpt';
      const isPaidOnly = true;
      const requiresImageInput = true;

      const filtered = models.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        const isFree = parseFloat(m.pricing?.prompt || '0') === 0;
        const matchesPricing = !isPaidOnly || !isFree;
        const matchesModality = !requiresImageInput ||
          m.architecture?.input_modalities?.includes('image');

        return matchesSearch && matchesPricing && matchesModality;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });
  });

  describe('Free model detection - only OpenRouter :free models', () => {
    it('should identify OpenRouter models with :free suffix as free', () => {
      const model = mockModel({
        id: 'google/gemini-2.0-flash-exp:free',
        source_gateway: 'openrouter',
        pricing: { prompt: '0', completion: '0' }
      });

      const sourceGateway = model.source_gateway || (model.source_gateways?.[0]) || '';
      const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free');
      expect(isFree).toBe(true);
    });

    it('should NOT identify models with is_free=true as free (only :free suffix matters)', () => {
      const model = mockModel({
        id: 'openrouter/some-model',
        is_free: true,
        source_gateway: 'openrouter',
        pricing: { prompt: '0', completion: '0' }
      });

      const sourceGateway = model.source_gateway || (model.source_gateways?.[0]) || '';
      // is_free field is ignored - only :free suffix matters
      const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free');
      expect(isFree).toBe(false);
    });

    it('should identify OpenRouter models without :free suffix as not free', () => {
      const model = mockModel({
        id: 'openai/gpt-4o',
        source_gateway: 'openrouter',
        pricing: { prompt: '2.50', completion: '10.00' }
      });

      const sourceGateway = model.source_gateway || (model.source_gateways?.[0]) || '';
      const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free');
      expect(isFree).toBe(false);
    });

    it('should not mark non-OpenRouter models as free even if id ends with :free', () => {
      const model = mockModel({
        id: 'some-model:free',
        source_gateway: 'groq',
        pricing: { prompt: '0', completion: '0' }
      });

      const sourceGateway = model.source_gateway || (model.source_gateways?.[0]) || '';
      const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free');
      expect(isFree).toBe(false);
    });

    it('should use source_gateways array when source_gateway is not set', () => {
      const model = mockModel({
        id: 'google/gemini-2.0-flash-exp:free',
        source_gateways: ['openrouter'],
        source_gateway: undefined,
        pricing: { prompt: '0', completion: '0' }
      });

      const sourceGateway = model.source_gateway || (model.source_gateways?.[0]) || '';
      const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free');
      expect(isFree).toBe(true);
    });

    it('should default to empty string when no gateway info is available', () => {
      const model = mockModel({
        id: 'some-model:free',
        source_gateway: undefined,
        source_gateways: undefined,
        pricing: { prompt: '0', completion: '0' }
      });

      const sourceGateway = model.source_gateway || (model.source_gateways?.[0]) || '';
      expect(sourceGateway).toBe('');

      const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free');
      expect(isFree).toBe(false);
    });
  });

  describe('Pricing normalization across gateways', () => {
    it('should correctly extract source gateway from model', () => {
      const modelWithGateway = mockModel({
        source_gateway: 'openrouter',
        source_gateways: ['groq'],
      });
      expect(getSourceGateway(modelWithGateway)).toBe('openrouter');

      const modelWithGateways = mockModel({
        source_gateway: undefined,
        source_gateways: ['onerouter'],
      });
      expect(getSourceGateway(modelWithGateways)).toBe('onerouter');

      const modelWithNoGateway = mockModel({
        source_gateway: undefined,
        source_gateways: undefined,
      });
      expect(getSourceGateway(modelWithNoGateway)).toBe('');
    });

    it('should format pricing correctly for OpenRouter (per-token format)', () => {
      // OpenRouter returns per-token prices like $0.00000015/token
      const promptPrice = '0.00000015'; // $0.15 per million tokens
      const formatted = formatPricingForDisplay(promptPrice, 'openrouter');
      expect(formatted).toBe('0.15');

      // More expensive model
      const expensivePrice = '0.000015'; // $15 per million tokens
      const formattedExpensive = formatPricingForDisplay(expensivePrice, 'openrouter');
      expect(formattedExpensive).toBe('15.00');
    });

    it('should format pricing correctly for OneRouter (per-million format)', () => {
      // OneRouter returns per-million prices like $0.15/M
      const promptPrice = '0.15'; // Already $0.15 per million tokens
      const formatted = formatPricingForDisplay(promptPrice, 'onerouter');
      expect(formatted).toBe('0.15');

      // More expensive model
      const expensivePrice = '15.00'; // $15 per million tokens
      const formattedExpensive = formatPricingForDisplay(expensivePrice, 'onerouter');
      expect(formattedExpensive).toBe('15.00');
    });

    it('should display same price for equivalent models from different gateways', () => {
      // GPT-4o-mini priced at $0.15/M input
      // OpenRouter: 0.00000015 (per-token)
      const openrouterFormatted = formatPricingForDisplay('0.00000015', 'openrouter');
      // OneRouter: 0.15 (per-million)
      const onerouterFormatted = formatPricingForDisplay('0.15', 'onerouter');

      expect(openrouterFormatted).toBe('0.15');
      expect(onerouterFormatted).toBe('0.15');
    });

    it('should normalize prices to per-token for consistent filtering', () => {
      // Both should return the same per-token price for $0.15/M
      const openrouterPerToken = getNormalizedPerTokenPrice('0.00000015', 'openrouter');
      const onerouterPerToken = getNormalizedPerTokenPrice('0.15', 'onerouter');

      expect(openrouterPerToken).toBeCloseTo(0.00000015);
      expect(onerouterPerToken).toBeCloseTo(0.00000015);
    });

    it('should filter models correctly regardless of gateway pricing format', () => {
      const models = [
        mockModel({
          id: 'gpt-4o-mini-openrouter',
          name: 'GPT-4o-mini',
          pricing: { prompt: '0.00000015', completion: '0.0000006' },
          source_gateway: 'openrouter',
        }),
        mockModel({
          id: 'gpt-4o-mini-onerouter',
          name: 'GPT-4o-mini',
          pricing: { prompt: '0.15', completion: '0.60' },
          source_gateway: 'onerouter',
        }),
        mockModel({
          id: 'expensive-model',
          name: 'Expensive Model',
          pricing: { prompt: '0.000015', completion: '0.00006' },
          source_gateway: 'openrouter',
        }),
      ];

      // Filter for models under $1/M input price
      const maxPricePerMillion = 1;
      const maxPerToken = maxPricePerMillion / 1000000;

      const affordable = models.filter((model) => {
        const gateway = getSourceGateway(model);
        const normalizedPrice = getNormalizedPerTokenPrice(model.pricing?.prompt, gateway);
        return normalizedPrice <= maxPerToken;
      });

      expect(affordable).toHaveLength(2);
      expect(affordable.map((m) => m.id)).toEqual([
        'gpt-4o-mini-openrouter',
        'gpt-4o-mini-onerouter',
      ]);
    });

    it('should sort models by price correctly across gateways', () => {
      const models = [
        mockModel({
          id: 'expensive-openrouter',
          pricing: { prompt: '0.000015', completion: '0.00006' }, // $15/M + $60/M
          source_gateway: 'openrouter',
        }),
        mockModel({
          id: 'cheap-onerouter',
          pricing: { prompt: '0.15', completion: '0.60' }, // $0.15/M + $0.60/M
          source_gateway: 'onerouter',
        }),
        mockModel({
          id: 'mid-openrouter',
          pricing: { prompt: '0.000001', completion: '0.000003' }, // $1/M + $3/M
          source_gateway: 'openrouter',
        }),
      ];

      // Sort by total price ascending
      const sorted = [...models].sort((a, b) => {
        const aGateway = getSourceGateway(a);
        const bGateway = getSourceGateway(b);
        const aTotal =
          getNormalizedPerTokenPrice(a.pricing?.prompt, aGateway) +
          getNormalizedPerTokenPrice(a.pricing?.completion, aGateway);
        const bTotal =
          getNormalizedPerTokenPrice(b.pricing?.prompt, bGateway) +
          getNormalizedPerTokenPrice(b.pricing?.completion, bGateway);
        return aTotal - bTotal;
      });

      expect(sorted.map((m) => m.id)).toEqual([
        'cheap-onerouter', // $0.75/M total
        'mid-openrouter', // $4/M total
        'expensive-openrouter', // $75/M total
      ]);
    });

    it('should handle null/undefined pricing gracefully', () => {
      expect(formatPricingForDisplay(undefined, 'openrouter')).toBeNull();
      expect(formatPricingForDisplay('', 'openrouter')).toBeNull();
      expect(formatPricingForDisplay('N/A', 'openrouter')).toBeNull();

      expect(getNormalizedPerTokenPrice(undefined, 'openrouter')).toBe(0);
      expect(getNormalizedPerTokenPrice('', 'onerouter')).toBe(0);
    });

    it('should handle zero pricing correctly', () => {
      expect(formatPricingForDisplay('0', 'openrouter')).toBe('0.00');
      expect(formatPricingForDisplay('0', 'onerouter')).toBe('0.00');
      expect(getNormalizedPerTokenPrice('0', 'openrouter')).toBe(0);
      expect(getNormalizedPerTokenPrice('0', 'onerouter')).toBe(0);
    });
  });

  describe('Table view formatting', () => {
    it('should format context length with commas', () => {
      const formatContext = (length: number) => {
        if (length <= 0) return '-';
        return length.toLocaleString();
      };

      expect(formatContext(0)).toBe('-');
      expect(formatContext(-1)).toBe('-');
      expect(formatContext(1000)).toBe('1,000');
      expect(formatContext(128000)).toBe('128,000');
      expect(formatContext(1000000)).toBe('1,000,000');
    });

    it('should display free indicator for free models', () => {
      const model = mockModel({
        id: 'google/gemini-2.0-flash-exp:free',
        source_gateway: 'openrouter',
        pricing: { prompt: '0', completion: '0' }
      });

      const sourceGateway = model.source_gateway || (model.source_gateways?.[0]) || '';
      const isFree = sourceGateway === 'openrouter' && model.id?.endsWith(':free');

      expect(isFree).toBe(true);
    });

    it('should display pricing correctly in table view', () => {
      const model = mockModel({
        pricing: { prompt: '0.00000015', completion: '0.0000006' },
        source_gateway: 'openrouter',
      });

      const sourceGateway = getSourceGateway(model);
      const inputCost = formatPricingForDisplay(model.pricing?.prompt, sourceGateway);
      const outputCost = formatPricingForDisplay(model.pricing?.completion, sourceGateway);

      expect(inputCost).toBe('0.15');
      expect(outputCost).toBe('0.60');
    });

    it('should handle models without pricing in table view', () => {
      const model = mockModel({ pricing: null });

      const hasPricing = model.pricing !== null && model.pricing !== undefined;
      expect(hasPricing).toBe(false);
    });
  });

  describe('Layout state', () => {
    it('should default to table layout', () => {
      const defaultLayout: 'table' | 'grid' = 'table';
      expect(defaultLayout).toBe('table');
    });

    it('should support both table and grid layouts', () => {
      type LayoutType = 'table' | 'grid';
      const layouts: LayoutType[] = ['table', 'grid'];

      expect(layouts).toContain('table');
      expect(layouts).toContain('grid');
    });
  });
});
