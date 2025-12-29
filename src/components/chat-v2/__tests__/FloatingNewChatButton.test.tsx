import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock next/navigation - declare mocks before jest.mock() for proper hoisting
const mockPush = jest.fn();
const mockUsePathname = jest.fn(() => '/');

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockUsePathname(),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="floating-button" {...props}>
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Plus: () => <span data-testid="plus-icon">Plus</span>,
}));

// Mock the stores and hooks
const mockSetActiveSessionId = jest.fn();
const mockCreateSessionMutateAsync = jest.fn();

jest.mock('@/lib/store/chat-ui-store', () => ({
  useChatUIStore: () => ({
    activeSessionId: null,
    setActiveSessionId: mockSetActiveSessionId,
    selectedModel: { value: 'test-model', label: 'Test Model' },
  }),
}));

jest.mock('@/lib/hooks/use-chat-queries', () => ({
  useCreateSession: () => ({
    mutateAsync: mockCreateSessionMutateAsync,
    isPending: false,
  }),
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Import after mocks
import { FloatingNewChatButton } from '../FloatingNewChatButton';

describe('FloatingNewChatButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSessionMutateAsync.mockResolvedValue({ id: 123, title: 'Untitled Chat' });
    mockUsePathname.mockReturnValue('/');
  });

  describe('Rendering', () => {
    it('should render the floating button', () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      expect(button).toBeInTheDocument();
    });

    it('should not render on /chat page', () => {
      mockUsePathname.mockReturnValue('/chat');

      const { container } = render(<FloatingNewChatButton />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('floating-button')).not.toBeInTheDocument();
    });

    it('should render the Plus icon', () => {
      render(<FloatingNewChatButton />);

      const icon = screen.getByTestId('plus-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper ARIA label', () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByLabelText('Create new chat');
      expect(button).toBeInTheDocument();
    });

    it('should have proper title attribute', () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTitle('New Chat');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Functionality', () => {
    it('should create a new session when clicked', async () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockCreateSessionMutateAsync).toHaveBeenCalledWith({
          title: 'Untitled Chat',
          model: 'test-model',
        });
      });
    });

    it('should set active session ID after creating session', async () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockSetActiveSessionId).toHaveBeenCalledWith(123);
      });
    });

    it('should navigate to /chat when clicked', async () => {
      // Mock pathname as not /chat
      mockUsePathname.mockReturnValue('/settings');

      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when session creation fails', async () => {
      mockCreateSessionMutateAsync.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Unable to start a new chat',
          description: 'Please try again in a moment.',
          variant: 'destructive',
        });
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create new chat:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should not navigate on error', async () => {
      mockCreateSessionMutateAsync.mockRejectedValue(new Error('Network error'));

      jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // Should not navigate since session creation failed
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockSetActiveSessionId).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable button when session creation is pending', () => {
      // Mock isPending as true
      const useChatQueriesMock = jest.spyOn(require('@/lib/hooks/use-chat-queries'), 'useCreateSession');
      useChatQueriesMock.mockReturnValue({
        mutateAsync: mockCreateSessionMutateAsync,
        isPending: true,
      });

      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      expect(button).toBeDisabled();

      // Restore the original mock
      useChatQueriesMock.mockRestore();
    });

    it('should enable button when session creation is not pending', () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('CSS Classes', () => {
    it('should have mobile-only visibility class (lg:hidden)', () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      expect(button.className).toContain('lg:hidden');
    });

    it('should have fixed positioning classes', () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      expect(button.className).toContain('fixed');
      expect(button.className).toContain('bottom-6');
      expect(button.className).toContain('right-6');
    });

    it('should have high z-index for layering', () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      expect(button.className).toContain('z-[9999]');
    });
  });

  describe('Multiple Clicks', () => {
    it('should handle multiple rapid clicks gracefully', async () => {
      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');

      // Simulate rapid clicks
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Should still only create one session per click
      await waitFor(() => {
        expect(mockCreateSessionMutateAsync).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Integration with selectedModel', () => {
    it('should use selectedModel value when creating session', async () => {
      // Mock with different model
      jest.spyOn(require('@/lib/store/chat-ui-store'), 'useChatUIStore').mockReturnValue({
        activeSessionId: null,
        setActiveSessionId: mockSetActiveSessionId,
        selectedModel: { value: 'gpt-4', label: 'GPT-4' },
      });

      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockCreateSessionMutateAsync).toHaveBeenCalledWith({
          title: 'Untitled Chat',
          model: 'gpt-4',
        });
      });
    });

    it('should handle undefined selectedModel', async () => {
      jest.spyOn(require('@/lib/store/chat-ui-store'), 'useChatUIStore').mockReturnValue({
        activeSessionId: null,
        setActiveSessionId: mockSetActiveSessionId,
        selectedModel: undefined,
      });

      render(<FloatingNewChatButton />);

      const button = screen.getByTestId('floating-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockCreateSessionMutateAsync).toHaveBeenCalledWith({
          title: 'Untitled Chat',
          model: undefined,
        });
      });
    });
  });
});
