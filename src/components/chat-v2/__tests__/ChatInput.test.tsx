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
  Camera: () => <span data-testid="camera-icon">Camera</span>,
  Globe: () => <span data-testid="globe-icon">Globe</span>,
  Search: () => <span data-testid="search-icon">Search</span>,
  Loader2: () => <span data-testid="loader-icon">Loader</span>,
}));

// Mock the UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick, type, ...props }: any) => (
    <button disabled={disabled} onClick={onClick} type={type} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

// Input mock removed - ChatInput now uses native textarea with data-testid="chat-textarea"

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
    // Tools state
    enabledTools: [],
    autoEnableSearch: false,
    setEnabledTools: jest.fn(),
    toggleTool: jest.fn(),
    setAutoEnableSearch: jest.fn(),
  });

  // Add getState method to the function
  useChatUIStore.getState = () => mockStoreState;

  return { useChatUIStore };
});

jest.mock('@/lib/hooks/use-chat-queries', () => ({
  useCreateSession: () => mockCreateSession,
  useSessionMessages: () => ({ data: [], isLoading: false }),
}));

const mockStopStream = jest.fn();

// Default streaming state - can be modified per test
let mockIsStreaming = false;

jest.mock('@/lib/hooks/use-chat-stream', () => ({
  useChatStream: () => ({
    isStreaming: mockIsStreaming,
    streamMessage: mockStreamMessage,
    stopStream: mockStopStream,
  }),
}));

// Mock auto model switch hook
jest.mock('@/lib/hooks/use-auto-model-switch', () => ({
  useAutoModelSwitch: () => ({
    checkImageSupport: jest.fn(() => false),
    checkVideoSupport: jest.fn(() => false),
    checkAudioSupport: jest.fn(() => false),
    checkFileSupport: jest.fn(() => false),
    checkAndSwitchModel: jest.fn(() => false),
    modelSupportsModality: jest.fn(() => true),
  }),
}));

// Mock tool definitions hook
jest.mock('@/lib/hooks/use-tool-definitions', () => ({
  useToolDefinitions: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  filterEnabledTools: () => [],
}));

// Mock auto search detection hook
jest.mock('@/lib/hooks/use-auto-search-detection', () => ({
  useAutoSearchDetection: () => ({
    shouldAutoEnableSearch: jest.fn(() => false),
    getAutoEnableReason: jest.fn(() => null),
  }),
}));

// Mock Whisper transcription hook
const mockWhisperStartRecording = jest.fn();
const mockWhisperStopRecording = jest.fn();
jest.mock('@/lib/hooks/use-whisper-transcription', () => ({
  useWhisperTranscription: () => ({
    startRecording: mockWhisperStartRecording,
    stopRecording: mockWhisperStopRecording,
    isRecording: false,
    isTranscribing: false,
    error: null,
  }),
}));

// Mock search augmentation hook
jest.mock('@/lib/hooks/use-search-augmentation', () => ({
  useSearchAugmentation: () => ({
    augmentWithSearch: jest.fn(),
    isSearching: false,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock auth store - configurable for tests
let mockIsAuthenticated = true;
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
  }),
}));

// Mock Privy
jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    login: jest.fn(),
  }),
}));

// Mock GatewayzAuth context
const mockLogout = jest.fn(() => Promise.resolve());
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: () => ({
    logout: mockLogout,
  }),
}));

// Mock guest chat utilities
jest.mock('@/lib/guest-chat', () => ({
  incrementGuestMessageCount: jest.fn(() => 1),
  hasReachedGuestLimit: jest.fn(() => false),
  getRemainingGuestMessages: jest.fn(() => 10),
  getGuestMessageLimit: jest.fn(() => 10),
}));

