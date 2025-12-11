import { useChatUIStore, INCOGNITO_DEFAULT_MODEL } from '../chat-ui-store';

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
        value: 'deepseek/deepseek-r1',
        label: 'DeepSeek R1',
        category: 'Reasoning',
        sourceGateway: 'openrouter',
        developer: 'DeepSeek',
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
});
