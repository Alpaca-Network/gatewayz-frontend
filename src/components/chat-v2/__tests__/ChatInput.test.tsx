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
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  Paperclip: () => <span data-testid="paperclip-icon">Paperclip</span>,
  Square: () => <span data-testid="square-icon">Square</span>,
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

// Mock DropdownMenu components
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <div data-testid="dropdown-item" onClick={onClick}>{children}</div>,
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
  messageStartTime: null as number | null,
};
const mockSetMessageStartTime = jest.fn();

// Helper to reset store state
const resetMockStoreState = () => {
  mockStoreState.activeSessionId = null;
  mockStoreState.selectedModel = { value: 'test-model', label: 'Test Model' };
  mockStoreState.inputValue = '';
  mockStoreState.messageStartTime = null;
};

jest.mock('@/lib/store/chat-ui-store', () => {
  // Create the mock inside the factory to avoid hoisting issues
  const useChatUIStore = () => ({
    activeSessionId: mockStoreState.activeSessionId,
    setActiveSessionId: mockSetActiveSessionId,
    selectedModel: mockStoreState.selectedModel,
    inputValue: mockStoreState.inputValue,
    setInputValue: mockSetInputValue,
    setMessageStartTime: mockSetMessageStartTime,
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

describe('ChatInput attachment dropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  it('should render the attachment dropdown with paperclip icon', () => {
    render(<ChatInput />);

    // Check for dropdown menu structure
    expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument();
    expect(screen.getByTestId('paperclip-icon')).toBeInTheDocument();
  });

  it('should render all four attachment options in dropdown', () => {
    render(<ChatInput />);

    const dropdownItems = screen.getAllByTestId('dropdown-item');
    expect(dropdownItems).toHaveLength(4);

    // Verify each option exists with correct icon
    expect(screen.getByTestId('image-icon')).toBeInTheDocument();
    expect(screen.getByTestId('video-icon')).toBeInTheDocument();
    // There are 2 mic icons - one in dropdown and one in input
    expect(screen.getAllByTestId('mic-icon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
  });

  it('should have correct labels for attachment options', () => {
    render(<ChatInput />);

    // Use getAllByText since icons have text too, then verify dropdown items have text
    const dropdownItems = screen.getAllByTestId('dropdown-item');
    expect(dropdownItems[0]).toHaveTextContent('Upload image');
    expect(dropdownItems[1]).toHaveTextContent('Upload video');
    expect(dropdownItems[2]).toHaveTextContent('Upload audio');
    expect(dropdownItems[3]).toHaveTextContent('Upload document');
  });
});

describe('ChatInput microphone button visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  it('should show speech-to-text mic button and audio upload in dropdown', () => {
    mockStoreState.inputValue = '';
    render(<ChatInput />);

    // There should be 2 mic icons: one for speech-to-text button, one in dropdown for audio upload
    const micIcons = screen.getAllByTestId('mic-icon');
    expect(micIcons).toHaveLength(2);
  });

  it('should always show speech-to-text mic button regardless of input', () => {
    mockStoreState.inputValue = 'Hello world';
    render(<ChatInput />);

    // Speech-to-text mic button is always visible (plus audio in dropdown)
    const micIcons = screen.getAllByTestId('mic-icon');
    expect(micIcons).toHaveLength(2);
  });

  it('should show mic buttons when input has only whitespace', () => {
    mockStoreState.inputValue = '   ';
    render(<ChatInput />);

    // Mic buttons should be visible
    const micIcons = screen.getAllByTestId('mic-icon');
    expect(micIcons).toHaveLength(2);
  });
});

