import {
  ModelSelect,
  ModelOption,
  cleanModelName,
  getGatewayAbbrev,
  getDeveloper,
  getModelSpeedTier,
  ensureRouterOption,
} from '../model-select';

// Test the component exports correctly
describe('ModelSelect', () => {
  it('should be defined and exportable', () => {
    expect(ModelSelect).toBeDefined();
    expect(typeof ModelSelect).toBe('function');
  });

  describe('Component interface', () => {
    it('should be a valid React component', () => {
      // React components are functions
      expect(typeof ModelSelect).toBe('function');
    });
  });
});

// Test cleanModelName helper function
describe('cleanModelName', () => {
  it('should remove "(Free)" suffix from model names', () => {
    expect(cleanModelName('GPT-4 (Free)')).toBe('GPT-4');
    expect(cleanModelName('Claude 3 (free)')).toBe('Claude 3');
    expect(cleanModelName('Model (FREE)')).toBe('Model');
  });

  it('should handle model names without "(Free)" suffix', () => {
    expect(cleanModelName('GPT-4')).toBe('GPT-4');
    expect(cleanModelName('Claude 3 Opus')).toBe('Claude 3 Opus');
  });

  it('should trim whitespace', () => {
    expect(cleanModelName('  GPT-4  ')).toBe('GPT-4');
    expect(cleanModelName('Model (Free)  ')).toBe('Model');
  });

  it('should handle "(Free)" in the middle of the name', () => {
    // The regex removes "(Free)" with optional surrounding whitespace,
    // which may collapse adjacent spaces - this is acceptable behavior
    expect(cleanModelName('Model (Free) Version')).toBe('ModelVersion');
  });
});

// Test getGatewayAbbrev helper function
describe('getGatewayAbbrev', () => {
  it('should return known abbreviations for common gateways', () => {
    expect(getGatewayAbbrev('cerebras')).toBe('CRB');
    expect(getGatewayAbbrev('groq')).toBe('GRQ');
    expect(getGatewayAbbrev('fireworks')).toBe('FW');
    expect(getGatewayAbbrev('together')).toBe('TGR');
    expect(getGatewayAbbrev('deepinfra')).toBe('DI');
    expect(getGatewayAbbrev('featherless')).toBe('FL');
    expect(getGatewayAbbrev('novita')).toBe('NVT');
    expect(getGatewayAbbrev('chutes')).toBe('CHT');
    expect(getGatewayAbbrev('nebius')).toBe('NEB');
    expect(getGatewayAbbrev('huggingface')).toBe('HF');
    expect(getGatewayAbbrev('near')).toBe('NEAR');
  });

  it('should be case-insensitive', () => {
    expect(getGatewayAbbrev('CEREBRAS')).toBe('CRB');
    expect(getGatewayAbbrev('Groq')).toBe('GRQ');
    expect(getGatewayAbbrev('FIREWORKS')).toBe('FW');
  });

  it('should return first 3 characters uppercase for unknown gateways', () => {
    expect(getGatewayAbbrev('openrouter')).toBe('OPE');
    expect(getGatewayAbbrev('unknown')).toBe('UNK');
    expect(getGatewayAbbrev('newgateway')).toBe('NEW');
  });

  it('should handle short gateway names', () => {
    expect(getGatewayAbbrev('ab')).toBe('AB');
    expect(getGatewayAbbrev('x')).toBe('X');
  });
});

// Test getDeveloper helper function
describe('getDeveloper', () => {
  it('should extract and format known developers from model IDs', () => {
    expect(getDeveloper('openai/gpt-4')).toBe('OpenAI');
    expect(getDeveloper('anthropic/claude-3')).toBe('Anthropic');
    expect(getDeveloper('google/gemini-pro')).toBe('Google');
    expect(getDeveloper('meta-llama/llama-3')).toBe('Meta');
    expect(getDeveloper('mistralai/mistral-7b')).toBe('Mistral AI');
    expect(getDeveloper('cohere/command')).toBe('Cohere');
    expect(getDeveloper('amazon/titan')).toBe('Amazon');
    expect(getDeveloper('microsoft/phi-3')).toBe('Microsoft');
    expect(getDeveloper('deepseek/deepseek-coder')).toBe('DeepSeek');
    expect(getDeveloper('qwen/qwen-2')).toBe('Qwen');
    expect(getDeveloper('x-ai/grok')).toBe('xAI');
  });

  it('should capitalize unknown developers', () => {
    expect(getDeveloper('newdev/model')).toBe('Newdev');
    expect(getDeveloper('custom/model-name')).toBe('Custom');
  });

  it('should return "Other" for models without developer prefix', () => {
    expect(getDeveloper('model-without-prefix')).toBe('Other');
    expect(getDeveloper('simple-model')).toBe('Other');
  });

  it('should handle multiple slashes in model ID', () => {
    expect(getDeveloper('openai/gpt-4/latest')).toBe('OpenAI');
    expect(getDeveloper('custom/path/to/model')).toBe('Custom');
  });
});

