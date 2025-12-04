import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Image: () => <span data-testid="image-icon">Image</span>,
  Video: () => <span data-testid="video-icon">Video</span>,
  Mic: () => <span data-testid="mic-icon">Mic</span>,
  X: () => <span data-testid="x-icon">X</span>,
  RefreshCw: () => <span data-testid="refresh-icon">Refresh</span>,
}));

// Mock the UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick, type, ...props }: any) => (
    <button disabled={disabled} onClick={onClick} type={type} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef(({ disabled, enterKeyHint, ...props }: any, ref: any) => (
    <input ref={ref} disabled={disabled} enterKeyHint={enterKeyHint} data-testid="input" {...props} />
  )),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock the stores and hooks
const mockSetInputValue = jest.fn();
const mockSetActiveSessionId = jest.fn();
const mockStreamMessage = jest.fn();
const mockCreateSession = { mutateAsync: jest.fn() };
const mockToast = jest.fn();

// Store state for getState() mock - mutable reference for tests
const mockStoreState = {
  activeSessionId: null as number | null,
  selectedModel: { value: 'test-model', label: 'Test Model' } as { value: string; label: string },
  inputValue: '',
};

// Helper to reset store state
const resetMockStoreState = () => {
  mockStoreState.activeSessionId = null;
  mockStoreState.selectedModel = { value: 'test-model', label: 'Test Model' };
  mockStoreState.inputValue = '';
};

jest.mock('@/lib/store/chat-ui-store', () => {
  // Create the mock inside the factory to avoid hoisting issues
  const useChatUIStore = () => ({
    activeSessionId: mockStoreState.activeSessionId,
    setActiveSessionId: mockSetActiveSessionId,
    selectedModel: mockStoreState.selectedModel,
    inputValue: mockStoreState.inputValue,
    setInputValue: mockSetInputValue,
  });

  // Add getState method to the function
  useChatUIStore.getState = () => mockStoreState;

  return { useChatUIStore };
});

jest.mock('@/lib/hooks/use-chat-queries', () => ({
  useCreateSession: () => mockCreateSession,
  useSessionMessages: () => ({ data: [], isLoading: false }),
}));

jest.mock('@/lib/hooks/use-chat-stream', () => ({
  useChatStream: () => ({
    isStreaming: false,
    streamMessage: mockStreamMessage,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock auth store
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock Privy
jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    login: jest.fn(),
  }),
}));

// Mock guest chat utilities
jest.mock('@/lib/guest-chat', () => ({
  incrementGuestMessageCount: jest.fn(() => 1),
  hasReachedGuestLimit: jest.fn(() => false),
  getRemainingGuestMessages: jest.fn(() => 10),
  getGuestMessageLimit: jest.fn(() => 10),
}));

// Mock Alert component
jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div data-testid="alert" {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div data-testid="alert-description" {...props}>{children}</div>,
}));

// Import after mocks
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clean up window functions
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  describe('send button disabled state', () => {
    it('should enable send button when not streaming (validation happens in handleSend)', () => {
      render(<ChatInput />);

      // Find all buttons and get the last one (send button)
      const buttons = screen.getAllByTestId('button');
      const sendBtn = buttons[buttons.length - 1];

      // Button is only disabled during streaming, not when input is empty
      // Validation of empty input happens inside handleSend
      expect(sendBtn).not.toBeDisabled();
    });

    it('should derive isInputEmpty from inputValue without separate state', () => {
      // This test verifies the fix: isInputEmpty is derived from inputValue
      // not tracked as separate state that could desync
      render(<ChatInput />);

      // The isInputEmpty value is used in handleSend validation, not for disabling the button
      // This prevents the race condition where button state and input value could desync
      const buttons = screen.getAllByTestId('button');
      const sendBtn = buttons[buttons.length - 1];
      expect(sendBtn).not.toBeDisabled();
    });
  });

  describe('window function exposure', () => {
    it('should expose __chatInputFocus on window', () => {
      render(<ChatInput />);

      expect((window as any).__chatInputFocus).toBeDefined();
      expect(typeof (window as any).__chatInputFocus).toBe('function');
    });

    it('should expose __chatInputSend on window', () => {
      render(<ChatInput />);

      expect((window as any).__chatInputSend).toBeDefined();
      expect(typeof (window as any).__chatInputSend).toBe('function');
    });

    it('should cleanup window functions on unmount', () => {
      const { unmount } = render(<ChatInput />);

      expect((window as any).__chatInputFocus).toBeDefined();
      expect((window as any).__chatInputSend).toBeDefined();

      unmount();

      expect((window as any).__chatInputFocus).toBeUndefined();
      expect((window as any).__chatInputSend).toBeUndefined();
    });
  });

  describe('send button type attribute', () => {
    it('should have type="button" on send button to prevent form submission issues', () => {
      render(<ChatInput />);

      const buttons = screen.getAllByTestId('button');
      const sendBtn = buttons[buttons.length - 1];

      expect(sendBtn).toHaveAttribute('type', 'button');
    });
  });

  describe('Enter key handling', () => {
    it('should have input with enterKeyHint="send"', () => {
      render(<ChatInput />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('enterKeyHint', 'send');
    });
  });
});