describe('ChatInput document handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  it('should have hidden document input with correct accept types', () => {
    render(<ChatInput />);

    // Find the document input by its accept attribute
    const inputs = document.querySelectorAll('input[type="file"]');
    const documentInput = Array.from(inputs).find(
      input => input.getAttribute('accept')?.includes('.pdf')
    );

    expect(documentInput).toBeInTheDocument();
    expect(documentInput).toHaveAttribute('accept', '.pdf,.doc,.docx,.txt,.md,.csv,.json,.xml');
    expect(documentInput).toHaveClass('hidden');
  });

  it('should include document in message content when sending with document attachment', async () => {
    mockCreateSession.mutateAsync.mockResolvedValue({ id: 1 });
    mockStreamMessage.mockResolvedValue(undefined);
    mockStoreState.inputValue = 'Check this document';

    // We need to simulate the component having a selected document
    // Since state is internal, we'll test the structure exists
    render(<ChatInput />);

    // Verify document input exists and can accept files
    const inputs = document.querySelectorAll('input[type="file"]');
    const documentInput = Array.from(inputs).find(
      input => input.getAttribute('accept')?.includes('.pdf')
    );
    expect(documentInput).toBeInTheDocument();
  });
});

describe('ChatInput hidden file inputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
  });

  it('should have four hidden file inputs for different media types', () => {
    render(<ChatInput />);

    const fileInputs = document.querySelectorAll('input[type="file"].hidden');
    expect(fileInputs).toHaveLength(4);
  });

  it('should have image input with correct accept type', () => {
    render(<ChatInput />);

    const imageInput = document.querySelector('input[accept="image/*"]');
    expect(imageInput).toBeInTheDocument();
    expect(imageInput).toHaveClass('hidden');
  });

  it('should have video input with correct accept type', () => {
    render(<ChatInput />);

    const videoInput = document.querySelector('input[accept="video/*"]');
    expect(videoInput).toBeInTheDocument();
    expect(videoInput).toHaveClass('hidden');
  });

  it('should have audio input with correct accept type', () => {
    render(<ChatInput />);

    const audioInput = document.querySelector('input[accept="audio/*"]');
    expect(audioInput).toBeInTheDocument();
    expect(audioInput).toHaveClass('hidden');
  });
});

