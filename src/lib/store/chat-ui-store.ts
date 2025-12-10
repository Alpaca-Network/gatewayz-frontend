import { create } from 'zustand';
import { ModelOption } from '@/components/chat/model-select';

// Incognito mode default model
export const INCOGNITO_DEFAULT_MODEL: ModelOption = {
  value: 'near/zai-org/GLM-4.6',
  label: 'GLM-4.6',
  category: 'General',
  sourceGateway: 'near',
  developer: 'ZAI',
  modalities: ['Text']
};

// Storage key for incognito mode persistence
const INCOGNITO_STORAGE_KEY = 'gatewayz_incognito_mode';

// Helper to get initial incognito state from localStorage
const getInitialIncognitoState = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(INCOGNITO_STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
};

interface ChatUIState {
  activeSessionId: number | null;
  mobileSidebarOpen: boolean;
  inputValue: string;
  selectedModel: ModelOption | null;
  messageStartTime: number | null; // Unix timestamp when message was sent
  isIncognitoMode: boolean;

  setActiveSessionId: (id: number | null) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setInputValue: (val: string) => void;
  setSelectedModel: (model: ModelOption | null) => void;
  setMessageStartTime: (time: number | null) => void;
  setIncognitoMode: (enabled: boolean) => void;
  toggleIncognitoMode: () => void;
  resetChatState: () => void;
}

// Standard default model
const STANDARD_DEFAULT_MODEL: ModelOption = {
  value: 'deepseek/deepseek-r1',
  label: 'DeepSeek R1',
  category: 'Reasoning',
  sourceGateway: 'openrouter',
  developer: 'DeepSeek',
  modalities: ['Text']
};

export const useChatUIStore = create<ChatUIState>((set, get) => ({
  activeSessionId: null,
  mobileSidebarOpen: false,
  inputValue: '',
  selectedModel: getInitialIncognitoState() ? INCOGNITO_DEFAULT_MODEL : STANDARD_DEFAULT_MODEL,
  messageStartTime: null,
  isIncognitoMode: getInitialIncognitoState(),

  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setInputValue: (val) => set({ inputValue: val }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setMessageStartTime: (time) => set({ messageStartTime: time }),
  setIncognitoMode: (enabled) => {
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(INCOGNITO_STORAGE_KEY, String(enabled));
      } catch {
        // Ignore storage errors
      }
    }
    // Update state and switch model if enabling incognito
    set((state) => ({
      isIncognitoMode: enabled,
      selectedModel: enabled ? INCOGNITO_DEFAULT_MODEL : state.selectedModel
    }));
  },
  toggleIncognitoMode: () => {
    const currentState = get().isIncognitoMode;
    const newState = !currentState;
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(INCOGNITO_STORAGE_KEY, String(newState));
      } catch {
        // Ignore storage errors
      }
    }
    // Update state and switch model if enabling incognito
    set((state) => ({
      isIncognitoMode: newState,
      selectedModel: newState ? INCOGNITO_DEFAULT_MODEL : state.selectedModel
    }));
  },
  resetChatState: () => set({
    activeSessionId: null,
    inputValue: '',
    mobileSidebarOpen: false,
    messageStartTime: null
  }),
}));
