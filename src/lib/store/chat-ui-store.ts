import { create } from 'zustand';
import { ModelOption } from '@/components/chat/model-select';

// All NEAR AI models available for Incognito mode
// These models support privacy-focused conversations via NEAR AI
export const NEAR_INCOGNITO_MODELS: ModelOption[] = [
  {
    value: 'near/zai-org/GLM-4.6',
    label: 'GLM-4.6',
    category: 'General',
    sourceGateway: 'near',
    developer: 'ZAI',
    modalities: ['Text']
  },
  {
    value: 'near/deepseek-ai/DeepSeek-V3.1',
    label: 'DeepSeek V3.1',
    category: 'General',
    sourceGateway: 'near',
    developer: 'DeepSeek',
    modalities: ['Text']
  },
  {
    value: 'near/openai/gpt-oss-120b',
    label: 'GPT OSS 120B',
    category: 'General',
    sourceGateway: 'near',
    developer: 'OpenAI',
    modalities: ['Text']
  },
  {
    value: 'near/Qwen/Qwen3-30B-A3B-Instruct-2507',
    label: 'Qwen3 30B A3B Instruct',
    category: 'General',
    sourceGateway: 'near',
    developer: 'Qwen',
    modalities: ['Text']
  },
  {
    value: 'near/moonshotai/Kimi-K2-Thinking',
    label: 'Kimi K2 Thinking',
    category: 'Reasoning',
    sourceGateway: 'near',
    developer: 'Moonshot AI',
    modalities: ['Text']
  },
];

// Incognito mode default model (first model in the list)
export const INCOGNITO_DEFAULT_MODEL: ModelOption = NEAR_INCOGNITO_MODELS[0];

// Storage keys for persistence
const INCOGNITO_STORAGE_KEY = 'gatewayz_incognito_mode';
const PREVIOUS_MODEL_STORAGE_KEY = 'gatewayz_previous_model';

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

// Helper to get previous model from localStorage
const getPreviousModel = (): ModelOption | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(PREVIOUS_MODEL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// Helper to check if a model is a valid NEAR incognito model
const isNearIncognitoModel = (model: ModelOption | null): boolean => {
  if (!model) return false;
  return model.sourceGateway === 'near' || model.value.startsWith('near/');
};

interface ChatUIState {
  activeSessionId: number | null;
  mobileSidebarOpen: boolean;
  inputValue: string;
  selectedModel: ModelOption | null;
  messageStartTime: number | null; // Unix timestamp when message was sent
  isIncognitoMode: boolean;
  previousModel: ModelOption | null; // Store model before entering incognito
  _hasHydrated: boolean; // Track if hydration sync has run

  setActiveSessionId: (id: number | null) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setInputValue: (val: string) => void;
  setSelectedModel: (model: ModelOption | null) => void;
  setMessageStartTime: (time: number | null) => void;
  setIncognitoMode: (enabled: boolean) => void;
  toggleIncognitoMode: () => void;
  resetChatState: () => void;
  syncIncognitoState: () => void; // Sync incognito state after hydration
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
  previousModel: getPreviousModel(),
  _hasHydrated: false,

  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setInputValue: (val) => set({ inputValue: val }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setMessageStartTime: (time) => set({ messageStartTime: time }),

  // Sync incognito state after client-side hydration
  // This fixes the SSR mismatch where localStorage is unavailable during server render
  syncIncognitoState: () => {
    const state = get();

    // Only run once after hydration
    if (state._hasHydrated) return;

    // Check localStorage for the true incognito state
    const storedIncognito = typeof window !== 'undefined'
      ? localStorage.getItem(INCOGNITO_STORAGE_KEY) === 'true'
      : false;

    // If incognito mode is enabled but selected model is not a NEAR model,
    // we need to fix the state (this happens due to SSR hydration mismatch)
    if (storedIncognito && !isNearIncognitoModel(state.selectedModel)) {
      // Save current model as previous (if it's not already a NEAR model)
      const previousModel = state.selectedModel;
      set({
        _hasHydrated: true,
        isIncognitoMode: true,
        previousModel: previousModel,
        selectedModel: INCOGNITO_DEFAULT_MODEL
      });

      // Also persist the previous model to localStorage
      if (previousModel && typeof window !== 'undefined') {
        try {
          localStorage.setItem(PREVIOUS_MODEL_STORAGE_KEY, JSON.stringify(previousModel));
        } catch {
          // Ignore storage errors
        }
      }
    } else {
      // Just mark as hydrated, state is already correct
      set({ _hasHydrated: true });
    }
  },

  setIncognitoMode: (enabled) => {
    const currentModel = get().selectedModel;
    const previousModel = get().previousModel;

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(INCOGNITO_STORAGE_KEY, String(enabled));
        if (enabled && currentModel) {
          // Save current model before switching to incognito
          localStorage.setItem(PREVIOUS_MODEL_STORAGE_KEY, JSON.stringify(currentModel));
        }
      } catch {
        // Ignore storage errors
      }
    }

    // Update state
    if (enabled) {
      // Entering incognito: save current model and switch to incognito model
      set({
        isIncognitoMode: true,
        previousModel: currentModel,
        selectedModel: INCOGNITO_DEFAULT_MODEL
      });
    } else {
      // Exiting incognito: restore previous model
      // NOTE: If user changed the model while in incognito mode via ModelSelect,
      // that change is intentionally not persisted because incognito mode is
      // specifically about using GLM-4.6 for privacy. Changing the model while
      // in incognito effectively overrides the incognito behavior for that session,
      // but exiting still restores the pre-incognito model.
      set({
        isIncognitoMode: false,
        selectedModel: previousModel || STANDARD_DEFAULT_MODEL
      });
    }
  },
  toggleIncognitoMode: () => {
    // Delegate to setIncognitoMode to avoid code duplication
    const currentState = get().isIncognitoMode;
    get().setIncognitoMode(!currentState);
  },
  resetChatState: () => set({
    activeSessionId: null,
    inputValue: '',
    mobileSidebarOpen: false,
    messageStartTime: null
  }),
}));