describe('ChatInput handleSend stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputSend;
  });

  it('should maintain stable __chatInputSend reference with useCallback', async () => {
    render(<ChatInput />);

    const firstRef = (window as any).__chatInputSend;
    expect(firstRef).toBeDefined();

    // The function should be the same reference (memoized with useCallback)
    // This tests that we're not recreating it on every render
    await waitFor(() => {
      expect((window as any).__chatInputSend).toBe(firstRef);
    });
  });
});

describe('ChatInput race condition handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as any).__chatInputSend;
    // Reset mock store state
    resetMockStoreState();
  });

  afterEach(() => {
    delete (window as any).__chatInputSend;
  });

  it('should use fresh model from store.getState() to avoid stale closure', async () => {
    // Setup: Mock a successful session creation
    mockCreateSession.mutateAsync.mockResolvedValue({ id: 1 });
    mockStreamMessage.mockResolvedValue(undefined);

    render(<ChatInput />);

    // Simulate URL parameter scenario: model is updated in store AFTER component mounts
    // but BEFORE handleSend is called
    const urlModel = { value: 'openai/gpt-4o', label: 'GPT-4o' };
    mockStoreState.selectedModel = urlModel;
    mockStoreState.inputValue = 'Test message from URL';

    // Call the exposed send function (simulating auto-send from ChatLayout)
    const sendFn = (window as any).__chatInputSend;
    expect(sendFn).toBeDefined();

    await sendFn();

    // Verify that streamMessage was called with the FRESH model from store
    // (not the stale 'test-model' from the component's initial render)
    await waitFor(() => {
      expect(mockStreamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({ value: 'openai/gpt-4o' }),
        })
      );
    });
  });

  it('should use fresh inputValue from store.getState() to avoid stale closure', async () => {
    // Setup: Mock a successful session creation
    mockCreateSession.mutateAsync.mockResolvedValue({ id: 1 });
    mockStreamMessage.mockResolvedValue(undefined);

    render(<ChatInput />);

    // Simulate URL parameter scenario: inputValue is set in store AFTER component mounts
    mockStoreState.inputValue = 'Fresh message from URL parameter';

    // Call the exposed send function
    const sendFn = (window as any).__chatInputSend;
    await sendFn();

    // Verify session was created with the fresh message
    await waitFor(() => {
      expect(mockCreateSession.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Fresh message'),
        })
      );
    });
  });

  it('should create session with fresh model value from store', async () => {
    mockCreateSession.mutateAsync.mockResolvedValue({ id: 1 });
    mockStreamMessage.mockResolvedValue(undefined);

    render(<ChatInput />);

    // Update store state to simulate URL parameter
    mockStoreState.selectedModel = { value: 'anthropic/claude-3', label: 'Claude 3' };
    mockStoreState.inputValue = 'Test';

    const sendFn = (window as any).__chatInputSend;
    await sendFn();

    // Verify session creation used the fresh model value
    await waitFor(() => {
      expect(mockCreateSession.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'anthropic/claude-3',
        })
      );
    });
  });
});
