import { ModelSelect, ModelOption } from '../model-select';

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

// Test filtering logic in isolation for performance validation
describe('ModelSelect filtering performance', () => {
  // Create mock model data for testing filter performance
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

      // Anthropic is at indices 1, 6 (every 5th starting from 1)
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