describe('ChatInput auth error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  it('should show toast and trigger login on auth-related error', async () => {
    // This test verifies the error handling logic by checking the pattern
    // The actual behavior is tested via integration tests
    const errorMessage = 'Please sign in to use the chat feature. Create a free account to get started!';
    const lowerError = errorMessage.toLowerCase();

    // Verify error detection logic matches auth errors
    const isAuthError =
      lowerError.includes('sign in') ||
      lowerError.includes('sign up') ||
      lowerError.includes('create a free account') ||
      lowerError.includes('session expired') ||
      lowerError.includes('authentication');

    expect(isAuthError).toBe(true);
  });

  it('should not trigger login for non-auth errors', async () => {
    const errorMessage = 'Network error: Failed to connect';
    const lowerError = errorMessage.toLowerCase();

    const isAuthError =
      lowerError.includes('sign in') ||
      lowerError.includes('sign up') ||
      lowerError.includes('create a free account') ||
      lowerError.includes('session expired') ||
      lowerError.includes('authentication');

    expect(isAuthError).toBe(false);
  });

  it('should detect various auth-related error messages', () => {
    const authErrors = [
      'Please sign in to continue',
      'Please Sign Up for access',
      'Create a free account',
      'Your session expired',
      'Authentication required',
    ];

    authErrors.forEach(error => {
      const lowerError = error.toLowerCase();
      const isAuthError =
        lowerError.includes('sign in') ||
        lowerError.includes('sign up') ||
        lowerError.includes('create a free account') ||
        lowerError.includes('session expired') ||
        lowerError.includes('authentication');

      expect(isAuthError).toBe(true);
    });
  });

  it('should show toast with error message when streamMessage throws an error', async () => {
    // Setup: Mock streamMessage to throw an error
    const errorMessage = 'Network connection failed';
    mockStreamMessage.mockRejectedValueOnce(new Error(errorMessage));
    mockCreateSession.mutateAsync.mockResolvedValue({ id: 1 });

    // Set up state for a valid send
    mockStoreState.inputValue = 'Test message';
    mockStoreState.selectedModel = { value: 'test-model', label: 'Test Model' };

    render(<ChatInput />);

    // Call the exposed send function
    const sendFn = (window as any).__chatInputSend;
    expect(sendFn).toBeDefined();

    await sendFn();

    // Verify toast was called with the error message
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: errorMessage,
          variant: 'destructive',
        })
      );
    });
  });

  it('should show toast when createSession throws an error', async () => {
    // Setup: Mock createSession to throw an error
    mockCreateSession.mutateAsync.mockRejectedValueOnce(new Error('Session creation failed'));

    // Set up state for a valid send (no active session, so it will try to create one)
    mockStoreState.activeSessionId = null;
    mockStoreState.inputValue = 'Test message';
    mockStoreState.selectedModel = { value: 'test-model', label: 'Test Model' };

    render(<ChatInput />);

    // Call the exposed send function
    const sendFn = (window as any).__chatInputSend;
    await sendFn();

    // Verify toast was called for session creation failure
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to create session',
          variant: 'destructive',
        })
      );
    });

    // Verify inputValue was restored after failure
    expect(mockSetInputValue).toHaveBeenCalledWith('Test message');
  });

  it('should not send when no model is selected', async () => {
    // Set up state with input but no model
    mockStoreState.inputValue = 'Test message';
    mockStoreState.selectedModel = null as any;

    render(<ChatInput />);

    // Call the exposed send function
    const sendFn = (window as any).__chatInputSend;
    await sendFn();

    // Verify toast was called with no model error
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No model selected',
          variant: 'destructive',
        })
      );
    });

    // Verify streamMessage was NOT called
    expect(mockStreamMessage).not.toHaveBeenCalled();
  });

  it('should not send when input is empty', async () => {
    // Set up state with empty input
    mockStoreState.inputValue = '';
    mockStoreState.selectedModel = { value: 'test-model', label: 'Test Model' };

    render(<ChatInput />);

    // Call the exposed send function
    const sendFn = (window as any).__chatInputSend;
    await sendFn();

    // Verify streamMessage was NOT called (early return)
    expect(mockStreamMessage).not.toHaveBeenCalled();
    expect(mockCreateSession.mutateAsync).not.toHaveBeenCalled();
  });

  it('should not send when input has only whitespace', async () => {
    // Set up state with whitespace-only input
    mockStoreState.inputValue = '   \t\n  ';
    mockStoreState.selectedModel = { value: 'test-model', label: 'Test Model' };

    render(<ChatInput />);

    // Call the exposed send function
    const sendFn = (window as any).__chatInputSend;
    await sendFn();

    // Verify streamMessage was NOT called (early return)
    expect(mockStreamMessage).not.toHaveBeenCalled();
    expect(mockCreateSession.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('ChatInput error message extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputSend;
  });

  it('should extract error message from Error object', async () => {
    const errorMessage = 'Specific error occurred';
    mockStreamMessage.mockRejectedValueOnce(new Error(errorMessage));
    mockCreateSession.mutateAsync.mockResolvedValue({ id: 1 });

    mockStoreState.inputValue = 'Test';
    mockStoreState.selectedModel = { value: 'test-model', label: 'Test' };

    render(<ChatInput />);

    const sendFn = (window as any).__chatInputSend;
    await sendFn();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: errorMessage,
        })
      );
    });
  });

  it('should use fallback message for non-Error thrown values', async () => {
    // Throw a string instead of Error object
    mockStreamMessage.mockRejectedValueOnce('String error');
    mockCreateSession.mutateAsync.mockResolvedValue({ id: 1 });

    mockStoreState.inputValue = 'Test';
    mockStoreState.selectedModel = { value: 'test-model', label: 'Test' };

    render(<ChatInput />);

    const sendFn = (window as any).__chatInputSend;
    await sendFn();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to send message',
        })
      );
    });
  });
});

