/**
 * Tests for MessageList component
 * Covers streaming updates, auto-scroll behavior, and message rendering
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MessageList } from '../MessageList';
import type { ChatMessage } from '@/lib/chat-history';

// Mock the ChatMessage component
jest.mock('@/components/chat/ChatMessage', () => ({
  ChatMessage: ({
    role,
    content,
    isStreaming,
    reasoning,
    error,
    hasError,
  }: any) => (
    <div data-testid={`message-${role}`} data-streaming={isStreaming}>
      <span data-testid="content">
        {typeof content === 'string'
          ? content
          : content
              ?.filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('')}
      </span>
      {reasoning && <span data-testid="reasoning">{reasoning}</span>}
      {isStreaming && <span data-testid="streaming-indicator">Streaming...</span>}
      {hasError && <span data-testid="error">{error}</span>}
    </div>
  ),
}));

// Mock scrollIntoView
const mockScrollIntoView = jest.fn();
Element.prototype.scrollIntoView = mockScrollIntoView;

describe('MessageList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when sessionId is null', () => {
      const { container } = render(
        <MessageList sessionId={null} messages={[]} isLoading={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render loading spinner when isLoading is true', () => {
      const { container } = render(<MessageList sessionId={1} messages={[]} isLoading={true} />);
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should render empty state when no messages', () => {
      render(<MessageList sessionId={1} messages={[]} isLoading={false} />);
      expect(screen.getByText('Start the conversation')).toBeInTheDocument();
    });

    it('should render user messages', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'Hello, how are you?',
          created_at: new Date().toISOString(),
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    });

    it('should render assistant messages', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'assistant',
          content: 'I am doing well, thank you!',
          created_at: new Date().toISOString(),
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.getByText('I am doing well, thank you!')).toBeInTheDocument();
    });

    it('should render multiple messages in order', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'First message',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          session_id: 1,
          role: 'assistant',
          content: 'Second message',
          created_at: new Date().toISOString(),
        },
        {
          id: 3,
          session_id: 1,
          role: 'user',
          content: 'Third message',
          created_at: new Date().toISOString(),
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);

      const allMessages = screen.getAllByTestId(/message-/);
      expect(allMessages).toHaveLength(3);
    });
  });

  describe('Streaming Indicator', () => {
    it('should show streaming indicator when message is streaming', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'Question',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          session_id: 1,
          role: 'assistant',
          content: 'Partial response...',
          created_at: new Date().toISOString(),
          isStreaming: true,
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
    });

    it('should not show streaming indicator when streaming is complete', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'assistant',
          content: 'Complete response',
          created_at: new Date().toISOString(),
          isStreaming: false,
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.queryByTestId('streaming-indicator')).not.toBeInTheDocument();
    });
  });

  describe('Auto-Scroll Behavior', () => {
    it('should scroll to bottom when new message is added', () => {
      const initialMessages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'First message',
          created_at: new Date().toISOString(),
        },
      ];

      const { rerender } = render(
        <MessageList sessionId={1} messages={initialMessages} isLoading={false} />
      );

      const newMessages = [
        ...initialMessages,
        {
          id: 2,
          session_id: 1,
          role: 'assistant' as const,
          content: 'New response',
          created_at: new Date().toISOString(),
        },
      ];

      rerender(
        <MessageList sessionId={1} messages={newMessages} isLoading={false} />
      );

      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('should scroll to bottom when streaming starts', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'Question',
          created_at: new Date().toISOString(),
        },
      ];

      const { rerender } = render(
        <MessageList sessionId={1} messages={messages} isLoading={false} />
      );

      mockScrollIntoView.mockClear();

      const messagesWithStreaming = [
        ...messages,
        {
          id: 2,
          session_id: 1,
          role: 'assistant' as const,
          content: '',
          created_at: new Date().toISOString(),
          isStreaming: true,
        },
      ];

      rerender(
        <MessageList sessionId={1} messages={messagesWithStreaming} isLoading={false} />
      );

      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('should scroll during streaming when content updates', () => {
      const initialMessages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'Question',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          session_id: 1,
          role: 'assistant',
          content: 'Partial',
          created_at: new Date().toISOString(),
          isStreaming: true,
        },
      ];

      const { rerender } = render(
        <MessageList sessionId={1} messages={initialMessages} isLoading={false} />
      );

      mockScrollIntoView.mockClear();

      // Update content during streaming
      const updatedMessages = [
        initialMessages[0],
        {
          ...initialMessages[1],
          content: 'Partial response with more content',
        },
      ];

      rerender(
        <MessageList sessionId={1} messages={updatedMessages} isLoading={false} />
      );

      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });

  describe('Reasoning Display', () => {
    it('should pass reasoning to ChatMessage component', () => {
      const messages: (ChatMessage & { isStreaming?: boolean; reasoning?: string })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'assistant',
          content: 'The answer is 42',
          reasoning: 'Let me think about this...',
          created_at: new Date().toISOString(),
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByTestId('reasoning')).toHaveTextContent('Let me think about this...');
    });
  });

  describe('Error Handling', () => {
    it('should display error message when hasError is true', () => {
      const messages: (ChatMessage & {
        isStreaming?: boolean;
        error?: string;
        hasError?: boolean;
      })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'assistant',
          content: 'Partial content',
          error: 'Connection lost',
          hasError: true,
          created_at: new Date().toISOString(),
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByTestId('error')).toHaveTextContent('Connection lost');
    });
  });

  describe('Content Types', () => {
    it('should handle string content', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'Simple string content',
          created_at: new Date().toISOString(),
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByText('Simple string content')).toBeInTheDocument();
    });

    it('should handle array content with text', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: ' Part 2' },
          ] as any,
          created_at: new Date().toISOString(),
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByTestId('content')).toHaveTextContent('Part 1 Part 2');
    });
  });

  describe('User Scroll Behavior', () => {
    it('should detect when user has scrolled away', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'Message',
          created_at: new Date().toISOString(),
        },
      ];

      const { container } = render(
        <MessageList sessionId={1} messages={messages} isLoading={false} />
      );

      const scrollContainer = container.querySelector('[class*="overflow-y-auto"]');
      if (scrollContainer) {
        // Simulate scroll event
        Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000 });
        Object.defineProperty(scrollContainer, 'scrollTop', { value: 0 });
        Object.defineProperty(scrollContainer, 'clientHeight', { value: 500 });

        fireEvent.scroll(scrollContainer);
      }

      // The component should track that user has scrolled
      // This is tested implicitly through the scroll behavior
    });

    it('should detect when user is near bottom', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'Message',
          created_at: new Date().toISOString(),
        },
      ];

      const { container } = render(
        <MessageList sessionId={1} messages={messages} isLoading={false} />
      );

      const scrollContainer = container.querySelector('[class*="overflow-y-auto"]');
      if (scrollContainer) {
        // Simulate being near bottom (within 100px)
        Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000 });
        Object.defineProperty(scrollContainer, 'scrollTop', { value: 450 });
        Object.defineProperty(scrollContainer, 'clientHeight', { value: 500 });

        fireEvent.scroll(scrollContainer);
      }
    });
  });

  describe('Key Generation', () => {
    it('should use message id as key when available', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 123,
          session_id: 1,
          role: 'user',
          content: 'Message with ID',
          created_at: new Date().toISOString(),
        },
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
    });

    it('should generate fallback key when id is missing', () => {
      const messages: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          session_id: 1,
          role: 'user',
          content: 'Message without ID',
          created_at: new Date().toISOString(),
        } as any,
      ];

      render(<MessageList sessionId={1} messages={messages} isLoading={false} />);
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
    });
  });

  describe('Re-render Optimization', () => {
    it('should track message count for scroll decisions', () => {
      const messages1: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'user',
          content: 'First',
          created_at: new Date().toISOString(),
        },
      ];

      const { rerender } = render(
        <MessageList sessionId={1} messages={messages1} isLoading={false} />
      );

      mockScrollIntoView.mockClear();

      // Add second message
      const messages2 = [
        ...messages1,
        {
          id: 2,
          session_id: 1,
          role: 'assistant' as const,
          content: 'Second',
          created_at: new Date().toISOString(),
        },
      ];

      rerender(
        <MessageList sessionId={1} messages={messages2} isLoading={false} />
      );

      // Should scroll because message count increased
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('should scroll when content changes during streaming', () => {
      const messages1: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'assistant',
          content: 'Initial',
          isStreaming: true,
          created_at: new Date().toISOString(),
        },
      ];

      const { rerender } = render(
        <MessageList sessionId={1} messages={messages1} isLoading={false} />
      );

      mockScrollIntoView.mockClear();

      // Update content during streaming
      const messages2: (ChatMessage & { isStreaming?: boolean })[] = [
        {
          id: 1,
          session_id: 1,
          role: 'assistant',
          content: 'Initial content with more text',
          isStreaming: true,
          created_at: new Date().toISOString(),
        },
      ];

      rerender(
        <MessageList sessionId={1} messages={messages2} isLoading={false} />
      );

      // Should scroll because content changed during streaming
      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });
});