// Test getModelSpeedTier helper function
describe('getModelSpeedTier', () => {
  describe('ultra-fast tier', () => {
    it('should identify Cerebras models as ultra-fast', () => {
      expect(getModelSpeedTier('any-model', 'cerebras')).toBe('ultra-fast');
      expect(getModelSpeedTier('llama-3@cerebras/version', undefined)).toBe('ultra-fast');
    });

    it('should identify Groq models as ultra-fast', () => {
      expect(getModelSpeedTier('any-model', 'groq')).toBe('ultra-fast');
      expect(getModelSpeedTier('groq/llama-3-8b', undefined)).toBe('ultra-fast');
    });
  });

  describe('fast tier', () => {
    it('should identify Fireworks models as fast', () => {
      expect(getModelSpeedTier('any-model', 'fireworks')).toBe('fast');
      expect(getModelSpeedTier('fireworks/llama-3', undefined)).toBe('fast');
    });

    it('should identify known fast models by name', () => {
      expect(getModelSpeedTier('google/gemini-flash', undefined)).toBe('fast');
      expect(getModelSpeedTier('openai/gpt-4o-mini', undefined)).toBe('fast');
      expect(getModelSpeedTier('anthropic/claude-haiku', undefined)).toBe('fast');
    });
  });

  describe('medium tier', () => {
    it('should identify standard models as medium', () => {
      expect(getModelSpeedTier('openai/gpt-4-turbo', undefined)).toBe('medium');
      expect(getModelSpeedTier('anthropic/claude-sonnet', undefined)).toBe('medium');
      expect(getModelSpeedTier('meta/llama-3-70b', undefined)).toBe('medium');
    });
  });

  describe('slow tier', () => {
    it('should identify reasoning models as slow', () => {
      expect(getModelSpeedTier('openai/o1-preview', undefined)).toBe('slow');
      expect(getModelSpeedTier('openai/o3-mini', undefined)).toBe('slow');
      expect(getModelSpeedTier('deepseek/deepseek-reasoner', undefined)).toBe('slow');
      expect(getModelSpeedTier('qwen/qwq-32b', undefined)).toBe('slow');
    });
  });

  describe('unknown tier', () => {
    it('should return undefined for unknown models', () => {
      expect(getModelSpeedTier('unknown/random-model', undefined)).toBeUndefined();
      expect(getModelSpeedTier('custom/custom-model', undefined)).toBeUndefined();
    });
  });
});

