import { create } from 'zustand';
import { ModelOption } from '@/components/chat/model-select';

interface ChatUIState {
  activeSessionId: number | null;
  mobileSidebarOpen: boolean;
  inputValue: string;
  selectedModel: ModelOption | null;
  pendingPrompt: string | null;
  isRetrying: boolean;

  setActiveSessionId: (id: number | null) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setInputValue: (val: string) => void;
  setSelectedModel: (model: ModelOption | null) => void;
  setPendingPrompt: (prompt: string | null) => void;
  setIsRetrying: (retrying: boolean) => void;
  resetChatState: () => void;
}

export const useChatUIStore = create<ChatUIState>((set) => ({
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
  pendingPrompt: null,
  isRetrying: false,

  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setInputValue: (val) => set({ inputValue: val }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
  setIsRetrying: (retrying) => set({ isRetrying: retrying }),
  resetChatState: () => set({
    activeSessionId: null,
    inputValue: '',
    mobileSidebarOpen: false,
    pendingPrompt: null,
    isRetrying: false
  }),
}));
