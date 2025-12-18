import { useChatUIStore, INCOGNITO_DEFAULT_MODEL, NEAR_INCOGNITO_MODELS } from '../chat-ui-store';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('chat-ui-store', () => {
  beforeEach(() => {
    // Reset the store state between tests
    useChatUIStore.setState({
      activeSessionId: null,
      mobileSidebarOpen: false,
      inputValue: '',
      isIncognitoMode: false,
      previousModel: null,
      selectedModel: {
        value: 'cerebras/llama-3.3-70b',
        label: 'Llama 3.3 70B',
        category: 'General',
        sourceGateway: 'cerebras',
        developer: 'Meta',
        modalities: ['Text']
      },
      messageStartTime: null,
    });
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('messageStartTime', () => {
    it('should initialize messageStartTime as null', () => {
      const state = useChatUIStore.getState();
      expect(state.messageStartTime).toBeNull();
    });

    it('should set messageStartTime with setMessageStartTime', () => {
      const timestamp = Date.now();
      useChatUIStore.getState().setMessageStartTime(timestamp);

      const state = useChatUIStore.getState();
      expect(state.messageStartTime).toBe(timestamp);
    });

    it('should clear messageStartTime when set to null', () => {
      const timestamp = Date.now();
      useChatUIStore.getState().setMessageStartTime(timestamp);
      expect(useChatUIStore.getState().messageStartTime).toBe(timestamp);

      useChatUIStore.getState().setMessageStartTime(null);
      expect(useChatUIStore.getState().messageStartTime).toBeNull();
    });

    it('should reset messageStartTime when resetChatState is called', () => {
      const timestamp = Date.now();
      useChatUIStore.getState().setMessageStartTime(timestamp);
      expect(useChatUIStore.getState().messageStartTime).toBe(timestamp);

      useChatUIStore.getState().resetChatState();
      expect(useChatUIStore.getState().messageStartTime).toBeNull();
    });
  });

  describe('INCOGNITO_DEFAULT_MODEL', () => {
    it('should export the incognito default model constant', () => {
      expect(INCOGNITO_DEFAULT_MODEL).toBeDefined();
      expect(INCOGNITO_DEFAULT_MODEL.value).toBe('near/zai-org/GLM-4.6');
      expect(INCOGNITO_DEFAULT_MODEL.label).toBe('GLM-4.6');
      expect(INCOGNITO_DEFAULT_MODEL.sourceGateway).toBe('near');
    });
  });

  describe('NEAR_INCOGNITO_MODELS', () => {
    it('should export all NEAR incognito models', () => {
      expect(NEAR_INCOGNITO_MODELS).toBeDefined();
      expect(Array.isArray(NEAR_INCOGNITO_MODELS)).toBe(true);
      expect(NEAR_INCOGNITO_MODELS.length).toBe(5);
    });

    it('should include all 5 tested NEAR AI models', () => {
      const modelIds = NEAR_INCOGNITO_MODELS.map(m => m.value);

      expect(modelIds).toContain('near/zai-org/GLM-4.6');
      expect(modelIds).toContain('near/deepseek-ai/DeepSeek-V3.1');
      expect(modelIds).toContain('near/openai/gpt-oss-120b');
      expect(modelIds).toContain('near/Qwen/Qwen3-30B-A3B-Instruct-2507');
      expect(modelIds).toContain('near/moonshotai/Kimi-K2-Thinking');
    });

    it('should have all models with near gateway', () => {
      NEAR_INCOGNITO_MODELS.forEach(model => {
        expect(model.sourceGateway).toBe('near');
      });
    });

    it('should have INCOGNITO_DEFAULT_MODEL as the first model', () => {
      expect(NEAR_INCOGNITO_MODELS[0]).toEqual(INCOGNITO_DEFAULT_MODEL);
    });

    it('should have valid model structure for all models', () => {
      NEAR_INCOGNITO_MODELS.forEach(model => {
        expect(model.value).toBeDefined();
        expect(model.label).toBeDefined();
        expect(model.category).toBeDefined();
        expect(model.sourceGateway).toBe('near');
        expect(model.developer).toBeDefined();
        expect(model.modalities).toContain('Text');
      });
    });
  });

  describe('isIncognitoMode', () => {
    it('should have initial incognito mode set to false', () => {
      const state = useChatUIStore.getState();
      expect(state.isIncognitoMode).toBe(false);
    });

    it('should toggle incognito mode', () => {
      const { toggleIncognitoMode } = useChatUIStore.getState();

      // Toggle on
      toggleIncognitoMode();
      expect(useChatUIStore.getState().isIncognitoMode).toBe(true);

      // Toggle off
      toggleIncognitoMode();
      expect(useChatUIStore.getState().isIncognitoMode).toBe(false);
    });

    it('should set incognito mode directly', () => {
      const { setIncognitoMode } = useChatUIStore.getState();

      setIncognitoMode(true);
      expect(useChatUIStore.getState().isIncognitoMode).toBe(true);

      setIncognitoMode(false);
      expect(useChatUIStore.getState().isIncognitoMode).toBe(false);
    });

    it('should persist incognito mode to localStorage when enabled', () => {
      const { setIncognitoMode } = useChatUIStore.getState();

      setIncognitoMode(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('gatewayz_incognito_mode', 'true');
    });

    it('should persist incognito mode to localStorage when disabled', () => {
      const { setIncognitoMode } = useChatUIStore.getState();

      setIncognitoMode(true);
      setIncognitoMode(false);
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith('gatewayz_incognito_mode', 'false');
    });

    it('should switch to GLM-4.6 model when incognito mode is enabled', () => {
      const { setIncognitoMode } = useChatUIStore.getState();

      setIncognitoMode(true);

      const state = useChatUIStore.getState();
      expect(state.selectedModel?.value).toBe('near/zai-org/GLM-4.6');
      expect(state.selectedModel?.label).toBe('GLM-4.6');
    });

    it('should restore previous model when incognito mode is disabled', () => {
      // Set a custom model first
      useChatUIStore.getState().setSelectedModel({
        value: 'openai/gpt-4',
        label: 'GPT-4',
        category: 'General',
        sourceGateway: 'openrouter',
        developer: 'OpenAI',
        modalities: ['Text']
      });

      const { setIncognitoMode } = useChatUIStore.getState();

      // Enable incognito - should switch to GLM-4.6 and save previous model
      setIncognitoMode(true);
      expect(useChatUIStore.getState().selectedModel?.value).toBe('near/zai-org/GLM-4.6');
      expect(useChatUIStore.getState().previousModel?.value).toBe('openai/gpt-4');

      // Disable incognito - should restore previous model (GPT-4)
      setIncognitoMode(false);
      expect(useChatUIStore.getState().selectedModel?.value).toBe('openai/gpt-4');
    });

    it('should save previous model to localStorage when entering incognito', () => {
      // Set a custom model first
      useChatUIStore.getState().setSelectedModel({
        value: 'openai/gpt-4',
        label: 'GPT-4',
        category: 'General',
        sourceGateway: 'openrouter',
        developer: 'OpenAI',
        modalities: ['Text']
      });

      const { setIncognitoMode } = useChatUIStore.getState();

      setIncognitoMode(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'gatewayz_previous_model',
        expect.stringContaining('openai/gpt-4')
      );
    });

    it('should switch model via toggleIncognitoMode', () => {
      const { toggleIncognitoMode } = useChatUIStore.getState();

      toggleIncognitoMode();

      const state = useChatUIStore.getState();
      expect(state.isIncognitoMode).toBe(true);
      expect(state.selectedModel?.value).toBe('near/zai-org/GLM-4.6');
    });
  });

  describe('resetChatState', () => {
    it('should reset all relevant state including messageStartTime', () => {
      // Set various state values
      useChatUIStore.getState().setActiveSessionId(123);
      useChatUIStore.getState().setInputValue('test input');
      useChatUIStore.getState().setMobileSidebarOpen(true);
      useChatUIStore.getState().setMessageStartTime(Date.now());

      // Verify state is set
      let state = useChatUIStore.getState();
      expect(state.activeSessionId).toBe(123);
      expect(state.inputValue).toBe('test input');
      expect(state.mobileSidebarOpen).toBe(true);
      expect(state.messageStartTime).not.toBeNull();

      // Reset state
      useChatUIStore.getState().resetChatState();

      // Verify state is reset
      state = useChatUIStore.getState();
      expect(state.activeSessionId).toBeNull();
      expect(state.inputValue).toBe('');
      expect(state.mobileSidebarOpen).toBe(false);
      expect(state.messageStartTime).toBeNull();
    });

    it('should not reset incognito mode', () => {
      const { setIncognitoMode, resetChatState } = useChatUIStore.getState();

      // Enable incognito mode
      setIncognitoMode(true);
      expect(useChatUIStore.getState().isIncognitoMode).toBe(true);

      // Reset chat state
      resetChatState();

      // Incognito mode should remain unchanged
      expect(useChatUIStore.getState().isIncognitoMode).toBe(true);
    });
  });

  describe('syncIncognitoState', () => {
    it('should sync incognito state when localStorage has incognito enabled but model is wrong', () => {
      // Simulate SSR hydration mismatch: localStorage has incognito=true,
      // but selectedModel is the standard default (not a NEAR model)
      localStorageMock.setItem('gatewayz_incognito_mode', 'true');

      // Reset store to simulate fresh page load where SSR set wrong model
      useChatUIStore.setState({
        isIncognitoMode: false, // SSR default
        selectedModel: {
          value: 'openrouter/deepseek/deepseek-r1',
          label: 'DeepSeek R1',
          category: 'Reasoning',
          sourceGateway: 'openrouter',
          developer: 'DeepSeek',
          modalities: ['Text']
        },
        previousModel: null,
        _hasHydrated: false
      });

      // Call sync to fix the state
      useChatUIStore.getState().syncIncognitoState();

      // Verify state was fixed
      const state = useChatUIStore.getState();
      expect(state.isIncognitoMode).toBe(true);
      expect(state.selectedModel?.value).toBe('near/zai-org/GLM-4.6');
      expect(state.selectedModel?.sourceGateway).toBe('near');
      expect(state.previousModel?.value).toBe('openrouter/deepseek/deepseek-r1');
      expect(state._hasHydrated).toBe(true);
    });

    it('should not change state if already using a NEAR model', () => {
      localStorageMock.setItem('gatewayz_incognito_mode', 'true');

      // State is already correct
      useChatUIStore.setState({
        isIncognitoMode: true,
        selectedModel: INCOGNITO_DEFAULT_MODEL,
        previousModel: null,
        _hasHydrated: false
      });

      useChatUIStore.getState().syncIncognitoState();

      // State should remain unchanged (except _hasHydrated)
      const state = useChatUIStore.getState();
      expect(state.isIncognitoMode).toBe(true);
      expect(state.selectedModel?.value).toBe('near/zai-org/GLM-4.6');
      expect(state._hasHydrated).toBe(true);
    });

    it('should only run once (idempotent)', () => {
      localStorageMock.setItem('gatewayz_incognito_mode', 'true');

      useChatUIStore.setState({
        isIncognitoMode: false,
        selectedModel: {
          value: 'openrouter/deepseek/deepseek-r1',
          label: 'DeepSeek R1',
          category: 'Reasoning',
          sourceGateway: 'openrouter',
          developer: 'DeepSeek',
          modalities: ['Text']
        },
        previousModel: null,
        _hasHydrated: false
      });

      // First call
      useChatUIStore.getState().syncIncognitoState();
      expect(useChatUIStore.getState()._hasHydrated).toBe(true);

      // Change the model manually
      useChatUIStore.getState().setSelectedModel({
        value: 'anthropic/claude-3',
        label: 'Claude 3',
        category: 'General',
        sourceGateway: 'openrouter',
        developer: 'Anthropic',
        modalities: ['Text']
      });

      // Second call should not change anything
      useChatUIStore.getState().syncIncognitoState();
      expect(useChatUIStore.getState().selectedModel?.value).toBe('anthropic/claude-3');
    });

    it('should not sync if incognito is not enabled in localStorage', () => {
      localStorageMock.setItem('gatewayz_incognito_mode', 'false');

      useChatUIStore.setState({
        isIncognitoMode: false,
        selectedModel: {
          value: 'openrouter/deepseek/deepseek-r1',
          label: 'DeepSeek R1',
          category: 'Reasoning',
          sourceGateway: 'openrouter',
          developer: 'DeepSeek',
          modalities: ['Text']
        },
        previousModel: null,
        _hasHydrated: false
      });

      useChatUIStore.getState().syncIncognitoState();

      // Model should remain unchanged
      const state = useChatUIStore.getState();
      expect(state.selectedModel?.value).toBe('openrouter/deepseek/deepseek-r1');
      expect(state.isIncognitoMode).toBe(false);
      expect(state._hasHydrated).toBe(true);
    });

    it('should read previousModel from localStorage instead of using SSR default', () => {
      // Simulate incognito was enabled with a specific model stored
      localStorageMock.setItem('gatewayz_incognito_mode', 'true');
      localStorageMock.setItem('gatewayz_previous_model', JSON.stringify({
        value: 'openai/gpt-4',
        label: 'GPT-4',
        category: 'General',
        sourceGateway: 'openrouter',
        developer: 'OpenAI',
        modalities: ['Text']
      }));

      // SSR default model (would be different from stored previous model)
      useChatUIStore.setState({
        isIncognitoMode: false,
        selectedModel: {
          value: 'openrouter/deepseek/deepseek-r1',
          label: 'DeepSeek R1',
          category: 'Reasoning',
          sourceGateway: 'openrouter',
          developer: 'DeepSeek',
          modalities: ['Text']
        },
        previousModel: null,
        _hasHydrated: false
      });

      useChatUIStore.getState().syncIncognitoState();

      // Should restore the stored GPT-4 as previousModel, not the SSR default DeepSeek R1
      const state = useChatUIStore.getState();
      expect(state.isIncognitoMode).toBe(true);
      expect(state.selectedModel?.value).toBe('near/zai-org/GLM-4.6');
      expect(state.previousModel?.value).toBe('openai/gpt-4');
      expect(state._hasHydrated).toBe(true);
    });
  });
});
