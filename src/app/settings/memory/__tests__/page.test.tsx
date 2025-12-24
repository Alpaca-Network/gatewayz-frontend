/**
 * Tests for Memory Settings Page
 *
 * Tests cover:
 * - Page rendering and structure
 * - Loading states
 * - Error states
 * - Empty state
 * - Memory list display
 * - Delete individual memory
 * - Delete all memories
 * - Refresh functionality
 * - Category badges
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoryPage from '../page';

// Mock the api module
const mockGetApiKey = jest.fn();
jest.mock('@/lib/api', () => ({
  getApiKey: () => mockGetApiKey(),
}));

// Mock the memory-api module
const mockGetMemories = jest.fn();
const mockGetStats = jest.fn();
const mockDeleteMemory = jest.fn();
const mockDeleteAllMemories = jest.fn();

jest.mock('@/lib/memory-api', () => ({
  MemoryAPI: jest.fn().mockImplementation(() => ({
    getMemories: mockGetMemories,
    getStats: mockGetStats,
    deleteMemory: mockDeleteMemory,
    deleteAllMemories: mockDeleteAllMemories,
  })),
  MEMORY_CATEGORY_LABELS: {
    preference: 'Preference',
    context: 'Background',
    instruction: 'Instruction',
    fact: 'Fact',
    name: 'Personal',
    project: 'Project',
    general: 'General',
  },
  MEMORY_CATEGORY_COLORS: {
    preference: 'bg-blue-100 text-blue-800',
    context: 'bg-purple-100 text-purple-800',
    instruction: 'bg-green-100 text-green-800',
    fact: 'bg-yellow-100 text-yellow-800',
    name: 'bg-pink-100 text-pink-800',
    project: 'bg-orange-100 text-orange-800',
    general: 'bg-gray-100 text-gray-800',
  },
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick, variant, size, className, ...props }: any) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled}
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div data-testid="alert-dialog">{children}</div>,
  AlertDialogAction: ({ children, onClick, className }: any) => (
    <button data-testid="alert-dialog-action" onClick={onClick} className={className}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: any) => (
    <button data-testid="alert-dialog-cancel">{children}</button>
  ),
  AlertDialogContent: ({ children }: any) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogDescription: ({ children }: any) => (
    <p data-testid="alert-dialog-description">{children}</p>
  ),
  AlertDialogFooter: ({ children }: any) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
  AlertDialogHeader: ({ children }: any) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: any) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogTrigger: ({ children, asChild }: any) => (
    <div data-testid="alert-dialog-trigger">{children}</div>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="icon-trash">Trash</span>,
  RefreshCw: ({ className }: any) => <span data-testid="icon-refresh" className={className}>Refresh</span>,
  Brain: () => <span data-testid="icon-brain">Brain</span>,
  Info: () => <span data-testid="icon-info">Info</span>,
}));

describe('MemoryPage', () => {
  // ============================================================
  // FIXTURES
  // ============================================================

  const mockMemories = [
    {
      id: 1,
      user_id: 123,
      category: 'preference',
      content: 'User prefers Python over JavaScript',
      source_session_id: 100,
      confidence: 0.85,
      is_active: true,
      access_count: 3,
      last_accessed_at: '2024-01-15T10:00:00Z',
      created_at: '2024-01-10T08:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 2,
      user_id: 123,
      category: 'context',
      content: 'User is a backend engineer',
      source_session_id: 101,
      confidence: 0.90,
      is_active: true,
      access_count: 5,
      last_accessed_at: '2024-01-16T14:00:00Z',
      created_at: '2024-01-11T09:00:00Z',
      updated_at: '2024-01-16T14:00:00Z',
    },
    {
      id: 3,
      user_id: 123,
      category: 'fact',
      content: "User's name is Alex",
      source_session_id: 102,
      confidence: 0.95,
      is_active: true,
      access_count: 0,
      last_accessed_at: null,
      created_at: '2024-01-12T10:00:00Z',
      updated_at: '2024-01-12T10:00:00Z',
    },
  ];

  const mockStatsResponse = {
    success: true,
    stats: {
      total_memories: 3,
      by_category: {
        preference: 1,
        context: 1,
        fact: 1,
      },
      oldest_memory: '2024-01-10T08:00:00Z',
      newest_memory: '2024-01-12T10:00:00Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApiKey.mockReturnValue('test-api-key');
  });

  // ============================================================
  // Loading State
  // ============================================================

  describe('Loading state', () => {
    it('should show loading state initially', async () => {
      mockGetMemories.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockGetStats.mockImplementation(() => new Promise(() => {}));

      render(<MemoryPage />);

      expect(screen.getByText('AI Memory')).toBeInTheDocument();
      expect(screen.getByText('Loading memories...')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Error State
  // ============================================================

  describe('Error state', () => {
    it('should show error when not signed in', async () => {
      mockGetApiKey.mockReturnValue(null);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Please sign in to view your AI memory')).toBeInTheDocument();
      });
    });

    it('should show error when API fails', async () => {
      mockGetMemories.mockRejectedValueOnce(new Error('API Error'));
      mockGetStats.mockRejectedValueOnce(new Error('API Error'));

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument();
      });
    });

    it('should show try again button on error', async () => {
      mockGetApiKey.mockReturnValue(null);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should retry fetching when try again is clicked', async () => {
      mockGetApiKey.mockReturnValueOnce(null);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // Now mock API key for retry
      mockGetApiKey.mockReturnValue('test-api-key');
      mockGetMemories.mockResolvedValueOnce({ success: true, data: [], count: 0 });
      mockGetStats.mockResolvedValueOnce({ success: true, stats: { total_memories: 0, by_category: {} } });

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockGetMemories).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // Empty State
  // ============================================================

  describe('Empty state', () => {
    it('should show empty state when no memories', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: [], count: 0 });
      mockGetStats.mockResolvedValueOnce({ success: true, stats: { total_memories: 0, by_category: {} } });

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('No memories yet')).toBeInTheDocument();
      });
    });

    it('should show helpful description in empty state', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: [], count: 0 });
      mockGetStats.mockResolvedValueOnce({ success: true, stats: { total_memories: 0, by_category: {} } });

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/automatically remember important information/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // Memory List Display
  // ============================================================

  describe('Memory list display', () => {
    it('should display memories', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('User prefers Python over JavaScript')).toBeInTheDocument();
        expect(screen.getByText('User is a backend engineer')).toBeInTheDocument();
        expect(screen.getByText("User's name is Alex")).toBeInTheDocument();
      });
    });

    it('should display category badges', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should display total memory count', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('3 memories stored')).toBeInTheDocument();
      });
    });

    it('should display singular memory text for 1 memory', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: [mockMemories[0]], count: 1 });
      mockGetStats.mockResolvedValueOnce({
        success: true,
        stats: { total_memories: 1, by_category: { preference: 1 } },
      });

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('1 memory stored')).toBeInTheDocument();
      });
    });

    it('should display access count for used memories', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Used 3x')).toBeInTheDocument();
        expect(screen.getByText('Used 5x')).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // Header Actions
  // ============================================================

  describe('Header actions', () => {
    it('should show refresh button', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    it('should show clear all button when memories exist', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });
    });

    it('should not show clear all button when no memories', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: [], count: 0 });
      mockGetStats.mockResolvedValueOnce({ success: true, stats: { total_memories: 0, by_category: {} } });

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
      });
    });

    it('should call refresh when button is clicked', async () => {
      mockGetMemories.mockResolvedValue({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValue(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        // There may be multiple "Refresh" elements in the DOM due to icons
        const refreshButtons = screen.getAllByText('Refresh');
        expect(refreshButtons.length).toBeGreaterThan(0);
      });

      // Get all buttons and find the refresh button specifically
      const buttons = screen.getAllByTestId('button');
      const refreshButton = buttons.find(btn => btn.textContent?.includes('Refresh'));

      if (refreshButton) {
        fireEvent.click(refreshButton);
      }

      await waitFor(() => {
        // Should be called twice: once on mount, once on refresh
        expect(mockGetMemories).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ============================================================
  // Delete Individual Memory
  // ============================================================

  describe('Delete individual memory', () => {
    it('should render delete buttons for each memory', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('User prefers Python over JavaScript')).toBeInTheDocument();
      });

      // Find trash icons - one for each memory card plus one for Clear All
      const trashIcons = screen.getAllByTestId('icon-trash');
      expect(trashIcons.length).toBeGreaterThanOrEqual(3); // At least one for each memory
    });

    it('should have delete buttons with icon size variant', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('User prefers Python over JavaScript')).toBeInTheDocument();
      });

      // Find buttons with "icon" size
      const buttons = screen.getAllByTestId('button');
      const iconButtons = buttons.filter(btn => btn.getAttribute('data-size') === 'icon');
      expect(iconButtons.length).toBe(3); // One delete button for each memory
    });

    it('should have delete buttons with ghost variant', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('User prefers Python over JavaScript')).toBeInTheDocument();
      });

      // Find buttons with "ghost" variant
      const buttons = screen.getAllByTestId('button');
      const ghostButtons = buttons.filter(btn => btn.getAttribute('data-variant') === 'ghost');
      expect(ghostButtons.length).toBe(3); // One delete button for each memory
    });
  });

  // ============================================================
  // Delete All Memories
  // ============================================================

  describe('Delete all memories', () => {
    it('should show confirmation dialog content', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Clear all memories?')).toBeInTheDocument();
      });
    });

    it('should delete all memories when confirmed', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);
      mockDeleteAllMemories.mockResolvedValueOnce({ success: true, deleted_count: 3 });

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });

      // Click the Delete All action button
      const deleteAllAction = screen.getByTestId('alert-dialog-action');
      fireEvent.click(deleteAllAction);

      await waitFor(() => {
        expect(mockDeleteAllMemories).toHaveBeenCalled();
      });
    });

    it('should clear memory list after delete all', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);
      mockDeleteAllMemories.mockResolvedValueOnce({ success: true, deleted_count: 3 });

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('User prefers Python over JavaScript')).toBeInTheDocument();
      });

      const deleteAllAction = screen.getByTestId('alert-dialog-action');
      fireEvent.click(deleteAllAction);

      await waitFor(() => {
        expect(screen.queryByText('User prefers Python over JavaScript')).not.toBeInTheDocument();
        expect(screen.getByText('No memories yet')).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // Info Card
  // ============================================================

  describe('Info card', () => {
    it('should display info card with description', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/automatically remembers key facts/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // Category Stats
  // ============================================================

  describe('Category stats', () => {
    it('should display category breakdown when stats exist', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Memories by Category')).toBeInTheDocument();
      });
    });

    it('should not display category section when no categories', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: [], count: 0 });
      mockGetStats.mockResolvedValueOnce({ success: true, stats: { total_memories: 0, by_category: {} } });

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.queryByText('Memories by Category')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // Icons
  // ============================================================

  describe('Icons', () => {
    it('should render Brain icon in header', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getAllByTestId('icon-brain').length).toBeGreaterThan(0);
      });
    });

    it('should render Info icon', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('icon-info')).toBeInTheDocument();
      });
    });

    it('should render Refresh icon', async () => {
      mockGetMemories.mockResolvedValueOnce({ success: true, data: mockMemories, count: 3 });
      mockGetStats.mockResolvedValueOnce(mockStatsResponse);

      render(<MemoryPage />);

      await waitFor(() => {
        const refreshIcons = screen.getAllByTestId('icon-refresh');
        expect(refreshIcons.length).toBeGreaterThan(0);
      });
    });
  });
});
