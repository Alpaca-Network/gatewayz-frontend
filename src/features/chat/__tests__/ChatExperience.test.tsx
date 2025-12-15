import { render, screen } from '@testing-library/react';

// Test the getTextFromContent helper function
// Since it's a private function in the module, we test it through the component's behavior

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  Send: () => <span data-testid="send-icon">Send</span>,
  Edit3: () => <span data-testid="edit-icon">Edit</span>,
  Trash2: () => <span data-testid="trash-icon">Trash</span>,
  Loader2: () => <span data-testid="loader-icon">Loader</span>,
  MessageSquare: () => <span data-testid="message-icon">Message</span>,
  Check: () => <span data-testid="check-icon">Check</span>,
}));

// Mock all the dependencies
jest.mock('../useChatController', () => ({
  useChatController: () => ({
    sessions: [],
    activeSessionId: null,
    activeSession: null,
    messages: [],
    loadingSessions: false,
    loadingMessages: false,
    sending: false,
    error: null,
    createSession: jest.fn(),
    selectSession: jest.fn(),
    renameSession: jest.fn(),
    deleteSession: jest.fn(),
    sendMessage: jest.fn(),
    clearError: jest.fn(),
  }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/components/chat/ChatMessage', () => ({
  ChatMessage: ({ onCopy, onShare, content }: any) => (
    <div data-testid="chat-message">
      <button data-testid="copy-btn" onClick={onCopy}>Copy</button>
      {onShare && <button data-testid="share-btn" onClick={onShare}>Share</button>}
      <span data-testid="content">{typeof content === 'string' ? content : JSON.stringify(content)}</span>
    </div>
  ),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('next/dynamic', () => () => {
  const MockModelSelect = () => <div data-testid="model-select">Model Select</div>;
  return MockModelSelect;
});

// Import after mocks
import { ChatExperience } from '../ChatExperience';

describe('ChatExperience', () => {
  let clipboardWriteText: jest.Mock;

  beforeEach(() => {
    clipboardWriteText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render without errors', () => {
    render(<ChatExperience />);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
  });

  it('should show empty state when no sessions', () => {
    render(<ChatExperience />);
    expect(screen.getByText('No chats yet. Create one to get started.')).toBeInTheDocument();
  });
});

describe('getTextFromContent helper', () => {
  let clipboardWriteText: jest.Mock;

  beforeEach(() => {
    clipboardWriteText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle string content when copying', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      { id: '2', role: 'assistant', content: 'Hi there!', isStreaming: false, model: 'gpt-4' },
    ];

    jest.spyOn(require('../useChatController'), 'useChatController').mockReturnValue({
      sessions: [{ id: '1', title: 'Test Session', updatedAt: new Date().toISOString() }],
      activeSessionId: '1',
      activeSession: { id: '1', title: 'Test Session' },
      messages: mockMessages,
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
      createSession: jest.fn(),
      selectSession: jest.fn(),
      renameSession: jest.fn(),
      deleteSession: jest.fn(),
      sendMessage: jest.fn(),
      clearError: jest.fn(),
    });

    render(<ChatExperience />);

    const copyButtons = screen.getAllByTestId('copy-btn');
    // Click on the assistant message copy button (second one)
    copyButtons[1].click();

    expect(clipboardWriteText).toHaveBeenCalledWith('Hi there!');
  });

  it('should handle array content (multimodal) when copying', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      {
        id: '2',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Part 1. ' },
          { type: 'text', text: 'Part 2.' },
          { type: 'image', url: 'test.jpg' },
        ],
        isStreaming: false,
        model: 'gpt-4',
      },
    ];

    jest.spyOn(require('../useChatController'), 'useChatController').mockReturnValue({
      sessions: [{ id: '1', title: 'Test Session', updatedAt: new Date().toISOString() }],
      activeSessionId: '1',
      activeSession: { id: '1', title: 'Test Session' },
      messages: mockMessages,
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
      createSession: jest.fn(),
      selectSession: jest.fn(),
      renameSession: jest.fn(),
      deleteSession: jest.fn(),
      sendMessage: jest.fn(),
      clearError: jest.fn(),
    });

    render(<ChatExperience />);

    const copyButtons = screen.getAllByTestId('copy-btn');
    // Click on the assistant message copy button
    copyButtons[1].click();

    expect(clipboardWriteText).toHaveBeenCalledWith('Part 1. Part 2.');
  });

  it('should handle empty array content when copying', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      {
        id: '2',
        role: 'assistant',
        content: [],
        isStreaming: false,
        model: 'gpt-4',
      },
    ];

    jest.spyOn(require('../useChatController'), 'useChatController').mockReturnValue({
      sessions: [{ id: '1', title: 'Test Session', updatedAt: new Date().toISOString() }],
      activeSessionId: '1',
      activeSession: { id: '1', title: 'Test Session' },
      messages: mockMessages,
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
      createSession: jest.fn(),
      selectSession: jest.fn(),
      renameSession: jest.fn(),
      deleteSession: jest.fn(),
      sendMessage: jest.fn(),
      clearError: jest.fn(),
    });

    render(<ChatExperience />);

    const copyButtons = screen.getAllByTestId('copy-btn');
    copyButtons[1].click();

    // Empty array should return empty string
    expect(clipboardWriteText).toHaveBeenCalledWith('');
  });

  it('should handle array content without text entries when copying', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      {
        id: '2',
        role: 'assistant',
        content: [
          { type: 'image', url: 'test.jpg' },
          { type: 'audio', url: 'test.mp3' },
        ],
        isStreaming: false,
        model: 'gpt-4',
      },
    ];

    jest.spyOn(require('../useChatController'), 'useChatController').mockReturnValue({
      sessions: [{ id: '1', title: 'Test Session', updatedAt: new Date().toISOString() }],
      activeSessionId: '1',
      activeSession: { id: '1', title: 'Test Session' },
      messages: mockMessages,
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
      createSession: jest.fn(),
      selectSession: jest.fn(),
      renameSession: jest.fn(),
      deleteSession: jest.fn(),
      sendMessage: jest.fn(),
      clearError: jest.fn(),
    });

    render(<ChatExperience />);

    const copyButtons = screen.getAllByTestId('copy-btn');
    copyButtons[1].click();

    // Array with no text entries should return empty string
    expect(clipboardWriteText).toHaveBeenCalledWith('');
  });

  it('should handle string content when sharing', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      { id: '2', role: 'assistant', content: 'Shared content!', isStreaming: false, model: 'gpt-4' },
    ];

    jest.spyOn(require('../useChatController'), 'useChatController').mockReturnValue({
      sessions: [{ id: '1', title: 'Test Session', updatedAt: new Date().toISOString() }],
      activeSessionId: '1',
      activeSession: { id: '1', title: 'Test Session' },
      messages: mockMessages,
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
      createSession: jest.fn(),
      selectSession: jest.fn(),
      renameSession: jest.fn(),
      deleteSession: jest.fn(),
      sendMessage: jest.fn(),
      clearError: jest.fn(),
    });

    render(<ChatExperience />);

    const shareButtons = screen.getAllByTestId('share-btn');
    shareButtons[0].click();

    expect(clipboardWriteText).toHaveBeenCalledWith('Shared content!');
  });

  it('should handle array content when sharing', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      {
        id: '2',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Shared ' },
          { type: 'text', text: 'multimodal content!' },
        ],
        isStreaming: false,
        model: 'gpt-4',
      },
    ];

    jest.spyOn(require('../useChatController'), 'useChatController').mockReturnValue({
      sessions: [{ id: '1', title: 'Test Session', updatedAt: new Date().toISOString() }],
      activeSessionId: '1',
      activeSession: { id: '1', title: 'Test Session' },
      messages: mockMessages,
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
      createSession: jest.fn(),
      selectSession: jest.fn(),
      renameSession: jest.fn(),
      deleteSession: jest.fn(),
      sendMessage: jest.fn(),
      clearError: jest.fn(),
    });

    render(<ChatExperience />);

    const shareButtons = screen.getAllByTestId('share-btn');
    shareButtons[0].click();

    expect(clipboardWriteText).toHaveBeenCalledWith('Shared multimodal content!');
  });

  it('should filter out entries with missing text property', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      {
        id: '2',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Valid text.' },
          { type: 'text' }, // missing text property
          { type: 'text', text: undefined }, // explicit undefined
          { type: 'text', text: 'More text.' },
        ],
        isStreaming: false,
        model: 'gpt-4',
      },
    ];

    jest.spyOn(require('../useChatController'), 'useChatController').mockReturnValue({
      sessions: [{ id: '1', title: 'Test Session', updatedAt: new Date().toISOString() }],
      activeSessionId: '1',
      activeSession: { id: '1', title: 'Test Session' },
      messages: mockMessages,
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
      createSession: jest.fn(),
      selectSession: jest.fn(),
      renameSession: jest.fn(),
      deleteSession: jest.fn(),
      sendMessage: jest.fn(),
      clearError: jest.fn(),
    });

    render(<ChatExperience />);

    const copyButtons = screen.getAllByTestId('copy-btn');
    copyButtons[1].click();

    // Should only contain valid text values, not "undefined" literals
    expect(clipboardWriteText).toHaveBeenCalledWith('Valid text.More text.');
  });

  it('should return empty string for non-string non-array content', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      {
        id: '2',
        role: 'assistant',
        // Simulate an edge case with an unusual content type
        content: null as any,
        isStreaming: false,
        model: 'gpt-4',
      },
    ];

    jest.spyOn(require('../useChatController'), 'useChatController').mockReturnValue({
      sessions: [{ id: '1', title: 'Test Session', updatedAt: new Date().toISOString() }],
      activeSessionId: '1',
      activeSession: { id: '1', title: 'Test Session' },
      messages: mockMessages,
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
      createSession: jest.fn(),
      selectSession: jest.fn(),
      renameSession: jest.fn(),
      deleteSession: jest.fn(),
      sendMessage: jest.fn(),
      clearError: jest.fn(),
    });

    render(<ChatExperience />);

    const copyButtons = screen.getAllByTestId('copy-btn');
    copyButtons[1].click();

    // Null content should return empty string
    expect(clipboardWriteText).toHaveBeenCalledWith('');
  });
});
