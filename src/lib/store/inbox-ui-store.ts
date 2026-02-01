import { create } from 'zustand';

// Storage key for persistence
const COLUMN_VIEW_STORAGE_KEY = 'gatewayz_kanban_column_view';

export type ColumnView = '1' | '2';

// Helper to get initial column view from localStorage
const getInitialColumnView = (): ColumnView => {
  if (typeof window === 'undefined') return '1';
  try {
    const stored = localStorage.getItem(COLUMN_VIEW_STORAGE_KEY);
    if (stored === '1' || stored === '2') {
      return stored;
    }
    return '1';
  } catch {
    return '1';
  }
};

interface InboxUIState {
  // Column view: '1' for single column, '2' for two columns
  columnView: ColumnView;
  _hasHydrated: boolean;

  // Actions
  setColumnView: (view: ColumnView) => void;
  toggleColumnView: () => void;
  syncColumnViewState: () => void;
}

export const useInboxUIStore = create<InboxUIState>((set, get) => ({
  columnView: '1', // Default to single column (will sync from localStorage on hydration)
  _hasHydrated: false,

  setColumnView: (view) => {
    set({ columnView: view });

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(COLUMN_VIEW_STORAGE_KEY, view);
      } catch {
        // Ignore storage errors
      }
    }
  },

  toggleColumnView: () => {
    const currentView = get().columnView;
    const newView: ColumnView = currentView === '1' ? '2' : '1';
    get().setColumnView(newView);
  },

  // Sync state after client-side hydration
  syncColumnViewState: () => {
    const state = get();

    // Only run once after hydration
    if (state._hasHydrated) return;

    const storedView = getInitialColumnView();
    set({
      _hasHydrated: true,
      columnView: storedView
    });
  },
}));
