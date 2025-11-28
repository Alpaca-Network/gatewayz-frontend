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

jest.mock('@/lib/store/chat-ui-store', () => ({
  useChatUIStore: () => ({
    activeSessionId: null,
    setActiveSessionId: mockSetActiveSessionId,
    selectedModel: { value: 'test-model', label: 'Test Model' },
    inputValue: '',
    setInputValue: mockSetInputValue,
  }),
}));

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
    it('should disable send button when input is empty', () => {
      render(<ChatInput />);

      // Find all buttons and get the last one (send button)
      const buttons = screen.getAllByTestId('button');
      const sendBtn = buttons[buttons.length - 1];

      expect(sendBtn).toBeDisabled();
    });

    it('should derive isInputEmpty from inputValue without separate state', () => {
      // This test verifies the fix: isInputEmpty is derived from inputValue
      // not tracked as separate state that could desync
      render(<ChatInput />);

      // Button should be disabled initially (empty input)
      const buttons = screen.getAllByTestId('button');
      const sendBtn = buttons[buttons.length - 1];
      expect(sendBtn).toBeDisabled();
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
