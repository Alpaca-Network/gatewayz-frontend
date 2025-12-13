import {
  GATEWAYS,
  ACTIVE_GATEWAYS,
  ALL_GATEWAY_IDS,
  ACTIVE_GATEWAY_IDS,
  PRIORITY_GATEWAYS,
  DEFERRED_GATEWAYS,
  VALID_GATEWAYS,
  GATEWAY_BY_ID,
  GATEWAY_CONFIG,
  GATEWAYS_WITH_API_KEYS,
  GatewayConfig,
  getGatewayApiKey,
  buildGatewayHeaders,
  normalizeGatewayId,
  isValidGateway,
  getGatewayDisplayName,
  isGatewayDeprecated,
  registerDynamicGateway,
  getAllGateways,
  getAllActiveGatewayIds,
  isDynamicGateway,
  autoRegisterGatewaysFromModels,
  getDynamicGateways,
} from '../gateway-registry';

describe('gateway-registry', () => {
  // Store original env vars to restore after tests
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env for each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Static Gateway Configuration', () => {
    it('should have at least one gateway defined', () => {
      expect(GATEWAYS.length).toBeGreaterThan(0);
    });

    it('should have required fields for each gateway', () => {
      for (const gateway of GATEWAYS) {
        expect(gateway.id).toBeDefined();
        expect(typeof gateway.id).toBe('string');
        expect(gateway.id.length).toBeGreaterThan(0);

        expect(gateway.name).toBeDefined();
        expect(typeof gateway.name).toBe('string');

        expect(gateway.color).toBeDefined();
        expect(gateway.color).toMatch(/^bg-/);

        expect(gateway.priority).toBeDefined();
        expect(['fast', 'slow']).toContain(gateway.priority);
      }
    });

    it('should have unique gateway IDs', () => {
      const ids = GATEWAYS.map(g => g.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include known gateways', () => {
      const knownGateways = [
        'openrouter',
        'groq',
        'together',
        'fireworks',
        'huggingface',
        'near',
        'onerouter',
      ];

      for (const known of knownGateways) {
        expect(ALL_GATEWAY_IDS).toContain(known);
      }
    });
  });

  describe('Derived Gateway Lists', () => {
    it('should filter out deprecated gateways in ACTIVE_GATEWAYS', () => {
      const deprecatedGateways = GATEWAYS.filter(g => g.deprecated);
      const activeGatewayIds = ACTIVE_GATEWAYS.map(g => g.id);

      for (const deprecated of deprecatedGateways) {
        expect(activeGatewayIds).not.toContain(deprecated.id);
      }
    });

    it('should have ACTIVE_GATEWAY_IDS match ACTIVE_GATEWAYS', () => {
      expect(ACTIVE_GATEWAY_IDS).toEqual(ACTIVE_GATEWAYS.map(g => g.id));
    });

    it('should have PRIORITY_GATEWAYS contain only fast gateways', () => {
      for (const gatewayId of PRIORITY_GATEWAYS) {
        const gateway = GATEWAY_BY_ID[gatewayId];
        expect(gateway).toBeDefined();
        expect(gateway.priority).toBe('fast');
      }
    });

    it('should have DEFERRED_GATEWAYS contain only slow gateways', () => {
      for (const gatewayId of DEFERRED_GATEWAYS) {
        const gateway = GATEWAY_BY_ID[gatewayId];
        expect(gateway).toBeDefined();
        expect(gateway.priority).toBe('slow');
      }
    });

    it('should have VALID_GATEWAYS include all IDs plus "all"', () => {
      expect(VALID_GATEWAYS).toContain('all');
      for (const id of ALL_GATEWAY_IDS) {
        expect(VALID_GATEWAYS).toContain(id);
      }
    });

    it('should have GATEWAY_CONFIG for all gateways', () => {
      for (const gateway of GATEWAYS) {
        expect(GATEWAY_CONFIG[gateway.id]).toBeDefined();
        expect(GATEWAY_CONFIG[gateway.id].name).toBe(gateway.name);
        expect(GATEWAY_CONFIG[gateway.id].color).toBe(gateway.color);
      }
    });

    it('should include aliases in GATEWAY_BY_ID and GATEWAY_CONFIG', () => {
      // Find gateways with aliases
      const gatewaysWithAliases = GATEWAYS.filter(g => g.aliases && g.aliases.length > 0);

      for (const gateway of gatewaysWithAliases) {
        for (const alias of gateway.aliases!) {
          expect(GATEWAY_BY_ID[alias]).toBeDefined();
          expect(GATEWAY_BY_ID[alias].id).toBe(gateway.id);

          expect(GATEWAY_CONFIG[alias]).toBeDefined();
          expect(GATEWAY_CONFIG[alias].name).toBe(gateway.name);
        }
      }
    });

    it('should have huggingface with "hug" alias', () => {
      expect(GATEWAY_BY_ID['hug']).toBeDefined();
      expect(GATEWAY_BY_ID['hug'].id).toBe('huggingface');
    });
  });

  describe('Gateway Utility Functions', () => {
    describe('isValidGateway', () => {
      it('should return true for valid gateways', () => {
        expect(isValidGateway('openrouter')).toBe(true);
        expect(isValidGateway('groq')).toBe(true);
        expect(isValidGateway('all')).toBe(true);
      });

      it('should return true for aliases', () => {
        expect(isValidGateway('hug')).toBe(true);
      });

      it('should return false for invalid gateways', () => {
        expect(isValidGateway('invalid-gateway')).toBe(false);
        expect(isValidGateway('')).toBe(false);
        expect(isValidGateway('random')).toBe(false);
      });
    });

    describe('normalizeGatewayId', () => {
      it('should return the same ID for known gateways', () => {
        expect(normalizeGatewayId('openrouter')).toBe('openrouter');
        expect(normalizeGatewayId('groq')).toBe('groq');
      });

      it('should resolve aliases to canonical ID', () => {
        expect(normalizeGatewayId('hug')).toBe('huggingface');
      });

      it('should return input for unknown gateways', () => {
        expect(normalizeGatewayId('unknown')).toBe('unknown');
      });
    });

    describe('getGatewayDisplayName', () => {
      it('should return display name for known gateways', () => {
        expect(getGatewayDisplayName('openrouter')).toBe('OpenRouter');
        expect(getGatewayDisplayName('groq')).toBe('Groq');
        expect(getGatewayDisplayName('huggingface')).toBe('Hugging Face');
      });

      it('should return display name for aliases', () => {
        expect(getGatewayDisplayName('hug')).toBe('Hugging Face');
      });

      it('should return input ID for unknown gateways', () => {
        expect(getGatewayDisplayName('unknown-gateway')).toBe('unknown-gateway');
      });
    });

    describe('isGatewayDeprecated', () => {
      it('should return true for deprecated gateways', () => {
        // Portkey is marked as deprecated in the registry
        expect(isGatewayDeprecated('portkey')).toBe(true);
      });

      it('should return false for active gateways', () => {
        expect(isGatewayDeprecated('openrouter')).toBe(false);
        expect(isGatewayDeprecated('groq')).toBe(false);
      });

      it('should return false for unknown gateways', () => {
        expect(isGatewayDeprecated('unknown')).toBe(false);
      });
    });
  });

  describe('API Key Functions', () => {
    describe('getGatewayApiKey', () => {
      it('should return undefined for gateways without API key requirement', () => {
        expect(getGatewayApiKey('openrouter')).toBeUndefined();
        expect(getGatewayApiKey('groq')).toBeUndefined();
      });

      it('should return API key from NEXT_PUBLIC_ env var', () => {
        process.env.NEXT_PUBLIC_HF_API_KEY = 'test-hf-key';
        expect(getGatewayApiKey('huggingface')).toBe('test-hf-key');
      });

      it('should fallback to non-prefixed env var', () => {
        delete process.env.NEXT_PUBLIC_HF_API_KEY;
        process.env.HF_API_KEY = 'test-hf-key-fallback';
        expect(getGatewayApiKey('huggingface')).toBe('test-hf-key-fallback');
      });

      it('should return undefined when no env var is set', () => {
        delete process.env.NEXT_PUBLIC_HF_API_KEY;
        delete process.env.HF_API_KEY;
        expect(getGatewayApiKey('huggingface')).toBeUndefined();
      });

      it('should return undefined for unknown gateways', () => {
        expect(getGatewayApiKey('unknown')).toBeUndefined();
      });
    });

    describe('buildGatewayHeaders', () => {
      it('should always include Content-Type', () => {
        const headers = buildGatewayHeaders('openrouter');
        expect(headers['Content-Type']).toBe('application/json');
      });

      it('should include Authorization when API key is available', () => {
        process.env.NEXT_PUBLIC_NEAR_API_KEY = 'test-near-key';
        const headers = buildGatewayHeaders('near');
        expect(headers['Authorization']).toBe('Bearer test-near-key');
      });

      it('should not include Authorization when API key is not available', () => {
        delete process.env.NEXT_PUBLIC_NEAR_API_KEY;
        delete process.env.NEAR_API_KEY;
        const headers = buildGatewayHeaders('near');
        expect(headers['Authorization']).toBeUndefined();
      });
    });

    it('should have GATEWAYS_WITH_API_KEYS contain only gateways requiring API keys', () => {
      for (const gateway of GATEWAYS_WITH_API_KEYS) {
        expect(gateway.requiresApiKey).toBe(true);
        expect(gateway.apiKeyEnvVar).toBeDefined();
      }
    });
  });

  describe('Dynamic Gateway Registration', () => {
    describe('registerDynamicGateway', () => {
      it('should return existing gateway if already in static registry', () => {
        const result = registerDynamicGateway('openrouter');
        expect(result.id).toBe('openrouter');
        expect(result.name).toBe('OpenRouter');
      });

      it('should register a new gateway with auto-generated config', () => {
        const result = registerDynamicGateway('new-test-gateway');
        expect(result.id).toBe('new-test-gateway');
        expect(result.name).toBe('New Test Gateway'); // Auto-formatted
        expect(result.color).toMatch(/^bg-/);
        expect(result.priority).toBe('slow'); // Default
      });

      it('should accept custom config overrides', () => {
        const result = registerDynamicGateway('custom-gateway', {
          name: 'Custom Gateway Name',
          color: 'bg-pink-500',
          priority: 'fast',
        });
        expect(result.name).toBe('Custom Gateway Name');
        expect(result.color).toBe('bg-pink-500');
        expect(result.priority).toBe('fast');
      });

      it('should return same gateway on subsequent registrations', () => {
        const first = registerDynamicGateway('repeat-gateway');
        const second = registerDynamicGateway('repeat-gateway');
        expect(first).toBe(second);
      });

      it('should add gateway to GATEWAY_BY_ID and GATEWAY_CONFIG', () => {
        registerDynamicGateway('lookup-test-gateway');
        expect(GATEWAY_BY_ID['lookup-test-gateway']).toBeDefined();
        expect(GATEWAY_CONFIG['lookup-test-gateway']).toBeDefined();
      });
    });

    describe('getAllGateways', () => {
      it('should include both static and dynamic gateways', () => {
        registerDynamicGateway('all-gateways-test');
        const all = getAllGateways();

        // Should include static gateways
        expect(all.some(g => g.id === 'openrouter')).toBe(true);

        // Should include dynamic gateways
        expect(all.some(g => g.id === 'all-gateways-test')).toBe(true);
      });
    });

    describe('getAllActiveGatewayIds', () => {
      it('should include both static active and dynamic gateway IDs', () => {
        registerDynamicGateway('active-ids-test');
        const ids = getAllActiveGatewayIds();

        expect(ids).toContain('openrouter');
        expect(ids).toContain('active-ids-test');
        expect(ids).not.toContain('portkey'); // Deprecated
      });
    });

    describe('isDynamicGateway', () => {
      it('should return false for static gateways', () => {
        expect(isDynamicGateway('openrouter')).toBe(false);
      });

      it('should return true for dynamically registered gateways', () => {
        registerDynamicGateway('dynamic-check-test');
        expect(isDynamicGateway('dynamic-check-test')).toBe(true);
      });
    });

    describe('getDynamicGateways', () => {
      it('should return only dynamically registered gateways', () => {
        registerDynamicGateway('get-dynamic-test');
        const dynamic = getDynamicGateways();

        // Should contain our test gateway
        expect(dynamic.some(g => g.id === 'get-dynamic-test')).toBe(true);

        // Should not contain static gateways
        expect(dynamic.some(g => g.id === 'openrouter')).toBe(false);
      });
    });

    describe('autoRegisterGatewaysFromModels', () => {
      it('should register unknown gateways from model source_gateway', () => {
        const models = [
          { source_gateway: 'auto-register-test-1' },
          { source_gateway: 'openrouter' }, // Known, should not be re-registered
        ];

        autoRegisterGatewaysFromModels(models);

        expect(GATEWAY_BY_ID['auto-register-test-1']).toBeDefined();
      });

      it('should register unknown gateways from model source_gateways array', () => {
        const models = [
          { source_gateways: ['auto-register-test-2', 'auto-register-test-3'] },
        ];

        autoRegisterGatewaysFromModels(models);

        expect(GATEWAY_BY_ID['auto-register-test-2']).toBeDefined();
        expect(GATEWAY_BY_ID['auto-register-test-3']).toBeDefined();
      });

      it('should not re-register known gateways', () => {
        const originalName = GATEWAY_BY_ID['openrouter'].name;

        const models = [
          { source_gateway: 'openrouter' },
        ];

        autoRegisterGatewaysFromModels(models);

        // Name should remain unchanged
        expect(GATEWAY_BY_ID['openrouter'].name).toBe(originalName);
      });

      it('should handle models with no gateway info', () => {
        const models = [
          { id: 'model-without-gateway' },
          {},
        ];

        // Should not throw
        expect(() => autoRegisterGatewaysFromModels(models)).not.toThrow();
      });

      it('should skip aliases that resolve to known gateways', () => {
        const models = [
          { source_gateway: 'hug' }, // Alias for huggingface
        ];

        autoRegisterGatewaysFromModels(models);

        // 'hug' should resolve to huggingface, not be registered separately
        // (hug was already in GATEWAY_BY_ID as an alias)
        expect(GATEWAY_BY_ID['hug'].id).toBe('huggingface');
      });
    });
  });

  describe('Gateway Color Generation', () => {
    it('should generate consistent colors for the same gateway ID', () => {
      const gateway1 = registerDynamicGateway('color-consistency-test');
      // Clear and re-register (simulating a different session)
      // Note: In real usage, the Map persists, so this just returns the same gateway
      const gateway2 = registerDynamicGateway('color-consistency-test');

      expect(gateway1.color).toBe(gateway2.color);
    });

    it('should generate different colors for different gateway IDs', () => {
      const colors = new Set<string>();
      const testIds = ['color-test-a', 'color-test-b', 'color-test-c', 'color-test-d', 'color-test-e'];

      for (const id of testIds) {
        const gateway = registerDynamicGateway(id);
        colors.add(gateway.color);
      }

      // While collisions are possible, we should generally get different colors
      // for different IDs (especially with just 5 IDs and 12 possible colors)
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('Gateway Name Formatting', () => {
    it('should format hyphen-separated IDs correctly', () => {
      const gateway = registerDynamicGateway('my-new-gateway');
      expect(gateway.name).toBe('My New Gateway');
    });

    it('should format underscore-separated IDs correctly', () => {
      const gateway = registerDynamicGateway('my_new_gateway');
      expect(gateway.name).toBe('My New Gateway');
    });

    it('should format single-word IDs correctly', () => {
      const gateway = registerDynamicGateway('singleword');
      expect(gateway.name).toBe('Singleword');
    });
  });
});