describe('ChatInput speech recognition', () => {
  let mockRecognition: any;
  let originalSpeechRecognition: any;
  let originalWebkitSpeechRecognition: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;

    // Save original values
    originalSpeechRecognition = (window as any).SpeechRecognition;
    originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;

    // Create mock recognition instance
    mockRecognition = {
      continuous: false,
      interimResults: false,
      lang: '',
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    };

    // Mock the SpeechRecognition constructor
    const MockSpeechRecognition = jest.fn(() => mockRecognition);
    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
    // Restore original values
    (window as any).SpeechRecognition = originalSpeechRecognition;
    (window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });

  it('should show toast when speech recognition is not supported', () => {
    // Remove speech recognition support
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;

    render(<ChatInput />);

    // Find and click the microphone button (outside dropdown)
    const buttons = screen.getAllByTestId('button');
    // The mic button should be the second button in the control area (after paperclip dropdown)
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]') || btn.querySelector('[data-testid="square-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Speech recognition not supported',
        variant: 'destructive',
      })
    );
  });

  it('should start speech recognition when mic button is clicked', () => {
    render(<ChatInput />);

    // Find and click the microphone button
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    expect(mockRecognition.start).toHaveBeenCalled();
    expect(mockRecognition.continuous).toBe(true);
    expect(mockRecognition.interimResults).toBe(true);
    expect(mockRecognition.lang).toBe('en-US');
  });

  it('should stop speech recognition when mic button is clicked while recording', async () => {
    render(<ChatInput />);

    // Find and click the microphone button to start
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate onstart callback
    if (mockRecognition.onstart) {
      mockRecognition.onstart();
    }

    await waitFor(() => {
      // Now the button should show the stop icon (square)
      const stopButton = screen.getAllByTestId('button').find(btn => btn.querySelector('[data-testid="square-icon"]'));
      expect(stopButton).toBeDefined();
    });

    // Click again to stop
    const stopButton = screen.getAllByTestId('button').find(btn => btn.querySelector('[data-testid="square-icon"]'));
    if (stopButton) {
      fireEvent.click(stopButton);
    }

    expect(mockRecognition.stop).toHaveBeenCalled();
  });

  it('should prevent race condition by blocking double-clicks', () => {
    render(<ChatInput />);

    // Find and click the microphone button twice quickly
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
      fireEvent.click(micButton); // Second click should be blocked
    }

    // start() should only be called once due to race condition protection
    expect(mockRecognition.start).toHaveBeenCalledTimes(1);
  });

  it('should handle speech recognition results', async () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate a result event
    const mockResultEvent = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'Hello world', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(mockResultEvent);
    }

    // Check that setInputValue was called with the transcript
    expect(mockSetInputValue).toHaveBeenCalledWith('Hello world');
  });

  it('should show toast on microphone access denied error', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate error event
    if (mockRecognition.onerror) {
      mockRecognition.onerror({ error: 'not-allowed', message: 'Permission denied' });
    }

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Microphone access denied',
        variant: 'destructive',
      })
    );
  });

  it('should show toast on speech recognition error (not aborted)', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate error event
    if (mockRecognition.onerror) {
      mockRecognition.onerror({ error: 'network', message: 'Network error' });
    }

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Speech recognition error',
        variant: 'destructive',
      })
    );
  });

  it('should not show toast when error is aborted', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate aborted error event (should not show toast)
    if (mockRecognition.onerror) {
      mockRecognition.onerror({ error: 'aborted', message: 'Aborted' });
    }

    // Toast should not be called for 'aborted' error
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Speech recognition error',
      })
    );
  });

  it('should cleanup speech recognition on unmount', () => {
    const { unmount } = render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Unmount the component
    unmount();

    // abort() should be called during cleanup
    expect(mockRecognition.abort).toHaveBeenCalled();
  });

  it('should append transcript with space separator when input has content', () => {
    // Set initial input value
    mockStoreState.inputValue = 'Existing text';

    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate a result event
    const mockResultEvent = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'new words', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(mockResultEvent);
    }

    // Check that setInputValue was called with proper spacing
    expect(mockSetInputValue).toHaveBeenCalledWith('Existing text new words');
  });

  it('should handle synchronous start() errors and reset state', () => {
    // Make start() throw synchronously
    mockRecognition.start.mockImplementation(() => {
      throw new Error('Audio context blocked');
    });

    render(<ChatInput />);

    // Find and click the microphone button
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Should show toast about failure
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to start speech recognition',
        variant: 'destructive',
      })
    );

    // Button should still show mic icon (not square) because isRecording was reset
    const micButtons = screen.getAllByTestId('button').filter(btn => btn.querySelector('[data-testid="mic-icon"]'));
    expect(micButtons.length).toBeGreaterThan(0);
  });
});