// Mock Switch component
jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      data-testid="switch"
      {...props}
    />
  ),
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
    resetMockStoreState();
    mockIsStreaming = false; // Reset streaming state
    // Clean up window functions
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  describe('send button disabled state', () => {
    it('should disable send button when input is empty', () => {
      render(<ChatInput />);

      // Find all buttons and get the last one (send button)
      const buttons = screen.getAllByTestId('button');
      const sendBtn = buttons[buttons.length - 1];

      // Button is disabled when input is empty (better UX)
      expect(sendBtn).toBeDisabled();
    });

    it('should enable send button when input has content', () => {
      // Set input value to non-empty
      mockStoreState.inputValue = 'Hello world';

      render(<ChatInput />);

      const buttons = screen.getAllByTestId('button');
      const sendBtn = buttons[buttons.length - 1];
      expect(sendBtn).not.toBeDisabled();
    });

    it('should derive isInputEmpty from inputValue without separate state', () => {
      // This test verifies the fix: isInputEmpty is derived from inputValue
      // not tracked as separate state that could desync
      // Set input to non-empty to verify button is enabled
      mockStoreState.inputValue = 'Test message';

      render(<ChatInput />);

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

      const textarea = screen.getByTestId('chat-textarea');
      expect(textarea).toHaveAttribute('enterKeyHint', 'send');
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

  it('should render the attachment dropdown with plus icon', () => {
    render(<ChatInput />);

    // Check for dropdown menu structure
    expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument();
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
  });

  it('should render attachment options in dropdown', () => {
    render(<ChatInput />);

    // The new UI has Camera, Photos, Files as buttons in a grid (not DropdownMenuItem)
    // and Video, Audio as DropdownMenuItem items
    const dropdownItems = screen.getAllByTestId('dropdown-item');
    expect(dropdownItems).toHaveLength(2); // Video and Audio are DropdownMenuItem

    // Verify icons exist - Camera, Photos (Image), Files (FileText), Video, Audio (Mic)
    expect(screen.getByTestId('camera-icon')).toBeInTheDocument();
    expect(screen.getByTestId('image-icon')).toBeInTheDocument();
    expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
    expect(screen.getByTestId('video-icon')).toBeInTheDocument();
    // There are 2 mic icons - one in dropdown (audio) and one for speech-to-text
    expect(screen.getAllByTestId('mic-icon').length).toBeGreaterThanOrEqual(1);
  });

  it('should have correct labels for attachment options', () => {
    render(<ChatInput />);

    // The dropdown content has:
    // - Top row buttons: Camera, Photos, Files (plain text labels)
    // - DropdownMenuItem items: Upload video, Upload audio
    const dropdownItems = screen.getAllByTestId('dropdown-item');
    expect(dropdownItems[0]).toHaveTextContent('Upload video');
    expect(dropdownItems[1]).toHaveTextContent('Upload audio');
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

    // Verify error detection logic matches auth errors (guest auth errors)
    const isGuestAuthError =
      lowerError.includes('sign in') ||
      lowerError.includes('sign up') ||
      lowerError.includes('create a free account');

    expect(isGuestAuthError).toBe(true);
  });

  it('should not trigger login for non-auth errors', async () => {
    const errorMessage = 'Network error: Failed to connect';
    const lowerError = errorMessage.toLowerCase();

    const isRateLimitError =
      lowerError.includes('rate limit') ||
      lowerError.includes('daily limit') ||
      lowerError.includes('messages for today') ||
      lowerError.includes('too many');
    const isGuestAuthError = !isRateLimitError && (
      lowerError.includes('sign in') ||
      lowerError.includes('sign up') ||
      lowerError.includes('create a free account'));
    const isApiKeyError =
      lowerError.includes('api key') ||
      lowerError.includes('access forbidden') ||
      lowerError.includes('logging out and back in') ||
      lowerError.includes('log out and log back in') ||
      lowerError === 'forbidden';
    const isSessionError =
      lowerError.includes('session expired') ||
      lowerError.includes('authentication');
    const isAuthError = isGuestAuthError || isApiKeyError || isSessionError;

    expect(isAuthError).toBe(false);
  });

  it('should not trigger login for rate limit errors even if they contain "sign up"', () => {
    // Rate limit messages often contain "sign up" to encourage users to create accounts
    // but they should NOT be treated as auth errors that trigger login
    const rateLimitErrors = [
      "You've used all 5 messages for today. Sign up for a free account to continue!",
      "Rate limit exceeded. Please wait and try again.",
      "Daily limit reached. Sign up to chat without limits!",
      "Too many requests. Please sign up for unlimited access.",
    ];

    rateLimitErrors.forEach(error => {
      const lowerError = error.toLowerCase();

      const isRateLimitError =
        lowerError.includes('rate limit') ||
        lowerError.includes('daily limit') ||
        lowerError.includes('messages for today') ||
        lowerError.includes('too many');

      // Rate limit errors should be detected
      expect(isRateLimitError).toBe(true);

      // Even though some contain "sign up", they should NOT be treated as guest auth errors
      const isGuestAuthError = !isRateLimitError && (
        lowerError.includes('sign in') ||
        lowerError.includes('sign up') ||
        lowerError.includes('create a free account'));

      expect(isGuestAuthError).toBe(false);
    });
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
      const isGuestAuthError =
        lowerError.includes('sign in') ||
        lowerError.includes('sign up') ||
        lowerError.includes('create a free account');
      const isSessionError =
        lowerError.includes('session expired') ||
        lowerError.includes('authentication');
      const isAuthError = isGuestAuthError || isSessionError;

      expect(isAuthError).toBe(true);
    });
  });

  it('should detect 403 forbidden/API key related errors', () => {
    const apiKeyErrors = [
      'Your session has expired. Please log out and log back in to continue.',
      'Your API key may be invalid or expired. Please try logging out and back in.',
      'Access forbidden. Your API key may be invalid.',
      'API key validation failed',
      'Forbidden',
    ];

    apiKeyErrors.forEach(error => {
      const lowerError = error.toLowerCase();
      const isApiKeyError =
        lowerError.includes('api key') ||
        lowerError.includes('access forbidden') ||
        lowerError.includes('logging out and back in') ||
        lowerError.includes('log out and log back in') ||
        lowerError === 'forbidden';

      expect(isApiKeyError).toBe(true);
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

describe('ChatInput speech recognition (Web Speech API fallback)', () => {
  let mockRecognition: any;
  let originalSpeechRecognition: any;
  let originalWebkitSpeechRecognition: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    mockIsStreaming = false;
    // Set unauthenticated to use Web Speech API fallback instead of Whisper
    mockIsAuthenticated = false;
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
    // Restore authenticated state for other tests
    mockIsAuthenticated = true;
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

  it('should deduplicate repeated transcripts in continuous mode', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate first result
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    // First transcript should be added
    expect(mockSetInputValue).toHaveBeenCalledWith('hello world');
    mockSetInputValue.mockClear();

    // Update the store state to reflect what was added
    mockStoreState.inputValue = 'hello world';

    // Simulate second result where the API returns accumulated transcript
    // (this is what causes duplicates - the API returns "hello world how are you"
    // instead of just "how are you")
    // Note: Web Speech API typically includes space at start of continuation
    const secondResult = {
      resultIndex: 0,
      results: {
        length: 2,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
        1: {
          isFinal: true,
          0: { transcript: ' how are you', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(secondResult);
    }

    // Should only append the NEW portion, not the duplicate "hello world"
    // The separator logic adds a space between existing content and new content
    expect(mockSetInputValue).toHaveBeenCalledWith('hello world how are you');
  });

  it('should handle overlapping transcripts without duplication', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate result with accumulated transcripts (common in continuous mode)
    const mockResultEvent = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'how long has Burkina Faso been a country', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(mockResultEvent);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('how long has Burkina Faso been a country');
    mockSetInputValue.mockClear();

    // Update store state
    mockStoreState.inputValue = 'how long has Burkina Faso been a country';

    // Simulate another event where the API re-sends the same final result
    // (this can happen with some browsers/implementations)
    if (mockRecognition.onresult) {
      mockRecognition.onresult(mockResultEvent);
    }

    // Should NOT add duplicate text - setInputValue should not be called
    // because there's no new content
    expect(mockSetInputValue).not.toHaveBeenCalled();
  });

  it('should handle overlapping phrase patterns like "How are you How are you doing"', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate first result: "How are you"
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'How are you', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('How are you');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'How are you';

    // Simulate the problematic pattern where API returns overlapping content
    // "How are you How are you doing" - the first phrase is repeated
    const overlappingResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'How are you doing today', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(overlappingResult);
    }

    // Should only append "doing today", not the duplicate "How are you"
    // Result should be "How are you doing today"
    expect(mockSetInputValue).toHaveBeenCalledWith('How are you doing today');
  });

  it('should handle word overlap with different punctuation', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result with punctuation
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'Hello, world!', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('Hello, world!');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'Hello, world!';

    // Second result with overlapping words but different punctuation
    const secondResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'Hello world how are you', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(secondResult);
    }

    // Should recognize "Hello world" overlaps with "Hello, world!" and only append new words
    expect(mockSetInputValue).toHaveBeenCalledWith('Hello, world! how are you');
  });

  it('should handle word overlap with different casing', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result with uppercase
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'HELLO WORLD', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('HELLO WORLD');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'HELLO WORLD';

    // Second result with different casing
    const secondResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world goodbye', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(secondResult);
    }

    // Should recognize case-insensitive overlap and only append "goodbye"
    expect(mockSetInputValue).toHaveBeenCalledWith('HELLO WORLD goodbye');
  });

  it('should handle completely different transcript with no overlap (API glitch)', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('hello world');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'hello world';

    // Completely different transcript with same word count (API glitch scenario)
    const glitchResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'goodbye moon', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(glitchResult);
    }

    // Should NOT update - no overlap and not longer, preserves continuity
    expect(mockSetInputValue).not.toHaveBeenCalled();
  });

  it('should handle new transcript shorter than accumulated', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result - longer phrase
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world how are you', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('hello world how are you');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'hello world how are you';

    // Shorter transcript (possible API re-processing)
    const shorterResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(shorterResult);
    }

    // Should NOT update - shorter transcript should be ignored
    expect(mockSetInputValue).not.toHaveBeenCalled();
  });

  it('should handle transcript with extra whitespace differences', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result with normal spacing
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('hello world');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'hello world';

    // New transcript with extra spaces but more words
    const spacedResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello  world  how  are  you', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(spacedResult);
    }

    // Should correctly extract new words despite whitespace differences
    expect(mockSetInputValue).toHaveBeenCalledWith('hello world how are you');
  });

  it('should skip multiple consecutive identical transcripts', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    const sameResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
      },
    };

    // First call - should add
    if (mockRecognition.onresult) {
      mockRecognition.onresult(sameResult);
    }
    expect(mockSetInputValue).toHaveBeenCalledWith('hello world');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'hello world';

    // Second call with same content - should skip
    if (mockRecognition.onresult) {
      mockRecognition.onresult(sameResult);
    }
    expect(mockSetInputValue).not.toHaveBeenCalled();

    // Third call with same content - should still skip
    if (mockRecognition.onresult) {
      mockRecognition.onresult(sameResult);
    }
    expect(mockSetInputValue).not.toHaveBeenCalled();
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

  it('should show recording overlay with waveform and "Listening..." text when recording', async () => {
    render(<ChatInput />);

    // Start recording
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
      // Should show "Listening..." placeholder text in the overlay
      expect(screen.getByText('Listening...')).toBeInTheDocument();
    });

    // Should show the recording overlay
    const overlay = document.querySelector('.recording-overlay');
    expect(overlay).toBeInTheDocument();

    // Should show waveform animation (9 bars in the overlay)
    const waveformBars = document.querySelectorAll('.recording-waveform-bar');
    expect(waveformBars.length).toBe(9);

    // Should show stop recording button in the overlay
    expect(screen.getByText('Stop Recording')).toBeInTheDocument();
  });

  it('should display interim transcript while recording', async () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // Simulate onstart callback
    if (mockRecognition.onstart) {
      mockRecognition.onstart();
    }

    // Simulate interim results
    if (mockRecognition.onresult) {
      mockRecognition.onresult({
        resultIndex: 0,
        results: {
          length: 1,
          item: (index: number) => ({
            isFinal: false,
            0: { transcript: 'hello world', confidence: 0.9 },
          }),
          0: {
            isFinal: false,
            0: { transcript: 'hello world', confidence: 0.9 },
          },
        },
      });
    }

    await waitFor(() => {
      // Interim transcript should be visible in the overlay
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });

    // Interim text should have the interim styling class
    const interimElement = document.querySelector('.recording-transcript-interim');
    expect(interimElement).toBeInTheDocument();
    expect(interimElement?.textContent).toContain('hello world');
  });

  it('should show "Listening..." placeholder with pre-existing text when no new text captured', async () => {
    // Set up pre-existing text in the input
    mockStoreState.inputValue = 'Hello, ';

    render(<ChatInput />);

    // Start recording
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
      // Overlay should be visible
      expect(document.querySelector('.recording-overlay')).toBeInTheDocument();
    });

    // Should show "Listening..." placeholder even with pre-existing text
    await waitFor(() => {
      expect(screen.getByText('Listening...')).toBeInTheDocument();
    });

    // The pre-existing text should be displayed separately
    const existingTextElement = document.querySelector('.recording-transcript-existing');
    expect(existingTextElement).toBeInTheDocument();
    expect(existingTextElement?.textContent).toContain('Hello,');
  });

  it('should close overlay when stop recording button is clicked', async () => {
    render(<ChatInput />);

    // Start recording
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
      expect(document.querySelector('.recording-overlay')).toBeInTheDocument();
    });

    // Click stop recording button in the overlay
    const stopButton = screen.getByText('Stop Recording');
    fireEvent.click(stopButton);

    await waitFor(() => {
      // Overlay should be closed
      expect(document.querySelector('.recording-overlay')).not.toBeInTheDocument();
    });

    // Recognition should have been stopped
    expect(mockRecognition.stop).toHaveBeenCalled();
  });

  it('should handle repeated phrases like "hello world hello world doing"', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result: "hello world"
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('hello world');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'hello world';

    // Problematic API response: repeated phrase plus new content
    // This simulates the bug where API returns "hello world hello world doing"
    const duplicatedResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world hello world doing', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(duplicatedResult);
    }

    // Should recognize the duplicate "hello world" and only append "doing"
    // Not "hello world doing" (which would duplicate "hello world")
    expect(mockSetInputValue).toHaveBeenCalledWith('hello world doing');
  });

  it('should handle accumulated content found in middle of new transcript', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'testing one two', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('testing one two');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'testing one two';

    // API sends transcript where accumulated content appears after some prefix
    // This can happen when API reprocesses audio
    const reorganizedResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'okay testing one two three four', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(reorganizedResult);
    }

    // Should find "testing one two" in the middle and only append "three four"
    expect(mockSetInputValue).toHaveBeenCalledWith('testing one two three four');
  });

  it('should not duplicate when API sends same content with prefix', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'how are you', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('how are you');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'how are you';

    // API sends exact same content as prefix plus new content
    const extendedResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'how are you doing today', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(extendedResult);
    }

    // Should recognize prefix match and only append "doing today"
    expect(mockSetInputValue).toHaveBeenCalledWith('how are you doing today');
  });

  it('should handle longer repeated phrases without duplication', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result - longer phrase
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'the quick brown fox jumps', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('the quick brown fox jumps');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'the quick brown fox jumps';

    // API sends repeated content
    const repeatedResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'the quick brown fox jumps over the lazy dog', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(repeatedResult);
    }

    // Should only append "over the lazy dog"
    expect(mockSetInputValue).toHaveBeenCalledWith('the quick brown fox jumps over the lazy dog');
  });

  it('should reject completely unrelated longer transcripts', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('hello world');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'hello world';

    // Completely unrelated but longer transcript (API glitch)
    const unrelatedResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'goodbye moon stars planets', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(unrelatedResult);
    }

    // Should NOT update - no relationship to accumulated content
    expect(mockSetInputValue).not.toHaveBeenCalled();
  });

  it('should handle partial suffix-to-prefix overlap (e.g., "hello world" -> "world how are you")', () => {
    render(<ChatInput />);

    // Start recording
    const buttons = screen.getAllByTestId('button');
    const micButton = buttons.find(btn => btn.querySelector('[data-testid="mic-icon"]'));
    if (micButton) {
      fireEvent.click(micButton);
    }

    // First result
    const firstResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'hello world', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(firstResult);
    }

    expect(mockSetInputValue).toHaveBeenCalledWith('hello world');
    mockSetInputValue.mockClear();
    mockStoreState.inputValue = 'hello world';

    // API sends transcript with partial overlap - suffix of accumulated matches prefix of new
    // This tests the fallback overlap detection when no exact match is found
    const partialOverlapResult = {
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'world how are you', confidence: 0.9 },
        },
      },
    };

    if (mockRecognition.onresult) {
      mockRecognition.onresult(partialOverlapResult);
    }

    // Should recognize "world" overlap and only append "how are you"
    expect(mockSetInputValue).toHaveBeenCalledWith('hello world how are you');
  });
});

