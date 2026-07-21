import { useChatUIStore } from '../chat-ui-store';

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
        value: 'cerebras/qwen-3-32b',
        label: 'Qwen3 32B',
        category: 'General',
        sourceGateway: 'cerebras',
        developer: 'Qwen',
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

    it('should clear the model until the live NEAR catalog loads', () => {
      const { setIncognitoMode } = useChatUIStore.getState();

      setIncognitoMode(true);

      const state = useChatUIStore.getState();
      expect(state.selectedModel).toBeNull();
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

      // Enable incognito - the catalog owns selection and the previous model is saved
      setIncognitoMode(true);
      expect(useChatUIStore.getState().selectedModel).toBeNull();
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

    it('should clear the model via toggleIncognitoMode until the catalog resolves it', () => {
      const { toggleIncognitoMode } = useChatUIStore.getState();

      toggleIncognitoMode();

      const state = useChatUIStore.getState();
      expect(state.isIncognitoMode).toBe(true);
      expect(state.selectedModel).toBeNull();
    });

    it('should be idempotent - calling setIncognitoMode(false) when already off should not change model', () => {
      // Set a custom model
      const customModel = {
        value: 'openai/gpt-4',
        label: 'GPT-4',
        category: 'General',
        sourceGateway: 'openrouter',
        developer: 'OpenAI',
        modalities: ['Text']
      };
      useChatUIStore.getState().setSelectedModel(customModel);

      // Simulate a previous incognito session by setting previousModel directly
      // (this happens when user was in incognito mode in a previous session)
      useChatUIStore.setState({ previousModel: {
        value: 'anthropic/claude-3',
        label: 'Claude 3',
        category: 'General',
        sourceGateway: 'openrouter',
        developer: 'Anthropic',
        modalities: ['Text']
      }});

      // Verify incognito is off and we have our custom model
      expect(useChatUIStore.getState().isIncognitoMode).toBe(false);
      expect(useChatUIStore.getState().selectedModel?.value).toBe('openai/gpt-4');

      // Call setIncognitoMode(false) - this should be a no-op
      useChatUIStore.getState().setIncognitoMode(false);

      // Model should NOT have changed to previousModel
      expect(useChatUIStore.getState().selectedModel?.value).toBe('openai/gpt-4');
      expect(useChatUIStore.getState().isIncognitoMode).toBe(false);
    });

    it('should be idempotent - calling setIncognitoMode(true) when already on should not change model', () => {
      // Enable incognito mode
      useChatUIStore.getState().setIncognitoMode(true);
      expect(useChatUIStore.getState().isIncognitoMode).toBe(true);

      // Store the previousModel that was saved
      const savedPreviousModel = useChatUIStore.getState().previousModel;

      // Manually change selected model while in incognito (simulating user selecting different incognito model)
      const differentIncognitoModel = {
        value: 'near/deepseek-ai/DeepSeek-V3.1',
        label: 'DeepSeek V3.1',
        category: 'General',
        sourceGateway: 'near',
        developer: 'DeepSeek',
        modalities: ['Text']
      };
      useChatUIStore.getState().setSelectedModel(differentIncognitoModel);

      // Call setIncognitoMode(true) again - should be a no-op
      useChatUIStore.getState().setIncognitoMode(true);

      // Should still have the different incognito model, not reset to default
      expect(useChatUIStore.getState().selectedModel?.value).toBe('near/deepseek-ai/DeepSeek-V3.1');
      // previousModel should not have been overwritten
      expect(useChatUIStore.getState().previousModel).toEqual(savedPreviousModel);
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
      expect(state.selectedModel).toBeNull();
      expect(state.previousModel?.value).toBe('openrouter/deepseek/deepseek-r1');
      expect(state._hasHydrated).toBe(true);
    });

    it('should clear a persisted NEAR model so the current catalog revalidates it', () => {
      localStorageMock.setItem('gatewayz_incognito_mode', 'true');

      const persistedNearModel = {
        value: 'near/deepseek-ai/DeepSeek-V3.1',
        label: 'DeepSeek V3.1',
        category: 'General',
        sourceGateway: 'near',
        developer: 'DeepSeek',
        modalities: ['Text']
      };
      useChatUIStore.setState({
        isIncognitoMode: true,
        selectedModel: persistedNearModel,
        previousModel: null,
        _hasHydrated: false
      });

      useChatUIStore.getState().syncIncognitoState();

      const state = useChatUIStore.getState();
      expect(state.isIncognitoMode).toBe(true);
      expect(state.selectedModel).toBeNull();
      expect(state.previousModel).toEqual(persistedNearModel);
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
      expect(state.selectedModel).toBeNull();
      expect(state.previousModel?.value).toBe('openai/gpt-4');
      expect(state._hasHydrated).toBe(true);
    });
  });
});
