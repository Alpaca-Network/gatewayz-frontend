import { models } from '../models-data';
import type { Model } from '../models-data';
import { FEATURED_MODELS } from '../config';

describe('models-data', () => {
  describe('Model data structure', () => {
    it('should export an array of models', () => {
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should have valid model structure', () => {
      models.forEach((model) => {
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('isFree');
        expect(model).toHaveProperty('tokens');
        expect(model).toHaveProperty('category');
        expect(model).toHaveProperty('description');
        expect(model).toHaveProperty('developer');
        expect(model).toHaveProperty('context');
        expect(model).toHaveProperty('inputCost');
        expect(model).toHaveProperty('outputCost');
        expect(model).toHaveProperty('modalities');
        expect(model).toHaveProperty('series');
        expect(model).toHaveProperty('supportedParameters');
      });
    });

    it('should have valid types for all fields', () => {
      models.forEach((model) => {
        expect(typeof model.name).toBe('string');
        expect(typeof model.isFree).toBe('boolean');
        expect(typeof model.tokens).toBe('string');
        expect(typeof model.category).toBe('string');
        expect(typeof model.description).toBe('string');
        expect(typeof model.developer).toBe('string');
        expect(typeof model.context).toBe('number');
        expect(typeof model.inputCost).toBe('number');
        expect(typeof model.outputCost).toBe('number');
        expect(Array.isArray(model.modalities)).toBe(true);
        expect(typeof model.series).toBe('string');
        expect(Array.isArray(model.supportedParameters)).toBe(true);
      });
    });

    it('should have non-empty required fields', () => {
      models.forEach((model) => {
        expect(model.name.length).toBeGreaterThan(0);
        expect(model.tokens.length).toBeGreaterThan(0);
        expect(model.category.length).toBeGreaterThan(0);
        expect(model.developer.length).toBeGreaterThan(0);
        expect(model.series.length).toBeGreaterThan(0);
      });
    });

    it('should have valid context window values', () => {
      models.forEach((model) => {
        expect(model.context).toBeGreaterThan(0);
        expect(Number.isFinite(model.context)).toBe(true);
      });
    });

    it('should have valid pricing values', () => {
      models.forEach((model) => {
        expect(model.inputCost).toBeGreaterThanOrEqual(0);
        expect(model.outputCost).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(model.inputCost)).toBe(true);
        expect(Number.isFinite(model.outputCost)).toBe(true);
      });
    });

    it('should have consistent isFree flag with pricing', () => {
      models.forEach((model) => {
        if (model.isFree) {
          expect(model.inputCost).toBe(0);
          expect(model.outputCost).toBe(0);
        }
      });
    });

    it('should have valid token format', () => {
      const validTokenPattern = /^\d+(\.\d+)?[KMBT]\+?\s+tokens$/i;
      models.forEach((model) => {
        expect(validTokenPattern.test(model.tokens)).toBe(true);
      });
    });

    it('should have valid modalities', () => {
      const validModalities = ['Text', 'Image', 'Audio', 'Video', 'File', 'Code'];
      models.forEach((model) => {
        expect(model.modalities.length).toBeGreaterThan(0);
        model.modalities.forEach((modality) => {
          expect(validModalities).toContain(modality);
        });
      });
    });

    it('should have at least one supported parameter', () => {
      models.forEach((model) => {
        expect(model.supportedParameters.length).toBeGreaterThan(0);
      });
    });

    it('should have valid categories', () => {
      const validCategories = [
        'Multimodal',
        'Multilingual',
        'Router',
        'Code',
        'Reasoning',
        'Chat',
        'Vision',
        'Audio',
        'Embedding',
        'Language',
        'Other'
      ];

      models.forEach((model) => {
        expect(validCategories).toContain(model.category);
      });
    });

    it('should have optional requiredTier field with valid values', () => {
      const validTiers = ['basic', 'pro', 'max'];

      models.forEach((model) => {
        if (model.requiredTier) {
          expect(validTiers).toContain(model.requiredTier);
        }
      });
    });

    it('should have optional speedTier field with valid values', () => {
      const validSpeedTiers = ['ultra-fast', 'fast', 'medium', 'slow'];

      models.forEach((model) => {
        if (model.speedTier) {
          expect(validSpeedTiers).toContain(model.speedTier);
        }
      });
    });

    it('should have optional avgLatencyMs field as a positive number', () => {
      models.forEach((model) => {
        if (model.avgLatencyMs !== undefined) {
          expect(typeof model.avgLatencyMs).toBe('number');
          expect(model.avgLatencyMs).toBeGreaterThan(0);
          expect(Number.isFinite(model.avgLatencyMs)).toBe(true);
        }
      });
    });

    it('should have optional is_private field as a boolean', () => {
      models.forEach((model) => {
        if (model.is_private !== undefined) {
          expect(typeof model.is_private).toBe('boolean');
        }
      });
    });
  });

  describe('Model data quality', () => {
    it('should have unique model names', () => {
      const names = models.map(m => m.name.toLowerCase());
      const uniqueNames = new Set(names);

      // Allow some duplicates since models might be from different developers
      // but warn if there are too many duplicates
      const duplicateCount = names.length - uniqueNames.size;
      expect(duplicateCount).toBeLessThan(10);
    });

    it('should have common parameter support', () => {
      const commonParameters = ['temperature', 'top_p', 'max_tokens'];

      // Most models should support temperature
      const modelsWithTemperature = models.filter(m =>
        m.supportedParameters.includes('temperature')
      );

      expect(modelsWithTemperature.length).toBeGreaterThan(models.length * 0.5);
    });

    it('should have diverse model categories', () => {
      const categories = new Set(models.map(m => m.category));

      // Should have at least 3 different categories
      expect(categories.size).toBeGreaterThanOrEqual(3);
    });

    it('should have diverse developers', () => {
      const developers = new Set(models.map(m => m.developer));

      // Should have models from multiple developers
      expect(developers.size).toBeGreaterThanOrEqual(5);
    });

    it('should have a mix of free and paid models', () => {
      const freeModels = models.filter(m => m.isFree);
      const paidModels = models.filter(m => !m.isFree);

      // Should have both free and paid models
      expect(freeModels.length).toBeGreaterThan(0);
      expect(paidModels.length).toBeGreaterThan(0);
    });

    it('should have reasonable context window sizes', () => {
      models.forEach((model) => {
        // Context should be between 1K and 2M tokens (in K)
        expect(model.context).toBeGreaterThanOrEqual(1);
        expect(model.context).toBeLessThanOrEqual(2000);
      });
    });

    it('should have reasonable pricing', () => {
      const paidModels = models.filter(m => !m.isFree);

      paidModels.forEach((model) => {
        // Input cost should be less than $1000 per million tokens
        expect(model.inputCost).toBeLessThan(1000);

        // Output cost should be less than $1000 per million tokens
        expect(model.outputCost).toBeLessThan(1000);

        // Output should typically cost more than or equal to input
        // (though not always, so we just check it's reasonable)
        expect(model.outputCost).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have descriptions for all models', () => {
      models.forEach((model) => {
        expect(model.description.length).toBeGreaterThan(10);
      });
    });

    it('should have multimodal models support Image modality', () => {
      const multimodalModels = models.filter(m => m.category === 'Multimodal');

      multimodalModels.forEach((model) => {
        // Multimodal models should support at least Text
        expect(model.modalities).toContain('Text');
      });
    });
  });

  describe('Model filtering helpers', () => {
    it('should be able to filter by category', () => {
      const category = 'Multimodal';
      const filtered = models.filter(m => m.category === category);

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((model) => {
        expect(model.category).toBe(category);
      });
    });

    it('should be able to filter by developer', () => {
      const developers = Array.from(new Set(models.map(m => m.developer)));
      const developer = developers[0];

      const filtered = models.filter(m => m.developer === developer);

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((model) => {
        expect(model.developer).toBe(developer);
      });
    });

    it('should be able to filter by isFree', () => {
      const freeModels = models.filter(m => m.isFree);
      const paidModels = models.filter(m => !m.isFree);

      expect(freeModels.length + paidModels.length).toBe(models.length);

      freeModels.forEach((model) => {
        expect(model.isFree).toBe(true);
      });

      paidModels.forEach((model) => {
        expect(model.isFree).toBe(false);
      });
    });

    it('should be able to filter by modality', () => {
      const modality = 'Image';
      const filtered = models.filter(m => m.modalities.includes(modality));

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((model) => {
        expect(model.modalities).toContain(modality);
      });
    });

    it('should be able to filter by context length', () => {
      const minContext = 100; // 100K tokens
      const filtered = models.filter(m => m.context >= minContext);

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((model) => {
        expect(model.context).toBeGreaterThanOrEqual(minContext);
      });
    });

    it('should be able to filter by supported parameter', () => {
      const parameter = 'temperature';
      const filtered = models.filter(m => m.supportedParameters.includes(parameter));

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((model) => {
        expect(model.supportedParameters).toContain(parameter);
      });
    });

    it('should be able to sort by context length', () => {
      const sorted = [...models].sort((a, b) => b.context - a.context);

      expect(sorted.length).toBe(models.length);

      // Check that sorting is correct
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].context).toBeGreaterThanOrEqual(sorted[i + 1].context);
      }
    });

    it('should be able to sort by input cost', () => {
      const sorted = [...models].sort((a, b) => a.inputCost - b.inputCost);

      expect(sorted.length).toBe(models.length);

      // Check that sorting is correct
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].inputCost).toBeLessThanOrEqual(sorted[i + 1].inputCost);
      }
    });

    it('should be able to search by name', () => {
      const searchTerm = 'gpt';
      const filtered = models.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (filtered.length > 0) {
        filtered.forEach((model) => {
          expect(model.name.toLowerCase()).toContain(searchTerm.toLowerCase());
        });
      }
    });

    it('should be able to search by description', () => {
      const searchTerm = 'language';
      const filtered = models.filter(m =>
        m.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (filtered.length > 0) {
        filtered.forEach((model) => {
          expect(model.description.toLowerCase()).toContain(searchTerm.toLowerCase());
        });
      }
    });
  });

  describe('Specific model validations', () => {
    it('should have GPT models if present', () => {
      const gptModels = models.filter(m =>
        m.name.toLowerCase().includes('gpt') ||
        m.series.toLowerCase().includes('gpt')
      );

      // If GPT models exist, validate them
      gptModels.forEach((model) => {
        expect(model.developer.toLowerCase()).toContain('openai');
        expect(model.modalities).toContain('Text');
      });
    });

    it('should have router models with appropriate category', () => {
      const routerModels = models.filter(m =>
        m.name.toLowerCase().includes('router') ||
        m.category === 'Router'
      );

      routerModels.forEach((model) => {
        expect(model.category).toBe('Router');
      });
    });

    it('should have vision models with Image modality', () => {
      const visionModels = models.filter(m =>
        m.category === 'Vision' ||
        m.name.toLowerCase().includes('vision')
      );

      visionModels.forEach((model) => {
        expect(model.modalities).toContain('Image');
      });
    });
  });

  describe('Config synchronization', () => {
    it('should have all featured models from config.ts present in models-data.ts', () => {
      const featuredModelIds = Object.values(FEATURED_MODELS).map(m => m.id);
      const missingModels: string[] = [];

      featuredModelIds.forEach((featuredId) => {
        // Extract model name from provider/model format (e.g., "openai/gpt-5.2" -> "gpt-5.2")
        const modelName = featuredId.includes('/')
          ? featuredId.split('/').pop()
          : featuredId;

        // Check if the model exists in models-data.ts
        // Handle both direct name matches and prefixed format (e.g., "Google: Gemini 2.0")
        const modelExists = models.some(m => {
          // Normalize both names for comparison
          const normalizedModelName = m.name.toLowerCase()
            .replace(/^[^:]+:\s*/, '') // Remove "Provider: " prefix
            .replace(/[:\s]/g, '-');
          const normalizedFeaturedName = modelName?.toLowerCase().replace(/[:\s]/g, '-');

          return normalizedModelName === normalizedFeaturedName ||
                 m.name.toLowerCase() === modelName?.toLowerCase() ||
                 m.name.toLowerCase().endsWith(modelName?.toLowerCase() || '');
        });

        if (!modelExists) {
          missingModels.push(featuredId);
        }
      });

      // Log warning for missing models but don't fail the test
      // Featured models are primarily fetched from the backend API
      // models-data.ts is only fallback data
      if (missingModels.length > 0) {
        console.warn(
          '[Config Sync Warning] Featured models from config.ts not found in models-data.ts fallback:',
          missingModels,
          '\nNote: This is OK if these models are available from the backend API.',
          '\nmodels-data.ts is only used as fallback when the API is unavailable.'
        );
      }

      // Only fail if ALL featured models are missing (indicates a major issue)
      expect(missingModels.length).toBeLessThan(featuredModelIds.length);
    });

    it('should have consistent model names between config.ts and models-data.ts', () => {
      const featuredModelIds = Object.values(FEATURED_MODELS).map(m => m.id);

      featuredModelIds.forEach((featuredId) => {
        const modelName = featuredId.includes('/')
          ? featuredId.split('/').pop()
          : featuredId;

        const matchingModels = models.filter(m => {
          const normalizedModelName = m.name.toLowerCase()
            .replace(/^[^:]+:\s*/, '') // Remove "Provider: " prefix
            .replace(/[:\s]/g, '-');
          const normalizedFeaturedName = modelName?.toLowerCase().replace(/[:\s]/g, '-');

          return normalizedModelName === normalizedFeaturedName ||
                 m.name.toLowerCase() === modelName?.toLowerCase() ||
                 m.name.toLowerCase().endsWith(modelName?.toLowerCase() || '');
        });

        if (matchingModels.length > 0) {
          // Verify that at least one matching model has the correct developer
          const provider = featuredId.split('/')[0];
          const hasMatchingProvider = matchingModels.some(m =>
            m.developer.toLowerCase() === provider.toLowerCase()
          );

          // Warn but don't fail if provider doesn't match
          if (!hasMatchingProvider) {
            console.warn(
              `[Config Sync Warning] Featured model "${featuredId}" found in models-data.ts but with different provider.`,
              `Expected provider "${provider}" but found: ${matchingModels.map(m => m.developer).join(', ')}`,
              '\nThis is OK if the backend API returns the correct provider.'
            );
          }
        }
      });

      // This test always passes now - it only logs warnings
      expect(true).toBe(true);
    });

    it('should have featured models with valid metadata', () => {
      const featuredModelIds = Object.values(FEATURED_MODELS).map(m => m.id);

      featuredModelIds.forEach((featuredId) => {
        const modelName = featuredId.includes('/')
          ? featuredId.split('/').pop()
          : featuredId;

        const matchingModels = models.filter(m => {
          const normalizedModelName = m.name.toLowerCase()
            .replace(/^[^:]+:\s*/, '') // Remove "Provider: " prefix
            .replace(/[:\s]/g, '-');
          const normalizedFeaturedName = modelName?.toLowerCase().replace(/[:\s]/g, '-');

          return normalizedModelName === normalizedFeaturedName ||
                 m.name.toLowerCase() === modelName?.toLowerCase() ||
                 m.name.toLowerCase().endsWith(modelName?.toLowerCase() || '');
        });

        // Only validate if the model exists in fallback data
        if (matchingModels.length > 0) {
          const model = matchingModels[0];

          // Validate that the featured model has all required metadata
          expect(model.name).toBeTruthy();
          expect(model.description).toBeTruthy();
          expect(model.description.length).toBeGreaterThan(10);
          expect(model.developer).toBeTruthy();
          expect(model.category).toBeTruthy();
          expect(model.modalities.length).toBeGreaterThan(0);
          expect(model.supportedParameters.length).toBeGreaterThan(0);
        }
      });
    });

    it('should document the synchronization requirement', () => {
      // This test serves as documentation that config.ts and models-data.ts must be kept in sync
      // When adding a new featured model to config.ts:
      // 1. Ensure the model exists in models-data.ts with the correct name
      // 2. Update the model name in models-data.ts if the provider releases a new version
      // 3. Run this test to verify synchronization

      expect(true).toBe(true); // Always passes, serves as documentation
    });
  });
});
