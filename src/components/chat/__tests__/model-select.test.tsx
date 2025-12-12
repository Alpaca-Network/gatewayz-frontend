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

  describe('ModelOption type', () => {
    it('should support all expected properties', () => {
      const testModel: ModelOption = {
        value: 'openai/gpt-4',
        label: 'GPT-4',
        category: 'Paid',
        sourceGateway: 'openrouter',
        developer: 'OpenAI',
        modalities: ['Text', 'Image'],
        speedTier: 'fast',
        avgLatencyMs: 500,
        huggingfaceMetrics: {
          downloads: 1000,
          likes: 500,
        },
      };

      expect(testModel.value).toBe('openai/gpt-4');
      expect(testModel.label).toBe('GPT-4');
      expect(testModel.category).toBe('Paid');
      expect(testModel.developer).toBe('OpenAI');
      expect(testModel.speedTier).toBe('fast');
    });

    it('should work with minimal required properties', () => {
      const minimalModel: ModelOption = {
        value: 'test/model',
        label: 'Test Model',
        category: 'Free',
      };

      expect(minimalModel.value).toBe('test/model');
      expect(minimalModel.developer).toBeUndefined();
      expect(minimalModel.speedTier).toBeUndefined();
    });
  });
});
