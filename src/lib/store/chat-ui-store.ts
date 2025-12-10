import { create } from 'zustand';
import { ModelOption } from '@/components/chat/model-select';

interface ChatUIState {
  activeSessionId: number | null;
  mobileSidebarOpen: boolean;
  inputValue: string;
  selectedModel: ModelOption | null;
  messageStartTime: number | null; // Unix timestamp when message was sent

  setActiveSessionId: (id: number | null) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setInputValue: (val: string) => void;
  setSelectedModel: (model: ModelOption | null) => void;
  setMessageStartTime: (time: number | null) => void;
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
  messageStartTime: null,

  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setInputValue: (val) => set({ inputValue: val }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setMessageStartTime: (time) => set({ messageStartTime: time }),
  resetChatState: () => set({
    activeSessionId: null,
    inputValue: '',
    mobileSidebarOpen: false,
    messageStartTime: null
  }),
}));