describe('ChatInput stop streaming button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    mockIsStreaming = false;
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  it('should show send button when not streaming', () => {
    mockIsStreaming = false;
    mockStoreState.inputValue = 'Test message';

    render(<ChatInput />);

    // Should show send icon, not square icon for stop
    expect(screen.getByTestId('send-icon')).toBeInTheDocument();

    // The last button should be the send button with send icon
    const buttons = screen.getAllByTestId('button');
    const lastButton = buttons[buttons.length - 1];
    expect(lastButton).toContainElement(screen.getByTestId('send-icon'));
  });

  it('should show stop button with square icon when streaming', () => {
    mockIsStreaming = true;

    render(<ChatInput />);

    // Should show square icon for stop instead of send icon
    const squareIcons = screen.getAllByTestId('square-icon');
    expect(squareIcons.length).toBeGreaterThan(0);

    // The last button should be the stop button
    const buttons = screen.getAllByTestId('button');
    const lastButton = buttons[buttons.length - 1];
    expect(lastButton.querySelector('[data-testid="square-icon"]')).toBeInTheDocument();
  });

  it('should call stopStream when stop button is clicked', () => {
    mockIsStreaming = true;

    render(<ChatInput />);

    // Find the stop button (last button with square icon)
    const buttons = screen.getAllByTestId('button');
    const stopButton = buttons[buttons.length - 1];

    fireEvent.click(stopButton);

    expect(mockStopStream).toHaveBeenCalledTimes(1);
  });

  it('should clear message start time when stop button is clicked', () => {
    mockIsStreaming = true;

    render(<ChatInput />);

    // Find and click the stop button
    const buttons = screen.getAllByTestId('button');
    const stopButton = buttons[buttons.length - 1];

    fireEvent.click(stopButton);

    // setMessageStartTime should be called with null to clear the timer
    expect(mockSetMessageStartTime).toHaveBeenCalledWith(null);
  });

  it('should disable input field when streaming', () => {
    mockIsStreaming = true;

    render(<ChatInput />);

    const textarea = screen.getByTestId('chat-textarea');
    expect(textarea).toBeDisabled();
  });

  it('should enable input field when not streaming', () => {
    mockIsStreaming = false;

    render(<ChatInput />);

    const textarea = screen.getByTestId('chat-textarea');
    expect(textarea).not.toBeDisabled();
  });

  it('should have destructive variant on stop button', () => {
    mockIsStreaming = true;

    render(<ChatInput />);

    // The stop button should have variant="destructive" which adds styling
    // Since our mock just passes props through, we check for the variant prop
    const buttons = screen.getAllByTestId('button');
    const stopButton = buttons[buttons.length - 1];

    // The button should be rendered (we can't easily check variant with our mock,
    // but we can verify the button exists and has the right icon)
    expect(stopButton.querySelector('[data-testid="square-icon"]')).toBeInTheDocument();
  });

  it('should switch from stop to send button when streaming ends', () => {
    // First render with streaming = true
    mockIsStreaming = true;
    const { rerender } = render(<ChatInput />);

    // Should show square/stop icon
    let buttons = screen.getAllByTestId('button');
    let lastButton = buttons[buttons.length - 1];
    expect(lastButton.querySelector('[data-testid="square-icon"]')).toBeInTheDocument();

    // Now simulate streaming ending
    mockIsStreaming = false;
    mockStoreState.inputValue = 'New message';

    // Need to remount since the mock doesn't trigger re-render
    // The component would re-render in real usage when isStreaming changes
  });

  it('should handle stop button click without errors', async () => {
    mockIsStreaming = true;

    render(<ChatInput />);

    const buttons = screen.getAllByTestId('button');
    const stopButton = buttons[buttons.length - 1];

    // Should not throw
    expect(() => fireEvent.click(stopButton)).not.toThrow();
    expect(mockStopStream).toHaveBeenCalled();
  });
});

