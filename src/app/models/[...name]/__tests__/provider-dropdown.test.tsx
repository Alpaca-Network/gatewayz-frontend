/**
 * Tests for Model Detail Page provider dropdown consistency
 *
 * Verifies that:
 * 1. Provider dropdown in Playground tab uses centralized configurations
 * 2. Provider cards in Providers tab use centralized configurations
 * 3. Display names and logos are consistent between the two views
 */

import {
  getGatewayDisplayName,
  getGatewayLogo,
  getGatewayLogoWithFallback,
  DEFAULT_GATEWAY_LOGO,
  GATEWAY_CONFIG,
} from '@/lib/gateway-registry';
import {
  buildProviderConfigsRecord,
  getProviderDisplayName,
  isProviderConfigured,
} from '@/lib/provider-config';

describe('Model Detail Page - Provider Dropdown Consistency', () => {
  describe('Provider Display Names', () => {
    it('should have consistent display names between providerConfigs and gateway registry', () => {
      const providerConfigs = buildProviderConfigsRecord();

      // For each provider in providerConfigs, verify name matches gateway registry
      // (except for gatewayz which has a special display name)
      const providersToCheck = Object.keys(providerConfigs).filter(p => p !== 'gatewayz');

      for (const provider of providersToCheck) {
        const configName = providerConfigs[provider].name;
        const registryName = getGatewayDisplayName(provider);

        expect(configName).toBe(registryName);
      }
    });

    it('should display "Gatewayz (Unified)" for gatewayz provider', () => {
      const providerConfigs = buildProviderConfigsRecord();
      expect(providerConfigs.gatewayz.name).toBe('Gatewayz (Unified)');
      expect(getProviderDisplayName('gatewayz')).toBe('Gatewayz (Unified)');
    });

    it('should have display names for all common providers', () => {
      const commonProviders = [
        'openai',
        'anthropic',
        'openrouter',
        'groq',
        'together',
        'fireworks',
        'deepinfra',
        'cerebras',
        'near',
        'huggingface',
      ];

      for (const provider of commonProviders) {
        const displayName = getGatewayDisplayName(provider);
        expect(displayName).toBeDefined();
        expect(typeof displayName).toBe('string');
        expect(displayName.length).toBeGreaterThan(0);
        // Should not just return the raw ID for known providers
        expect(displayName).not.toBe(provider);
      }
    });
  });

  describe('Provider Logos', () => {
    it('should have logo paths for all common providers', () => {
      const commonProviders = [
        'openai',
        'anthropic',
        'openrouter',
        'groq',
        'together',
        'fireworks',
        'deepinfra',
        'cerebras',
        'near',
        'huggingface',
      ];

      for (const provider of commonProviders) {
        const logo = getGatewayLogo(provider);
        expect(logo).toBeDefined();
        expect(typeof logo).toBe('string');
        expect(logo).toMatch(/\.svg$/);
      }
    });

    it('should return default logo for unknown providers', () => {
      const unknownLogo = getGatewayLogoWithFallback('unknown-provider');
      expect(unknownLogo).toBe(DEFAULT_GATEWAY_LOGO);
    });

    it('should include logos in GATEWAY_CONFIG', () => {
      // Verify that GATEWAY_CONFIG includes logo property
      expect(GATEWAY_CONFIG.openrouter.logo).toBeDefined();
      expect(GATEWAY_CONFIG.groq.logo).toBeDefined();
      expect(GATEWAY_CONFIG.openai.logo).toBeDefined();
    });
  });

  describe('Provider Configuration Completeness', () => {
    it('should have all providers from gateway registry configured in provider-config', () => {
      // List of providers that should be in both registries
      const expectedProviders = [
        'openai',
        'anthropic',
        'openrouter',
        'groq',
        'together',
        'fireworks',
        'deepinfra',
        'google',
        'cerebras',
        'near',
        'huggingface',
        'nebius',
        'featherless',
        'chutes',
        'novita',
        'aimo',
        'fal',
        'alibaba',
        'xai',
      ];

      for (const provider of expectedProviders) {
        expect(isProviderConfigured(provider)).toBe(true);
      }
    });

    it('should have gatewayz as a special provider', () => {
      // Gatewayz is in provider-config but not in gateway-registry (it's the unified platform)
      expect(isProviderConfigured('gatewayz')).toBe(true);
    });
  });

  describe('Playground Dropdown Options', () => {
    it('should have providerConfigs for all providers that appear in dropdown', () => {
      // Simulate the providers that might appear in modelProviders
      const sampleModelProviders = ['openrouter', 'groq', 'together', 'fireworks'];

      const providerConfigs = buildProviderConfigsRecord();

      for (const provider of sampleModelProviders) {
        const config = providerConfigs[provider];
        expect(config).toBeDefined();
        expect(config.name).toBeDefined();
        expect(config.baseUrl).toBeDefined();
      }
    });

    it('should always include gatewayz as first option', () => {
      const providerConfigs = buildProviderConfigsRecord();

      // Gatewayz should always be available
      expect(providerConfigs.gatewayz).toBeDefined();
      expect(providerConfigs.gatewayz.name).toBe('Gatewayz (Unified)');
    });

    it('should use custom API key for gatewayz when provided', () => {
      const customApiKey = 'gw_live_test_key_123';
      const providerConfigs = buildProviderConfigsRecord(customApiKey);

      expect(providerConfigs.gatewayz.apiKeyPlaceholder).toBe(customApiKey);
      // Other providers should not be affected
      expect(providerConfigs.openai.apiKeyPlaceholder).not.toBe(customApiKey);
    });
  });

  describe('Providers Tab Cards', () => {
    it('should use gateway registry for display names', () => {
      // Simulate rendering provider cards
      const modelProviders = ['openrouter', 'groq', 'together'];

      for (const provider of modelProviders) {
        const displayName = getGatewayDisplayName(provider);
        expect(displayName).toBeDefined();
        expect(displayName).not.toBe(provider); // Should have human-readable name
      }
    });

    it('should use gateway registry for logos with fallback', () => {
      // Simulate rendering provider cards
      const modelProviders = ['openrouter', 'groq', 'unknown-provider'];

      for (const provider of modelProviders) {
        const logoPath = getGatewayLogoWithFallback(provider);
        expect(logoPath).toBeDefined();
        expect(typeof logoPath).toBe('string');
        expect(logoPath.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Consistency Between Tabs', () => {
    it('should display same name in Playground dropdown and Providers tab', () => {
      const testProviders = ['openrouter', 'groq', 'together', 'fireworks'];

      const providerConfigs = buildProviderConfigsRecord();

      for (const provider of testProviders) {
        // Playground dropdown uses providerConfigs[provider].name
        const playgroundName = providerConfigs[provider].name;

        // Providers tab now uses getGatewayDisplayName
        const providersTabName = getGatewayDisplayName(provider);

        expect(playgroundName).toBe(providersTabName);
      }
    });

    it('should handle providers that exist in modelProviders but not in providerConfigs', () => {
      // If a new provider appears that's not in our static configs,
      // we should gracefully handle it
      const unknownProvider = 'brand-new-provider';

      // getGatewayDisplayName should return the ID as fallback
      const displayName = getGatewayDisplayName(unknownProvider);
      expect(displayName).toBe(unknownProvider);

      // getGatewayLogoWithFallback should return default logo
      const logo = getGatewayLogoWithFallback(unknownProvider);
      expect(logo).toBe(DEFAULT_GATEWAY_LOGO);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty modelProviders array', () => {
      const providerConfigs = buildProviderConfigsRecord();
      const modelProviders: string[] = [];

      // Even with empty providers, gatewayz should be available
      expect(providerConfigs.gatewayz).toBeDefined();
      expect(modelProviders.length).toBe(0);
    });

    it('should handle provider aliases', () => {
      // 'hug' is an alias for 'huggingface'
      const hugDisplayName = getGatewayDisplayName('hug');
      const huggingfaceDisplayName = getGatewayDisplayName('huggingface');

      expect(hugDisplayName).toBe(huggingfaceDisplayName);

      // 'google' is an alias for 'google-vertex'
      const googleDisplayName = getGatewayDisplayName('google');
      const googleVertexDisplayName = getGatewayDisplayName('google-vertex');

      expect(googleDisplayName).toBe(googleVertexDisplayName);
    });

    it('should handle case-insensitive provider IDs', () => {
      const lowercase = getGatewayDisplayName('openrouter');
      const uppercase = getGatewayDisplayName('OPENROUTER');
      const mixedCase = getGatewayDisplayName('OpenRouter');

      expect(lowercase).toBe(uppercase);
      expect(lowercase).toBe(mixedCase);
    });
  });
});
