import {
  isValidGateway,
  validateGateways,
  getFallbackGateway,
  ensureValidGateways,
  validateModelProviderInfo,
  getModelGateways,
  sanitizeGatewayInput,
} from '../gateway-validation';
import { registerDynamicGateway } from '../gateway-registry';
import * as Sentry from '@sentry/nextjs';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

describe('gateway-validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear console.warn mock
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Clear console.log mock (used by registerDynamicGateway)
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isValidGateway', () => {
    it('should return true for known gateways from registry', () => {
      expect(isValidGateway('openai')).toBe(true);
      expect(isValidGateway('anthropic')).toBe(true);
      expect(isValidGateway('openrouter')).toBe(true);
      expect(isValidGateway('groq')).toBe(true);
    });

    it('should return true for special gatewayz fallback gateway', () => {
      expect(isValidGateway('gatewayz')).toBe(true);
    });

    it('should return true for dynamically registered gateways', () => {
      // Register a new gateway dynamically
      registerDynamicGateway('test-dynamic-gateway-validation');

      // Should now be valid
      expect(isValidGateway('test-dynamic-gateway-validation')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isValidGateway('OpenAI')).toBe(true);
      expect(isValidGateway('ANTHROPIC')).toBe(true);
      expect(isValidGateway('OpenRouter')).toBe(true);
    });

    it('should return false for unknown gateways', () => {
      expect(isValidGateway('unknown-gateway')).toBe(false);
      expect(isValidGateway('fake-provider')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isValidGateway(null)).toBe(false);
      expect(isValidGateway(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidGateway('')).toBe(false);
    });
  });

  describe('validateGateways', () => {
    it('should filter out invalid gateways', () => {
      const input = ['openai', 'invalid-gateway', 'anthropic', 'fake-provider'];
      const result = validateGateways(input);

      expect(result).toEqual(['openai', 'anthropic']);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid-gateway')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('fake-provider')
      );
    });

    it('should return empty array for null or undefined', () => {
      expect(validateGateways(null)).toEqual([]);
      expect(validateGateways(undefined)).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
      expect(validateGateways('not-an-array' as any)).toEqual([]);
    });

    it('should log to Sentry for unknown gateways', () => {
      const input = ['openai', 'unknown-gateway'];
      validateGateways(input);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Unknown gateway encountered'),
        expect.objectContaining({
          level: 'warning',
        })
      );
    });

    it('should handle all valid gateways', () => {
      const input = ['openai', 'anthropic', 'groq', 'together', 'near'];
      const result = validateGateways(input);

      expect(result).toEqual(input);
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('getFallbackGateway', () => {
    it('should return gatewayz as fallback', () => {
      expect(getFallbackGateway()).toBe('gatewayz');
    });
  });

  describe('ensureValidGateways', () => {
    it('should return valid gateways when present', () => {
      const input = ['openai', 'anthropic'];
      const result = ensureValidGateways(input);

      expect(result).toEqual(['openai', 'anthropic']);
    });

    it('should return fallback when no valid gateways', () => {
      const input = ['invalid1', 'invalid2'];
      const result = ensureValidGateways(input);

      expect(result).toEqual(['gatewayz']);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('No valid gateways found')
      );
    });

    it('should return fallback for empty array', () => {
      const result = ensureValidGateways([]);

      expect(result).toEqual(['gatewayz']);
    });

    it('should return fallback for null', () => {
      const result = ensureValidGateways(null);

      expect(result).toEqual(['gatewayz']);
    });

    it('should filter invalid and keep valid gateways', () => {
      const input = ['openai', 'invalid', 'groq'];
      const result = ensureValidGateways(input);

      expect(result).toEqual(['openai', 'groq']);
    });
  });

  describe('validateModelProviderInfo', () => {
    it('should return true for valid model with gateway info', () => {
      const model = {
        id: 'test-model',
        name: 'Test Model',
        source_gateways: ['openai'],
      };

      expect(validateModelProviderInfo(model)).toBe(true);
    });

    it('should return true for model with single gateway', () => {
      const model = {
        id: 'test-model',
        name: 'Test Model',
        source_gateway: 'openai',
      };

      expect(validateModelProviderInfo(model)).toBe(true);
    });

    it('should return false for model without id', () => {
      const model = {
        name: 'Test Model',
        source_gateways: ['openai'],
      };

      expect(validateModelProviderInfo(model)).toBe(false);
      expect(Sentry.captureMessage).toHaveBeenCalled();
    });

    it('should return false for model without name', () => {
      const model = {
        id: 'test-model',
        source_gateways: ['openai'],
      };

      expect(validateModelProviderInfo(model)).toBe(false);
    });

    it('should return false for model without gateway info', () => {
      const model = {
        id: 'test-model',
        name: 'Test Model',
      };

      expect(validateModelProviderInfo(model)).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('has no gateway information')
      );
    });

    it('should return false for model with empty gateway array', () => {
      const model = {
        id: 'test-model',
        name: 'Test Model',
        source_gateways: [],
      };

      expect(validateModelProviderInfo(model)).toBe(false);
    });
  });

  describe('getModelGateways', () => {
    it('should extract gateways from source_gateways array', () => {
      const model = {
        source_gateways: ['openai', 'anthropic'],
      };

      const result = getModelGateways(model);

      expect(result).toEqual(['openai', 'anthropic']);
    });

    it('should extract gateway from source_gateway string', () => {
      const model = {
        source_gateway: 'openai',
      };

      const result = getModelGateways(model);

      expect(result).toEqual(['openai']);
    });

    it('should prioritize source_gateways over source_gateway', () => {
      const model = {
        source_gateways: ['anthropic', 'groq'],
        source_gateway: 'openai',
      };

      const result = getModelGateways(model);

      // Should return source_gateways
      expect(result).toEqual(['anthropic', 'groq']);
    });

    it('should filter out invalid gateways', () => {
      const model = {
        source_gateways: ['openai', 'invalid-gateway', 'anthropic'],
      };

      const result = getModelGateways(model);

      expect(result).toEqual(['openai', 'anthropic']);
    });

    it('should return empty array for model with no gateways', () => {
      const model = {};

      const result = getModelGateways(model);

      expect(result).toEqual([]);
    });

    it('should handle null source_gateways', () => {
      const model = {
        source_gateways: null,
      };

      const result = getModelGateways(model);

      expect(result).toEqual([]);
    });
  });

  describe('sanitizeGatewayInput', () => {
    it('should normalize valid gateway input', () => {
      expect(sanitizeGatewayInput('OpenAI')).toBe('openai');
      expect(sanitizeGatewayInput('  ANTHROPIC  ')).toBe('anthropic');
      expect(sanitizeGatewayInput('Groq')).toBe('groq');
    });

    it('should return null for invalid gateways', () => {
      expect(sanitizeGatewayInput('invalid-gateway')).toBe(null);
      expect(sanitizeGatewayInput('fake-provider')).toBe(null);
    });

    it('should return null for null or undefined', () => {
      expect(sanitizeGatewayInput(null)).toBe(null);
      expect(sanitizeGatewayInput(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(sanitizeGatewayInput('')).toBe(null);
      expect(sanitizeGatewayInput('   ')).toBe(null);
    });

    it('should log warning for invalid input', () => {
      sanitizeGatewayInput('invalid-gateway');

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid gateway input')
      );
    });
  });

  describe('edge cases', () => {
    it('should handle mixed case gateway arrays', () => {
      const input = ['OpenAI', 'ANTHROPIC', 'groq'];
      const result = validateGateways(input);

      expect(result).toEqual(['openai', 'anthropic', 'groq']);
    });

    it('should handle duplicate gateways in validation', () => {
      const input = ['openai', 'openai', 'anthropic'];
      const result = validateGateways(input);

      // Should keep duplicates (deduplication is not responsibility of validator)
      expect(result).toEqual(['openai', 'openai', 'anthropic']);
    });

    it('should handle gateway abbreviations', () => {
      // 'hug' is the backend abbreviation for Hugging Face
      expect(isValidGateway('hug')).toBe(true);
      expect(isValidGateway('huggingface')).toBe(true);
    });

    it('should handle very long invalid gateway names', () => {
      const longInvalid = 'a'.repeat(100);
      expect(isValidGateway(longInvalid)).toBe(false);
    });

    it('should handle special characters in gateway names', () => {
      expect(isValidGateway('gateway-with-dashes')).toBe(false);
      expect(isValidGateway('gateway_with_underscores')).toBe(false);
      expect(isValidGateway('gateway.with.dots')).toBe(false);
    });
  });

  describe('dynamic gateway integration', () => {
    it('should validate dynamically registered gateways via validateGateways', () => {
      // First, the gateway should be invalid
      const unknownGateway = 'brand-new-provider-for-validation-test';
      expect(isValidGateway(unknownGateway)).toBe(false);

      // Register it dynamically
      registerDynamicGateway(unknownGateway);

      // Now validateGateways should include it
      const input = ['openai', unknownGateway, 'anthropic'];
      const result = validateGateways(input);

      expect(result).toContain(unknownGateway);
      expect(result).toEqual(['openai', unknownGateway, 'anthropic']);
    });

    it('should allow new backend providers to be validated after dynamic registration', () => {
      // Simulates what happens when backend returns a new provider
      const newBackendProvider = 'new-backend-provider-test';

      // Before registration - should be invalid
      expect(isValidGateway(newBackendProvider)).toBe(false);

      // Simulate backend response processing which calls registerDynamicGateway
      registerDynamicGateway(newBackendProvider);

      // After registration - should be valid
      expect(isValidGateway(newBackendProvider)).toBe(true);

      // ensureValidGateways should now include it
      const result = ensureValidGateways([newBackendProvider, 'openai']);
      expect(result).toContain(newBackendProvider);
    });
  });
});