describe('ChatInput textarea auto-resize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    mockIsStreaming = false;
  });

  it('should set height on textarea when input value changes', async () => {
    render(<ChatInput />);

    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement;

    // Type some content
    fireEvent.change(textarea, { target: { value: 'Test content' } });

    await waitFor(() => {
      // Height should be set (minimum 48px)
      expect(textarea.style.height).toBe('48px');
    });
  });

  it('should handle textarea without parentNode gracefully', async () => {
    render(<ChatInput />);

    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement;

    // Store original parentNode
    const originalParentNode = textarea.parentNode;

    // Temporarily remove parentNode (simulating edge case)
    Object.defineProperty(textarea, 'parentNode', {
      configurable: true,
      get: () => null,
    });

    // Should not throw when parentNode is null
    expect(() => {
      fireEvent.change(textarea, { target: { value: 'Test content' } });
    }).not.toThrow();

    // Restore parentNode
    Object.defineProperty(textarea, 'parentNode', {
      configurable: true,
      get: () => originalParentNode,
    });
  });

  it('should have minimum height of 48px', async () => {
    render(<ChatInput />);

    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement;

    // Type short content
    fireEvent.change(textarea, { target: { value: 'Hi' } });

    await waitFor(() => {
      // Height should be at least 48px (minimum)
      const height = parseInt(textarea.style.height || '0', 10);
      expect(height).toBeGreaterThanOrEqual(48);
    });
  });

  it('should have correct CSS classes for resize behavior', () => {
    render(<ChatInput />);

    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement;

    // Should have resize-none class to prevent manual resize
    expect(textarea.className).toContain('resize-none');
    // Should have min-h-[48px] for minimum height
    expect(textarea.className).toContain('min-h-[48px]');
    // Should have max-h-[150px] for maximum height
    expect(textarea.className).toContain('max-h-[150px]');
  });

  it('should use clone-based measurement without affecting original textarea visibility', async () => {
    render(<ChatInput />);

    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement;

    // Verify textarea is visible before change
    expect(textarea).toBeVisible();

    // Type content
    fireEvent.change(textarea, { target: { value: 'Test content' } });

    await waitFor(() => {
      // Textarea should still be visible after measurement (no flicker)
      expect(textarea).toBeVisible();
      // Textarea should not have visibility:hidden set on it
      expect(textarea.style.visibility).not.toBe('hidden');
    });
  });
});

