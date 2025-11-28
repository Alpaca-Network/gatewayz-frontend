import { create } from 'zustand';
import { ModelOption } from '@/components/chat/model-select';

interface ChatUIState {
  activeSessionId: number | null;
  mobileSidebarOpen: boolean;
  inputValue: string;
  selectedModel: ModelOption | null;
  
  setActiveSessionId: (id: number | null) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setInputValue: (val: string) => void;
  setSelectedModel: (model: ModelOption | null) => void;
}

export const useChatUIStore = create<ChatUIState>((set) => ({
  activeSessionId: null,
  mobileSidebarOpen: false,
  inputValue: '',
  selectedModel: {
      value: 'openrouter/auto',
      label: 'Gatewayz Router',
      category: 'Router',
      sourceGateway: 'openrouter',
      developer: 'Alpaca',
      modalities: ['Text', 'Image', 'File', 'Audio', 'Video']
  },
  
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setInputValue: (val) => set({ inputValue: val }),
  setSelectedModel: (model) => set({ selectedModel: model }),
}));
