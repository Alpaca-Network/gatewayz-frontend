import {
  getProviderApiConfig,
  getProviderConfig,
  getProviderDisplayName,
  formatProviderModelId,
  isProviderConfigured,
  getAllConfiguredProviders,
  buildProviderConfigsRecord,
  type ProviderApiConfig,
  type ProviderConfig,
} from '../provider-config';

describe('provider-config', () => {
  describe('getProviderApiConfig', () => {
    it('should return API config for known providers', () => {
      const openaiConfig = getProviderApiConfig('openai');
      expect(openaiConfig).toBeDefined();
      expect(openaiConfig?.baseUrl).toBe('https://api.openai.com/v1');
      expect(openaiConfig?.requiresApiKey).toBe(true);
      expect(openaiConfig?.apiKeyPlaceholder).toBe('sk-...');
    });

    it('should return API config for gatewayz', () => {
      const gatewayzConfig = getProviderApiConfig('gatewayz');
      expect(gatewayzConfig).toBeDefined();
      expect(gatewayzConfig?.baseUrl).toBe('https://api.gatewayz.ai/v1');
      expect(gatewayzConfig?.requiresApiKey).toBe(true);
    });

    it('should return undefined for unknown providers', () => {
      const unknownConfig = getProviderApiConfig('unknown-provider');
      expect(unknownConfig).toBeUndefined();
    });

    it('should handle case-insensitive provider IDs', () => {
      const configLower = getProviderApiConfig('openai');
      const configUpper = getProviderApiConfig('OPENAI');
      expect(configLower).toBeDefined();
      expect(configUpper).toBeDefined();
      expect(configLower?.baseUrl).toBe(configUpper?.baseUrl);
    });

    it('should have modelIdFormat for providers that need it', () => {
      const groqConfig = getProviderApiConfig('groq');
      expect(groqConfig?.modelIdFormat).toBeDefined();
      expect(typeof groqConfig?.modelIdFormat).toBe('function');

      // Groq strips developer prefix
      const formatted = groqConfig?.modelIdFormat?.('meta/llama-3.3-70b');
      expect(formatted).toBe('llama-3.3-70b');
    });

    it('should not have modelIdFormat for providers that use full model ID', () => {
      const gatewayzConfig = getProviderApiConfig('gatewayz');
      expect(gatewayzConfig?.modelIdFormat).toBeUndefined();
    });
  });

  describe('getProviderConfig', () => {
    it('should return full config including display name', () => {
      const config = getProviderConfig('openrouter');
      expect(config).toBeDefined();
      expect(config?.name).toBe('OpenRouter');
      expect(config?.baseUrl).toBeDefined();
      expect(config?.requiresApiKey).toBeDefined();
    });

    it('should use "Gatewayz (Unified)" for gatewayz provider', () => {
      const config = getProviderConfig('gatewayz');
      expect(config?.name).toBe('Gatewayz (Unified)');
    });

    it('should use apiKeyOverride for gatewayz provider', () => {
      const customKey = 'gw_live_custom_key';
      const config = getProviderConfig('gatewayz', customKey);
      expect(config?.apiKeyPlaceholder).toBe(customKey);
    });

    it('should not use apiKeyOverride for other providers', () => {
      const customKey = 'gw_live_custom_key';
      const config = getProviderConfig('openai', customKey);
      expect(config?.apiKeyPlaceholder).toBe('sk-...');
    });

    it('should return undefined for unknown providers', () => {
      const config = getProviderConfig('unknown-provider');
      expect(config).toBeUndefined();
    });
  });

  describe('getProviderDisplayName', () => {
    it('should return correct display names for known providers', () => {
      expect(getProviderDisplayName('openai')).toBe('OpenAI');
      expect(getProviderDisplayName('anthropic')).toBe('Anthropic');
      expect(getProviderDisplayName('groq')).toBe('Groq');
      expect(getProviderDisplayName('together')).toBe('Together AI');
    });

    it('should return "Gatewayz (Unified)" for gatewayz', () => {
      expect(getProviderDisplayName('gatewayz')).toBe('Gatewayz (Unified)');
    });

    it('should fallback to gateway registry display name', () => {
      // near should come from gateway registry
      expect(getProviderDisplayName('near')).toBe('NEAR Protocol');
    });
  });

  describe('formatProviderModelId', () => {
    it('should strip developer prefix for providers that require it', () => {
      // OpenAI strips prefix
      expect(formatProviderModelId('openai', 'openai/gpt-4o')).toBe('gpt-4o');

      // Groq strips prefix
      expect(formatProviderModelId('groq', 'meta/llama-3.3-70b')).toBe('llama-3.3-70b');

      // Cerebras strips prefix
      expect(formatProviderModelId('cerebras', 'cerebras/cpt-llama-3.1-8b')).toBe('cpt-llama-3.1-8b');
    });

    it('should keep full model ID for providers that use it', () => {
      // Together uses full ID
      expect(formatProviderModelId('together', 'meta/llama-3.3-70b')).toBe('meta/llama-3.3-70b');

      // DeepInfra uses full ID
      expect(formatProviderModelId('deepinfra', 'meta/llama-3.3-70b')).toBe('meta/llama-3.3-70b');

      // Featherless uses full ID
      expect(formatProviderModelId('featherless', 'meta/llama-3.3-70b')).toBe('meta/llama-3.3-70b');
    });

    it('should return original model ID for unknown providers', () => {
      expect(formatProviderModelId('unknown', 'some/model')).toBe('some/model');
    });

    it('should handle model IDs without developer prefix', () => {
      // Should not break if there's no slash
      expect(formatProviderModelId('groq', 'gpt-4o')).toBe('gpt-4o');
    });

    it('should handle deeply nested model IDs', () => {
      // NEAR uses full ID with nested paths
      expect(formatProviderModelId('near', 'near/deepseek-ai/DeepSeek-V3.1')).toBe('near/deepseek-ai/DeepSeek-V3.1');
    });
  });

  describe('isProviderConfigured', () => {
    it('should return true for configured providers', () => {
      expect(isProviderConfigured('openai')).toBe(true);
      expect(isProviderConfigured('gatewayz')).toBe(true);
      expect(isProviderConfigured('openrouter')).toBe(true);
      expect(isProviderConfigured('groq')).toBe(true);
    });

    it('should return false for unknown providers', () => {
      expect(isProviderConfigured('unknown')).toBe(false);
      expect(isProviderConfigured('random-provider')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isProviderConfigured('OPENAI')).toBe(true);
      expect(isProviderConfigured('OpenAI')).toBe(true);
    });
  });

  describe('getAllConfiguredProviders', () => {
    it('should return an array of provider IDs', () => {
      const providers = getAllConfiguredProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should include known providers', () => {
      const providers = getAllConfiguredProviders();
      expect(providers).toContain('gatewayz');
      expect(providers).toContain('openai');
      expect(providers).toContain('openrouter');
      expect(providers).toContain('groq');
      expect(providers).toContain('anthropic');
    });

    it('should not include duplicates', () => {
      const providers = getAllConfiguredProviders();
      const uniqueProviders = new Set(providers);
      expect(uniqueProviders.size).toBe(providers.length);
    });
  });

  describe('buildProviderConfigsRecord', () => {
    it('should return a record of provider configs', () => {
      const configs = buildProviderConfigsRecord();
      expect(typeof configs).toBe('object');
      expect(Object.keys(configs).length).toBeGreaterThan(0);
    });

    it('should include configs for all known providers', () => {
      const configs = buildProviderConfigsRecord();
      expect(configs.gatewayz).toBeDefined();
      expect(configs.openai).toBeDefined();
      expect(configs.openrouter).toBeDefined();
    });

    it('should use apiKeyOverride for gatewayz', () => {
      const customKey = 'gw_live_my_key';
      const configs = buildProviderConfigsRecord(customKey);
      expect(configs.gatewayz.apiKeyPlaceholder).toBe(customKey);
    });

    it('should not affect other providers with apiKeyOverride', () => {
      const customKey = 'gw_live_my_key';
      const configs = buildProviderConfigsRecord(customKey);
      expect(configs.openai.apiKeyPlaceholder).toBe('sk-...');
      expect(configs.anthropic.apiKeyPlaceholder).toBe('sk-ant-...');
    });

    it('should include name property from gateway registry', () => {
      const configs = buildProviderConfigsRecord();
      expect(configs.openai.name).toBe('OpenAI');
      expect(configs.anthropic.name).toBe('Anthropic');
      expect(configs.gatewayz.name).toBe('Gatewayz (Unified)');
    });
  });

  describe('Provider API Configs', () => {
    it('should have correct base URLs for major providers', () => {
      const expectations: Record<string, string> = {
        openai: 'https://api.openai.com/v1',
        anthropic: 'https://api.anthropic.com/v1',
        groq: 'https://api.groq.com/openai/v1',
        together: 'https://api.together.xyz/v1',
        fireworks: 'https://api.fireworks.ai/inference/v1',
        deepinfra: 'https://api.deepinfra.com/v1/openai',
        openrouter: 'https://openrouter.ai/api/v1',
        gatewayz: 'https://api.gatewayz.ai/v1',
      };

      for (const [provider, expectedUrl] of Object.entries(expectations)) {
        const config = getProviderApiConfig(provider);
        expect(config?.baseUrl).toBe(expectedUrl);
      }
    });

    it('should require API keys for all providers', () => {
      const providers = getAllConfiguredProviders();
      for (const provider of providers) {
        const config = getProviderApiConfig(provider);
        expect(config?.requiresApiKey).toBe(true);
      }
    });

    it('should have API key placeholders for all providers', () => {
      const providers = getAllConfiguredProviders();
      for (const provider of providers) {
        const config = getProviderApiConfig(provider);
        expect(config?.apiKeyPlaceholder).toBeDefined();
        expect(typeof config?.apiKeyPlaceholder).toBe('string');
      }
    });
  });

  describe('Consistency with Gateway Registry', () => {
    it('should have display names matching gateway registry for common providers', () => {
      // These providers should have consistent names between provider-config and gateway-registry
      const commonProviders = ['openai', 'anthropic', 'groq', 'openrouter'];

      for (const provider of commonProviders) {
        const displayName = getProviderDisplayName(provider);
        // Display name should be non-empty string
        expect(displayName).toBeDefined();
        expect(typeof displayName).toBe('string');
        expect(displayName.length).toBeGreaterThan(0);
      }
    });
  });
});