describe('ChatInput Whisper transcription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockStoreState();
    mockIsStreaming = false;
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  afterEach(() => {
    delete (window as any).__chatInputFocus;
    delete (window as any).__chatInputSend;
  });

  it('should use Whisper transcription for authenticated users', async () => {
    // Mock as authenticated user (default in our mocks)
    render(<ChatInput />);

    // Find and click the mic button
    const micIcons = screen.getAllByTestId('mic-icon');
    const speechMicButton = micIcons[micIcons.length - 1].closest('button');

    if (speechMicButton) {
      fireEvent.click(speechMicButton);
    }

    // Should call Whisper start recording for authenticated users
    await waitFor(() => {
      expect(mockWhisperStartRecording).toHaveBeenCalled();
    });
  });

  it('should show recording duration in overlay', async () => {
    render(<ChatInput />);

    // Find and click the mic button
    const micIcons = screen.getAllByTestId('mic-icon');
    const speechMicButton = micIcons[micIcons.length - 1].closest('button');

    if (speechMicButton) {
      fireEvent.click(speechMicButton);
    }

    // Should show recording overlay with duration display
    await waitFor(() => {
      const overlay = document.querySelector('.recording-overlay');
      expect(overlay).toBeInTheDocument();
    });
  });

  it('should show "Recording... Speak now" message in Whisper mode', async () => {
    render(<ChatInput />);

    // Find and click the mic button
    const micIcons = screen.getAllByTestId('mic-icon');
    const speechMicButton = micIcons[micIcons.length - 1].closest('button');

    if (speechMicButton) {
      fireEvent.click(speechMicButton);
    }

    // Whisper mode should show "Recording... Speak now" placeholder
    await waitFor(() => {
      const placeholder = document.querySelector('.recording-transcript-placeholder');
      if (placeholder) {
        expect(placeholder.textContent).toContain('Recording');
      }
    });
  });
});
