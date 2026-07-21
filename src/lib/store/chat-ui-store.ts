import { create } from 'zustand';
import { ModelOption } from '@/components/chat-v2/model-select';

// Storage keys for persistence
const INCOGNITO_STORAGE_KEY = 'gatewayz_incognito_mode';
const PREVIOUS_MODEL_STORAGE_KEY = 'gatewayz_previous_model';
const AUTO_ENABLE_SEARCH_KEY = 'gatewayz_auto_enable_search';

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

// Helper to get auto-enable search preference from localStorage
const getAutoEnableSearchPreference = (): boolean => {
  if (typeof window === 'undefined') return true; // Default to enabled
  try {
    const stored = localStorage.getItem(AUTO_ENABLE_SEARCH_KEY);
    return stored !== 'false'; // Default to true unless explicitly disabled
  } catch {
    return true;
  }
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

  // Tools state
  enabledTools: string[]; // List of enabled tool names (e.g., ['web_search'])
  autoEnableSearch: boolean; // Whether to auto-detect queries needing search

  setActiveSessionId: (id: number | null) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setInputValue: (val: string) => void;
  setSelectedModel: (model: ModelOption | null) => void;
  setMessageStartTime: (time: number | null) => void;
  setIncognitoMode: (enabled: boolean) => void;
  toggleIncognitoMode: () => void;
  resetChatState: () => void;
  syncIncognitoState: () => void; // Sync incognito state after hydration

  // Tools actions
  setEnabledTools: (tools: string[]) => void;
  toggleTool: (toolName: string) => void;
  setAutoEnableSearch: (enabled: boolean) => void;
}

export const useChatUIStore = create<ChatUIState>((set, get) => ({
  activeSessionId: null,
  mobileSidebarOpen: false,
  inputValue: '',
  selectedModel: null,
  messageStartTime: null,
  isIncognitoMode: getInitialIncognitoState(),
  previousModel: getPreviousModel(),
  _hasHydrated: false,

  // Tools state initialization
  enabledTools: [],
  autoEnableSearch: getAutoEnableSearchPreference(),

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
    let storedIncognito = false;
    if (typeof window !== 'undefined') {
      try {
        storedIncognito = localStorage.getItem(INCOGNITO_STORAGE_KEY) === 'true';
      } catch {
        // Ignore storage errors
      }
    }

    // ModelSelect resolves the first live NEAR model from the catalog. Keep the
    // store model-free during hydration so no removed provider can be selected.
    if (storedIncognito) {
      // Read the actual previous model from localStorage (not the SSR default)
      const storedPreviousModel = getPreviousModel();
      // If no stored previous model, use current SSR model as fallback
      const previousModel = storedPreviousModel || state.selectedModel;
      set({
        _hasHydrated: true,
        isIncognitoMode: true,
        previousModel: previousModel,
        selectedModel: null
      });

      // Only persist to localStorage if we didn't have a stored value
      if (!storedPreviousModel && previousModel && typeof window !== 'undefined') {
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
    const currentIncognitoMode = get().isIncognitoMode;

    // No-op if already in the desired state (makes this function idempotent)
    // This prevents unexpected model changes when calling setIncognitoMode(false)
    // while incognito is already disabled (which would restore previousModel)
    if (currentIncognitoMode === enabled) {
      return;
    }

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
      // Entering incognito: save current model. ModelSelect will choose the
      // first live NEAR catalog entry, or leave selection empty when unavailable.
      set({
        isIncognitoMode: true,
        previousModel: currentModel,
        selectedModel: null
      });
    } else {
      // Exiting incognito: restore previous model
      set({
        isIncognitoMode: false,
        selectedModel: previousModel || null
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
    messageStartTime: null,
    enabledTools: [], // Reset tools on new chat
  }),

  // Tools actions
  setEnabledTools: (tools) => set({ enabledTools: tools }),

  toggleTool: (toolName) => {
    const current = get().enabledTools;
    const isEnabled = current.includes(toolName);
    const next = isEnabled
      ? current.filter(t => t !== toolName)
      : [...current, toolName];
    set({ enabledTools: next });
  },

  setAutoEnableSearch: (enabled) => {
    set({ autoEnableSearch: enabled });
    // Persist preference to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AUTO_ENABLE_SEARCH_KEY, String(enabled));
      } catch {
        // Ignore storage errors
      }
    }
  },
}));
