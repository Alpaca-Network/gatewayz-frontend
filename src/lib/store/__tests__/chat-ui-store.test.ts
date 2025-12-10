import { useChatUIStore } from '../chat-ui-store';

describe('chat-ui-store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatUIStore.setState({
      activeSessionId: null,
      mobileSidebarOpen: false,
      inputValue: '',
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
  });
});