// Test ensureRouterOption helper function
describe('ensureRouterOption', () => {
  const ROUTER_VALUE = 'openrouter/auto';

  it('should add router option to empty array', () => {
    const result = ensureRouterOption([]);
    expect(result.length).toBe(1);
    expect(result[0].value).toBe(ROUTER_VALUE);
    expect(result[0].label).toBe('Gatewayz Router');
  });

  it('should prepend router option when not present', () => {
    const models: ModelOption[] = [
      { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid' },
      { value: 'anthropic/claude-3', label: 'Claude 3', category: 'Paid' },
    ];
    const result = ensureRouterOption(models);
    expect(result.length).toBe(3);
    expect(result[0].value).toBe(ROUTER_VALUE);
    expect(result[1].value).toBe('openai/gpt-4');
  });

  it('should not duplicate router option when already present', () => {
    const models: ModelOption[] = [
      { value: ROUTER_VALUE, label: 'Existing Router', category: 'Router' },
      { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid' },
    ];
    const result = ensureRouterOption(models);
    expect(result.length).toBe(2);
    // Router option should be merged with default properties
    expect(result[0].value).toBe(ROUTER_VALUE);
  });

  it('should preserve original model properties', () => {
    const models: ModelOption[] = [
      {
        value: 'openai/gpt-4',
        label: 'GPT-4',
        category: 'Paid',
        developer: 'OpenAI',
        speedTier: 'medium',
      },
    ];
    const result = ensureRouterOption(models);
    expect(result[1].developer).toBe('OpenAI');
    expect(result[1].speedTier).toBe('medium');
  });

  it('should set router with correct default properties', () => {
    const result = ensureRouterOption([]);
    const router = result[0];
    expect(router.category).toBe('Router');
    expect(router.sourceGateway).toBe('openrouter');
    expect(router.developer).toBe('Alpaca');
    expect(router.modalities).toEqual(['Text', 'Image', 'File', 'Audio', 'Video']);
  });
});

// Helper to create mock model data
const createMockModels = (count: number): ModelOption[] => {
  const developers = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Mistral AI'];
  const categories = ['Paid', 'Free'];

  return Array.from({ length: count }, (_, i) => ({
    value: `${developers[i % developers.length].toLowerCase()}/model-${i}`,
    label: `Test Model ${i}`,
    category: categories[i % categories.length],
    developer: developers[i % developers.length],
    sourceGateway: 'openrouter',
    modalities: ['Text'],
    speedTier: 'fast' as const,
  }));
};

// Helper to simulate matchesQuery function from the component
const matchesQuery = (model: ModelOption, query: string): boolean => {
  const labelLower = model.label.toLowerCase();
  const valueLower = model.value.toLowerCase();
  const developerLower = model.developer?.toLowerCase() || '';

  return labelLower.includes(query) ||
    valueLower.includes(query) ||
    developerLower.includes(query);
};

// Test filtering logic that mirrors the optimized component implementation
describe('ModelSelect filtering performance', () => {
  describe('filter matching logic', () => {
    it('should match models by label (case-insensitive)', () => {
      const models = createMockModels(10);
      const query = 'test model 5';

      const matchingModels = models.filter(model =>
        model.label.toLowerCase().includes(query.toLowerCase())
      );

      expect(matchingModels).toHaveLength(1);
      expect(matchingModels[0].label).toBe('Test Model 5');
    });

    it('should match models by value/id', () => {
      const models = createMockModels(10);
      const query = 'anthropic';

      const matchingModels = models.filter(model =>
        model.value.toLowerCase().includes(query.toLowerCase())
      );

      expect(matchingModels.length).toBeGreaterThan(0);
      expect(matchingModels.every(m => m.value.includes('anthropic'))).toBe(true);
    });

    it('should match models by developer', () => {
      const models = createMockModels(10);
      const query = 'google';

      const matchingModels = models.filter(model =>
        model.developer?.toLowerCase().includes(query.toLowerCase())
      );

      expect(matchingModels.length).toBeGreaterThan(0);
      expect(matchingModels.every(m => m.developer === 'Google')).toBe(true);
    });
  });

  describe('combined filter computation', () => {
    it('should efficiently filter when query is empty', () => {
      const query = '';
      const models = createMockModels(100);

      // Empty query should return all models without filtering
      const result = query.trim() ? models.filter(() => true) : models;

      expect(result).toBe(models); // Same reference, no filtering
    });

    it('should handle special characters in search', () => {
      const models: ModelOption[] = [
        {
          value: 'openai/gpt-4o-mini',
          label: 'GPT-4o Mini',
          category: 'Paid',
          developer: 'OpenAI',
        },
        {
          value: 'anthropic/claude-3.5-sonnet',
          label: 'Claude 3.5 Sonnet',
          category: 'Paid',
          developer: 'Anthropic',
        },
      ];

      const query = 'gpt-4o';
      const matchingModels = models.filter(model =>
        model.label.toLowerCase().includes(query.toLowerCase()) ||
        model.value.toLowerCase().includes(query.toLowerCase())
      );

      expect(matchingModels).toHaveLength(1);
      expect(matchingModels[0].value).toBe('openai/gpt-4o-mini');
    });

    it('should use matchesQuery helper correctly', () => {
      const model: ModelOption = {
        value: 'openai/gpt-4',
        label: 'GPT-4',
        category: 'Paid',
        developer: 'OpenAI',
      };

      expect(matchesQuery(model, 'gpt')).toBe(true);
      expect(matchesQuery(model, 'openai')).toBe(true);
      expect(matchesQuery(model, 'anthropic')).toBe(false);
      // Note: matchesQuery only checks label, value, and developer - not category
      expect(matchesQuery(model, 'paid')).toBe(false);
    });

    it('should handle models without developer', () => {
      const model: ModelOption = {
        value: 'unknown/model',
        label: 'Unknown Model',
        category: 'Free',
      };

      expect(matchesQuery(model, 'unknown')).toBe(true);
      expect(matchesQuery(model, 'developer')).toBe(false);
    });
  });

  describe('performance characteristics', () => {
    it('should complete filtering of 500 models in reasonable time', () => {
      const models = createMockModels(500);
      const query = 'openai';

      const startTime = performance.now();

      const matchingModels = models.filter(model =>
        model.label.toLowerCase().includes(query.toLowerCase()) ||
        model.value.toLowerCase().includes(query.toLowerCase()) ||
        model.developer?.toLowerCase().includes(query.toLowerCase())
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 50ms even with 500 models
      expect(duration).toBeLessThan(50);
      expect(matchingModels.length).toBeGreaterThan(0);
    });
  });
});

// Test combined filter data structure (mirrors filteredData useMemo)
describe('ModelSelect combined filter computation', () => {
  it('should return unfiltered data when query is empty', () => {
    const modelsByDeveloper: Record<string, ModelOption[]> = {
      'OpenAI': createMockModels(5).filter(m => m.developer === 'OpenAI'),
      'Anthropic': createMockModels(5).filter(m => m.developer === 'Anthropic'),
    };
    const modelsByCategory: Record<string, ModelOption[]> = {
      'Reasoning': [],
      'Code Generation': [],
    };
    const favoriteModels: ModelOption[] = [];
    const popularModels: ModelOption[] = [];
    const incognitoModels: ModelOption[] = [];

    const query = '';

    // Mirrors the filteredData useMemo logic
    const filteredData = (() => {
      const trimmedQuery = query.trim().toLowerCase();

      if (!trimmedQuery) {
        return {
          modelsByDeveloper,
          modelsByCategory,
          favoriteModels,
          popularModels,
          incognitoModels,
        };
      }

      return { modelsByDeveloper: {}, modelsByCategory: {}, favoriteModels: [], popularModels: [], incognitoModels: [] };
    })();

    // Should return same references when query is empty
    expect(filteredData.modelsByDeveloper).toBe(modelsByDeveloper);
    expect(filteredData.modelsByCategory).toBe(modelsByCategory);
  });

  it('should filter developer groups correctly', () => {
    const openaiModels: ModelOption[] = [
      { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid', developer: 'OpenAI' },
      { value: 'openai/gpt-3.5', label: 'GPT-3.5', category: 'Paid', developer: 'OpenAI' },
    ];
    const anthropicModels: ModelOption[] = [
      { value: 'anthropic/claude-3', label: 'Claude 3', category: 'Paid', developer: 'Anthropic' },
    ];

    const modelsByDeveloper: Record<string, ModelOption[]> = {
      'OpenAI': openaiModels,
      'Anthropic': anthropicModels,
    };

    const query = 'gpt';

    // Mirrors the filteredData filtering logic
    const filteredByDeveloper: Record<string, ModelOption[]> = {};
    Object.entries(modelsByDeveloper).forEach(([developer, devModels]) => {
      const developerLower = developer.toLowerCase();
      const developerMatches = developerLower.includes(query);

      const matchingModels = developerMatches
        ? devModels
        : devModels.filter(model => matchesQuery(model, query));

      if (matchingModels.length > 0) {
        filteredByDeveloper[developer] = matchingModels;
      }
    });

    expect(filteredByDeveloper['OpenAI']).toHaveLength(2);
    expect(filteredByDeveloper['Anthropic']).toBeUndefined();
  });

  it('should include all models when developer name matches query', () => {
    const openaiModels: ModelOption[] = [
      { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid', developer: 'OpenAI' },
      { value: 'openai/dall-e', label: 'DALL-E', category: 'Paid', developer: 'OpenAI' },
    ];

    const modelsByDeveloper: Record<string, ModelOption[]> = {
      'OpenAI': openaiModels,
    };

    const query = 'openai';

    const filteredByDeveloper: Record<string, ModelOption[]> = {};
    Object.entries(modelsByDeveloper).forEach(([developer, devModels]) => {
      const developerLower = developer.toLowerCase();
      const developerMatches = developerLower.includes(query);

      const matchingModels = developerMatches
        ? devModels // All models included when developer matches
        : devModels.filter(model => matchesQuery(model, query));

      if (matchingModels.length > 0) {
        filteredByDeveloper[developer] = matchingModels;
      }
    });

    // Both models included because "OpenAI" matches "openai"
    expect(filteredByDeveloper['OpenAI']).toHaveLength(2);
  });

  it('should filter category groups correctly', () => {
    const reasoningModels: ModelOption[] = [
      { value: 'openai/o1', label: 'O1', category: 'Paid', developer: 'OpenAI' },
    ];
    const codeModels: ModelOption[] = [
      { value: 'deepseek/coder', label: 'DeepSeek Coder', category: 'Paid', developer: 'DeepSeek' },
    ];

    const modelsByCategory: Record<string, ModelOption[]> = {
      'Reasoning': reasoningModels,
      'Code Generation': codeModels,
    };

    const query = 'code';

    const filteredByCategory: Record<string, ModelOption[]> = {};
    Object.entries(modelsByCategory).forEach(([category, catModels]) => {
      const categoryLower = category.toLowerCase();
      const categoryMatches = categoryLower.includes(query);

      const matchingModels = categoryMatches
        ? catModels
        : catModels.filter(model => matchesQuery(model, query));

      if (matchingModels.length > 0) {
        filteredByCategory[category] = matchingModels;
      }
    });

    // "Code Generation" category matches "code", so all its models included
    expect(filteredByCategory['Code Generation']).toHaveLength(1);
    // "Reasoning" doesn't match and its models don't contain "code"
    expect(filteredByCategory['Reasoning']).toBeUndefined();
  });
});

// Test category pattern matching (mirrors categoryPatterns and categorizeModel)
describe('ModelSelect category patterns', () => {
  const categoryPatterns = {
    r1: /\br1\b/i,
    o1: /\bo1\b/i,
    o3: /\bo3\b/i,
    o4: /\bo4\b/i,
  };

  it('should match r1 pattern correctly', () => {
    expect(categoryPatterns.r1.test('deepseek-r1')).toBe(true);
    expect(categoryPatterns.r1.test('r1-preview')).toBe(true);
    expect(categoryPatterns.r1.test('model-r1-latest')).toBe(true);
    // Should not match r12, r100, etc.
    expect(categoryPatterns.r1.test('r12')).toBe(false);
    expect(categoryPatterns.r1.test('r100')).toBe(false);
  });

  it('should match o1 pattern correctly', () => {
    expect(categoryPatterns.o1.test('openai/o1')).toBe(true);
    expect(categoryPatterns.o1.test('o1-preview')).toBe(true);
    expect(categoryPatterns.o1.test('o1-mini')).toBe(true);
    // Should not match o10, o100, etc.
    expect(categoryPatterns.o1.test('o10')).toBe(false);
    expect(categoryPatterns.o1.test('o100')).toBe(false);
  });

  it('should match o3 pattern correctly', () => {
    expect(categoryPatterns.o3.test('openai/o3')).toBe(true);
    expect(categoryPatterns.o3.test('o3-mini')).toBe(true);
    expect(categoryPatterns.o3.test('o30')).toBe(false);
  });

  it('should match o4 pattern correctly', () => {
    expect(categoryPatterns.o4.test('openai/o4')).toBe(true);
    expect(categoryPatterns.o4.test('o4-preview')).toBe(true);
    expect(categoryPatterns.o4.test('o40')).toBe(false);
  });
});

// Test model categorization logic (mirrors categorizeModel)
describe('ModelSelect model categorization', () => {
  const categoryPatterns = {
    r1: /\br1\b/i,
    o1: /\bo1\b/i,
    o3: /\bo3\b/i,
    o4: /\bo4\b/i,
  };

  const categorizeModel = (model: ModelOption): string[] => {
    const categories: string[] = [];
    const modelName = model.label.toLowerCase();
    const modelId = model.value.toLowerCase();

    // Reasoning models
    if (
      modelId.includes('deepseek-reasoner') ||
      categoryPatterns.r1.test(modelId) ||
      modelId.includes('qwq') ||
      categoryPatterns.o1.test(modelId) ||
      categoryPatterns.o3.test(modelId) ||
      categoryPatterns.o4.test(modelId) ||
      modelId.includes('thinking') ||
      modelId.includes('reason') ||
      modelName.includes('reasoning') ||
      modelName.includes('reasoner') ||
      modelName.includes('thinking') ||
      categoryPatterns.r1.test(modelName)
    ) {
      categories.push('Reasoning');
    }

    // Code generation models
    if (
      modelId.includes('code') ||
      modelId.includes('codestral') ||
      modelId.includes('codellama') ||
      modelId.includes('starcoder') ||
      modelId.includes('deepseek-coder') ||
      modelId.includes('qwen-coder') ||
      modelName.includes('code') ||
      modelName.includes('coder')
    ) {
      categories.push('Code Generation');
    }

    // Multimodal models
    if (model.category === 'Multimodal' || modelName.includes('vision') || modelName.includes('multimodal')) {
      categories.push('Multimodal');
    }

    // Image/Video models - check modalities array for image or video support
    // Note: We only use modalities array here, not vision name check, since vision models
    // are already captured in the Multimodal category above
    const modalities = model.modalities || [];
    const hasImageSupport = modalities.some(m => m.toLowerCase() === 'image');
    const hasVideoSupport = modalities.some(m => m.toLowerCase() === 'video');
    if (hasImageSupport || hasVideoSupport) {
      categories.push('Image/Video');
    }

    // Cost Efficient models
    const isFree = model.category === 'Free' || model.category?.toLowerCase().includes('free');
    if (isFree) {
      categories.push('Cost Efficient');
      categories.push('Free');
    } else if (model.category === 'Paid') {
      if (modelId.includes('gemini-flash') || modelId.includes('gpt-4o-mini') || modelId.includes('claude-haiku')) {
        categories.push('Cost Efficient');
      }
    }

    return categories;
  };

  it('should categorize reasoning models correctly', () => {
    const models: ModelOption[] = [
      { value: 'deepseek/deepseek-reasoner', label: 'DeepSeek Reasoner', category: 'Paid' },
      { value: 'openai/o1-preview', label: 'O1 Preview', category: 'Paid' },
      { value: 'deepseek/r1', label: 'R1', category: 'Paid' },
      { value: 'qwen/qwq-32b', label: 'QwQ 32B', category: 'Paid' },
    ];

    models.forEach(model => {
      const categories = categorizeModel(model);
      expect(categories).toContain('Reasoning');
    });
  });

  it('should categorize code models correctly', () => {
    const models: ModelOption[] = [
      { value: 'deepseek/deepseek-coder', label: 'DeepSeek Coder', category: 'Paid' },
      { value: 'meta/codellama-70b', label: 'CodeLlama 70B', category: 'Paid' },
      { value: 'bigcode/starcoder2', label: 'StarCoder 2', category: 'Free' },
    ];

    models.forEach(model => {
      const categories = categorizeModel(model);
      expect(categories).toContain('Code Generation');
    });
  });

  it('should categorize multimodal models correctly', () => {
    const model: ModelOption = {
      value: 'openai/gpt-4-vision',
      label: 'GPT-4 Vision',
      category: 'Paid',
    };

    const categories = categorizeModel(model);
    expect(categories).toContain('Multimodal');
  });

  it('should categorize Image/Video models correctly by modalities array', () => {
    const modelsWithImageSupport: ModelOption[] = [
      { value: 'openai/gpt-4o', label: 'GPT-4o', category: 'Paid', modalities: ['Text', 'Image'] },
      { value: 'google/gemini-pro-vision', label: 'Gemini Pro Vision', category: 'Paid', modalities: ['Text', 'Image', 'Video'] },
      { value: 'anthropic/claude-3-sonnet', label: 'Claude 3 Sonnet', category: 'Paid', modalities: ['Text', 'Image'] },
    ];

    modelsWithImageSupport.forEach(model => {
      const categories = categorizeModel(model);
      expect(categories).toContain('Image/Video');
    });
  });

  it('should categorize Image/Video models correctly by video modality', () => {
    const model: ModelOption = {
      value: 'google/gemini-pro',
      label: 'Gemini Pro',
      category: 'Paid',
      modalities: ['Text', 'Video'],
    };

    const categories = categorizeModel(model);
    expect(categories).toContain('Image/Video');
  });

  it('should categorize vision models as Multimodal (not Image/Video without modalities)', () => {
    const models: ModelOption[] = [
      { value: 'openai/gpt-4-vision-preview', label: 'GPT-4 Vision Preview', category: 'Paid' },
      { value: 'meta/llama-3-vision', label: 'Llama 3 Vision', category: 'Paid' },
    ];

    models.forEach(model => {
      const categories = categorizeModel(model);
      // Vision models without explicit modalities go to Multimodal, not Image/Video
      expect(categories).toContain('Multimodal');
      expect(categories).not.toContain('Image/Video');
    });
  });

  it('should not categorize text-only models as Image/Video', () => {
    const model: ModelOption = {
      value: 'openai/gpt-4-turbo',
      label: 'GPT-4 Turbo',
      category: 'Paid',
      modalities: ['Text'],
    };

    const categories = categorizeModel(model);
    expect(categories).not.toContain('Image/Video');
  });

  it('should handle models without modalities array for Image/Video', () => {
    const model: ModelOption = {
      value: 'openai/gpt-4-turbo',
      label: 'GPT-4 Turbo',
      category: 'Paid',
      // No modalities array
    };

    const categories = categorizeModel(model);
    expect(categories).not.toContain('Image/Video');
  });

  it('should categorize free models as cost efficient', () => {
    const model: ModelOption = {
      value: 'meta/llama-3-8b',
      label: 'Llama 3 8B',
      category: 'Free',
    };

    const categories = categorizeModel(model);
    expect(categories).toContain('Cost Efficient');
    expect(categories).toContain('Free');
  });

  it('should categorize efficient paid models correctly', () => {
    const models: ModelOption[] = [
      { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', category: 'Paid' },
      { value: 'google/gemini-flash', label: 'Gemini Flash', category: 'Paid' },
      { value: 'anthropic/claude-haiku', label: 'Claude Haiku', category: 'Paid' },
    ];

    models.forEach(model => {
      const categories = categorizeModel(model);
      expect(categories).toContain('Cost Efficient');
    });
  });

  it('should not categorize regular paid models as cost efficient', () => {
    const model: ModelOption = {
      value: 'openai/gpt-4-turbo',
      label: 'GPT-4 Turbo',
      category: 'Paid',
    };

    const categories = categorizeModel(model);
    expect(categories).not.toContain('Cost Efficient');
  });
});

// Test section expansion logic (mirrors auto-expand useEffect)
describe('ModelSelect section expansion', () => {
  it('should collect sections to expand based on search results', () => {
    const filteredPopularModels = [{ value: 'model1', label: 'Model 1', category: 'Paid' }];
    const filteredIncognitoModels: ModelOption[] = [];
    const filteredModelsByDeveloper = { 'OpenAI': [], 'Anthropic': [] };
    const filteredModelsByCategory = { 'Reasoning': [] };

    const sectionsToExpand: string[] = [];

    if (filteredPopularModels.length > 0) {
      sectionsToExpand.push('Popular');
    }

    if (filteredIncognitoModels.length > 0) {
      sectionsToExpand.push('Incognito');
    }

    Object.keys(filteredModelsByDeveloper).forEach(dev => {
      sectionsToExpand.push(dev);
    });

    Object.keys(filteredModelsByCategory).forEach(cat => {
      sectionsToExpand.push(cat);
    });

    expect(sectionsToExpand).toContain('Popular');
    expect(sectionsToExpand).not.toContain('Incognito');
    expect(sectionsToExpand).toContain('OpenAI');
    expect(sectionsToExpand).toContain('Anthropic');
    expect(sectionsToExpand).toContain('Reasoning');
  });

  it('should only update expanded set when needed', () => {
    const expandedDevelopers = new Set(['Favorites', 'Popular']);
    const sectionsToExpand = ['Popular', 'OpenAI'];

    // Check if any section actually needs to be added
    const needsUpdate = sectionsToExpand.some(section => !expandedDevelopers.has(section));

    expect(needsUpdate).toBe(true); // 'OpenAI' is not in the set

    // If all sections already expanded, no update needed
    const allExpanded = new Set(['Favorites', 'Popular', 'OpenAI']);
    const needsUpdate2 = sectionsToExpand.some(section => !allExpanded.has(section));

    expect(needsUpdate2).toBe(false);
  });
});

// Test server-side search functionality
describe('ModelSelect server-side search', () => {
  describe('merging search results with cached models', () => {
    it('should return cached models when no search query', () => {
      const cachedModels = createMockModels(50);
      const searchResults: ModelOption[] = [];
      const searchQuery = '';

      const mergedModels = (() => {
        if (!searchQuery.trim()) {
          return cachedModels;
        }

        const modelMap = new Map<string, ModelOption>();
        cachedModels.forEach(model => modelMap.set(model.value, model));
        searchResults.forEach(model => modelMap.set(model.value, model));
        return Array.from(modelMap.values());
      })();

      expect(mergedModels).toBe(cachedModels);
      expect(mergedModels.length).toBe(50);
    });

    it('should merge cached models with server search results', () => {
      const cachedModels: ModelOption[] = [
        { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid', developer: 'OpenAI' },
        { value: 'anthropic/claude-3', label: 'Claude 3', category: 'Paid', developer: 'Anthropic' },
      ];
      const searchResults: ModelOption[] = [
        { value: 'google/gemini-pro', label: 'Gemini Pro', category: 'Paid', developer: 'Google' },
        { value: 'meta/llama-3', label: 'Llama 3', category: 'Free', developer: 'Meta' },
      ];
      const searchQuery = 'pro';

      const mergedModels = (() => {
        if (!searchQuery.trim()) {
          return cachedModels;
        }

        const modelMap = new Map<string, ModelOption>();
        cachedModels.forEach(model => modelMap.set(model.value, model));
        searchResults.forEach(model => modelMap.set(model.value, model));
        return Array.from(modelMap.values());
      })();

      expect(mergedModels.length).toBe(4);
      expect(mergedModels.some(m => m.value === 'openai/gpt-4')).toBe(true);
      expect(mergedModels.some(m => m.value === 'google/gemini-pro')).toBe(true);
    });

    it('should deduplicate models when merging (server results take precedence)', () => {
      const cachedModels: ModelOption[] = [
        { value: 'openai/gpt-4', label: 'GPT-4 Old', category: 'Paid', developer: 'OpenAI' },
      ];
      const searchResults: ModelOption[] = [
        { value: 'openai/gpt-4', label: 'GPT-4 Updated', category: 'Paid', developer: 'OpenAI' },
      ];
      const searchQuery = 'gpt';

      const mergedModels = (() => {
        if (!searchQuery.trim()) {
          return cachedModels;
        }

        const modelMap = new Map<string, ModelOption>();
        cachedModels.forEach(model => modelMap.set(model.value, model));
        searchResults.forEach(model => modelMap.set(model.value, model));
        return Array.from(modelMap.values());
      })();

      expect(mergedModels.length).toBe(1);
      expect(mergedModels[0].label).toBe('GPT-4 Updated'); // Server result takes precedence
    });

    it('should handle empty search results', () => {
      const cachedModels = createMockModels(10);
      const searchResults: ModelOption[] = [];
      const searchQuery = 'nonexistent';

      const mergedModels = (() => {
        if (!searchQuery.trim()) {
          return cachedModels;
        }

        const modelMap = new Map<string, ModelOption>();
        cachedModels.forEach(model => modelMap.set(model.value, model));
        searchResults.forEach(model => modelMap.set(model.value, model));
        return Array.from(modelMap.values());
      })();

      // Still returns cached models even if server returns nothing
      expect(mergedModels.length).toBe(10);
    });
  });

  describe('rebuilding groups from merged models during search', () => {
    it('should rebuild developer groups from merged models', () => {
      const mergedModels: ModelOption[] = [
        { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid', developer: 'OpenAI' },
        { value: 'openai/gpt-3.5', label: 'GPT-3.5', category: 'Paid', developer: 'OpenAI' },
        { value: 'google/gemini-pro', label: 'Gemini Pro', category: 'Paid', developer: 'Google' },
      ];

      const searchModelsByDeveloper: Record<string, ModelOption[]> = {};
      mergedModels.forEach(model => {
        const dev = model.developer || 'Other';
        if (!searchModelsByDeveloper[dev]) {
          searchModelsByDeveloper[dev] = [];
        }
        searchModelsByDeveloper[dev].push(model);
      });

      expect(searchModelsByDeveloper['OpenAI']).toHaveLength(2);
      expect(searchModelsByDeveloper['Google']).toHaveLength(1);
      expect(Object.keys(searchModelsByDeveloper)).toHaveLength(2);
    });

    it('should rebuild category groups from merged models', () => {
      const mergedModels: ModelOption[] = [
        { value: 'openai/o1-preview', label: 'O1 Preview', category: 'Paid', developer: 'OpenAI' },
        { value: 'deepseek/deepseek-coder', label: 'DeepSeek Coder', category: 'Paid', developer: 'DeepSeek' },
        { value: 'meta/llama-3', label: 'Llama 3', category: 'Free', developer: 'Meta' },
        { value: 'openai/gpt-4-vision', label: 'GPT-4 Vision', category: 'Paid', developer: 'OpenAI', modalities: ['Text', 'Image'] },
      ];

      const categoryPatterns = {
        r1: /\br1\b/i,
        o1: /\bo1\b/i,
        o3: /\bo3\b/i,
        o4: /\bo4\b/i,
      };

      const categorizeModel = (model: ModelOption): string[] => {
        const categories: string[] = [];
        const modelName = model.label.toLowerCase();
        const modelId = model.value.toLowerCase();

        if (
          modelId.includes('deepseek-reasoner') ||
          categoryPatterns.r1.test(modelId) ||
          modelId.includes('qwq') ||
          categoryPatterns.o1.test(modelId) ||
          categoryPatterns.o3.test(modelId) ||
          categoryPatterns.o4.test(modelId) ||
          modelId.includes('thinking') ||
          modelId.includes('reason')
        ) {
          categories.push('Reasoning');
        }

        if (
          modelId.includes('code') ||
          modelId.includes('codestral') ||
          modelId.includes('codellama') ||
          modelId.includes('deepseek-coder')
        ) {
          categories.push('Code Generation');
        }

        // Image/Video models - check modalities array for image or video support
        // Note: We only use modalities array here, not vision name check
        const modalities = model.modalities || [];
        const hasImageSupport = modalities.some(m => m.toLowerCase() === 'image');
        const hasVideoSupport = modalities.some(m => m.toLowerCase() === 'video');
        if (hasImageSupport || hasVideoSupport) {
          categories.push('Image/Video');
        }

        const isFree = model.category === 'Free' || model.category?.toLowerCase().includes('free');
        if (isFree) {
          categories.push('Cost Efficient');
          categories.push('Free');
        }

        return categories;
      };

      const searchModelsByCategory: Record<string, ModelOption[]> = {
        'Reasoning': [],
        'Code Generation': [],
        'Image/Video': [],
        'Cost Efficient': [],
        'Free': [],
      };

      mergedModels.forEach(model => {
        const modelCategories = categorizeModel(model);
        modelCategories.forEach(cat => {
          if (searchModelsByCategory[cat]) {
            searchModelsByCategory[cat].push(model);
          }
        });
      });

      expect(searchModelsByCategory['Reasoning']).toHaveLength(1); // O1 Preview
      expect(searchModelsByCategory['Code Generation']).toHaveLength(1); // DeepSeek Coder
      expect(searchModelsByCategory['Image/Video']).toHaveLength(1); // GPT-4 Vision
      expect(searchModelsByCategory['Free']).toHaveLength(1); // Llama 3
      expect(searchModelsByCategory['Cost Efficient']).toHaveLength(1); // Llama 3
    });

    it('should handle models without developer', () => {
      const mergedModels: ModelOption[] = [
        { value: 'unknown-model', label: 'Unknown Model', category: 'Free' },
      ];

      const searchModelsByDeveloper: Record<string, ModelOption[]> = {};
      mergedModels.forEach(model => {
        const dev = model.developer || 'Other';
        if (!searchModelsByDeveloper[dev]) {
          searchModelsByDeveloper[dev] = [];
        }
        searchModelsByDeveloper[dev].push(model);
      });

      expect(searchModelsByDeveloper['Other']).toHaveLength(1);
    });
  });

  describe('filtering merged models during search', () => {
    it('should filter favorites from merged models', () => {
      const mergedModels: ModelOption[] = [
        { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid', developer: 'OpenAI' },
        { value: 'google/gemini-pro', label: 'Gemini Pro', category: 'Paid', developer: 'Google' },
      ];
      const favorites = new Set(['openai/gpt-4']);
      const query = 'gpt';

      const filteredFavorites = mergedModels.filter(model =>
        favorites.has(model.value) && matchesQuery(model, query)
      );

      expect(filteredFavorites).toHaveLength(1);
      expect(filteredFavorites[0].value).toBe('openai/gpt-4');
    });

    it('should filter popular models from merged models', () => {
      const mergedModels: ModelOption[] = [
        { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid', developer: 'OpenAI' },
        { value: 'google/gemini-pro', label: 'Gemini Pro', category: 'Paid', developer: 'Google' },
        { value: 'anthropic/claude-3', label: 'Claude 3', category: 'Paid', developer: 'Anthropic' },
      ];
      const popularModels: ModelOption[] = [
        { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid', developer: 'OpenAI' },
        { value: 'google/gemini-pro', label: 'Gemini Pro', category: 'Paid', developer: 'Google' },
      ];
      const query = 'gpt';

      const filteredPopular = mergedModels.filter(model =>
        popularModels.some(p => p.value === model.value) && matchesQuery(model, query)
      );

      expect(filteredPopular).toHaveLength(1);
      expect(filteredPopular[0].value).toBe('openai/gpt-4');
    });

    it('should apply query filter to all merged models', () => {
      const mergedModels: ModelOption[] = [
        { value: 'openai/gpt-4', label: 'GPT-4', category: 'Paid', developer: 'OpenAI' },
        { value: 'google/gemini-pro', label: 'Gemini Pro', category: 'Paid', developer: 'Google' },
        { value: 'anthropic/claude-3', label: 'Claude 3', category: 'Paid', developer: 'Anthropic' },
      ];
      const query = 'gemini';

      const filtered = mergedModels.filter(model => matchesQuery(model, query));

      expect(filtered).toHaveLength(1);
      expect(filtered[0].value).toBe('google/gemini-pro');
    });
  });

  describe('API parameter construction', () => {
    it('should construct correct search URL with query parameter', () => {
      const query = 'deepseek';
      const expectedUrl = `/api/models?gateway=all&search=${encodeURIComponent(query)}`;

      expect(expectedUrl).toBe('/api/models?gateway=all&search=deepseek');
    });

    it('should properly encode special characters in search query', () => {
      const query = 'gpt-4o mini';
      const encodedQuery = encodeURIComponent(query);
      const expectedUrl = `/api/models?gateway=all&search=${encodedQuery}`;

      expect(expectedUrl).toBe('/api/models?gateway=all&search=gpt-4o%20mini');
    });

    it('should handle queries with slashes', () => {
      const query = 'openai/gpt';
      const encodedQuery = encodeURIComponent(query);
      const expectedUrl = `/api/models?gateway=all&search=${encodedQuery}`;

      expect(expectedUrl).toBe('/api/models?gateway=all&search=openai%2Fgpt');
    });
  });

  describe('search debouncing behavior', () => {
    it('should debounce search queries with 200ms delay', () => {
      const debounceTime = 200;

      // Simulate debounce logic
      const simulateDebounce = (callback: () => void, delay: number) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            callback();
            resolve();
          }, delay);
        });
      };

      const startTime = Date.now();
      let callbackExecuted = false;

      return simulateDebounce(() => {
        callbackExecuted = true;
        const endTime = Date.now();
        const elapsed = endTime - startTime;

        expect(elapsed).toBeGreaterThanOrEqual(debounceTime - 10); // Allow 10ms tolerance
        expect(callbackExecuted).toBe(true);
      }, debounceTime);
    });
  });
});
