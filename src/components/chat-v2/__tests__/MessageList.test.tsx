import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock ChatMessage component
const mockOnRetry = jest.fn();
jest.mock('@/components/chat/ChatMessage', () => ({
  ChatMessage: ({ role, content, hasError, onRetry, onRegenerate, onLike, onDislike, onShare, isStreaming }: any) => (
    <div data-testid={`message-${role}`} data-has-error={hasError} data-is-streaming={isStreaming}>
      <span data-testid="content">{typeof content === 'string' ? content : JSON.stringify(content)}</span>
      {onRetry && (
        <button data-testid="retry-button" onClick={onRetry}>
          Retry
        </button>
      )}
      {onRegenerate && (
        <button data-testid="regenerate-button" onClick={onRegenerate}>
          Regenerate
        </button>
      )}
      {onLike && (
        <button data-testid="like-button" onClick={onLike}>
          Like
        </button>
      )}
      {onDislike && (
        <button data-testid="dislike-button" onClick={onDislike}>
          Dislike
        </button>
      )}
      {onShare && (
        <button data-testid="share-button" onClick={onShare}>
          Share
        </button>
      )}
    </div>
  ),
}));

import { MessageList } from '../MessageList';

describe('MessageList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onRetry prop', () => {
    it('should pass onRetry to the last message when it has an error', () => {
      const onRetry = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Error occurred', hasError: true, error: 'Rate limit exceeded', created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should not show retry button on non-error messages', () => {
      const onRetry = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Hi there!', hasError: false, created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onRetry={onRetry}
        />
      );

      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
    });

    it('should not show retry button on error messages that are not the last message', () => {
      const onRetry = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Error occurred', hasError: true, error: 'Error', created_at: '2024-01-01' },
        { id: 3, role: 'user' as const, content: 'Try again', created_at: '2024-01-01' },
        { id: 4, role: 'assistant' as const, content: 'Success!', hasError: false, created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onRetry={onRetry}
        />
      );

      // No retry button should be shown since the last message is not an error
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
    });

    it('should not show retry button when onRetry prop is not provided', () => {
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Error occurred', hasError: true, error: 'Error', created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
    });
  });

  describe('rendering states', () => {
    it('should return null when sessionId is null and no pendingPrompt', () => {
      const { container } = render(
        <MessageList
          sessionId={null}
          messages={[]}
          isLoading={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show loading spinner when isLoading is true', () => {
      const { container } = render(
        <MessageList
          sessionId={1}
          messages={[]}
          isLoading={true}
        />
      );

      // Check for the loading spinner by class name
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should show empty state when no messages', () => {
      render(
        <MessageList
          sessionId={1}
          messages={[]}
          isLoading={false}
        />
      );

      expect(screen.getByText('Start the conversation')).toBeInTheDocument();
    });

    it('should render messages when provided', () => {
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Hi there!', created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    });
  });

  describe('pendingPrompt (optimistic UI)', () => {
    it('should show optimistic messages when pendingPrompt is set and no messages exist', () => {
      render(
        <MessageList
          sessionId={null}
          messages={[]}
          isLoading={false}
          pendingPrompt="What is the weather?"
        />
      );

      // Should show the pending prompt as a user message
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      // Should show a streaming assistant message
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    });
  });

  describe('onRegenerate prop', () => {
    it('should pass onRegenerate to the last assistant message when not streaming', () => {
      const onRegenerate = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Hi there!', isStreaming: false, created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onRegenerate={onRegenerate}
        />
      );

      const regenerateButton = screen.getByTestId('regenerate-button');
      expect(regenerateButton).toBeInTheDocument();

      fireEvent.click(regenerateButton);
      expect(onRegenerate).toHaveBeenCalledTimes(1);
    });

    it('should not show regenerate button when message is streaming', () => {
      const onRegenerate = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Hi...', isStreaming: true, created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onRegenerate={onRegenerate}
        />
      );

      expect(screen.queryByTestId('regenerate-button')).not.toBeInTheDocument();
    });

    it('should not show regenerate button on non-last assistant messages', () => {
      const onRegenerate = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Hi!', created_at: '2024-01-01' },
        { id: 3, role: 'user' as const, content: 'How are you?', created_at: '2024-01-01' },
        { id: 4, role: 'assistant' as const, content: 'Good!', created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onRegenerate={onRegenerate}
        />
      );

      // Only one regenerate button should exist (for the last message)
      const regenerateButtons = screen.getAllByTestId('regenerate-button');
      expect(regenerateButtons).toHaveLength(1);
    });
  });

  describe('onLike prop', () => {
    it('should pass onLike to assistant messages with valid id', () => {
      const onLike = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Hi there!', created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onLike={onLike}
        />
      );

      const likeButton = screen.getByTestId('like-button');
      expect(likeButton).toBeInTheDocument();

      fireEvent.click(likeButton);
      expect(onLike).toHaveBeenCalledWith(2);
    });

    it('should not show like button on user messages', () => {
      const onLike = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onLike={onLike}
        />
      );

      expect(screen.queryByTestId('like-button')).not.toBeInTheDocument();
    });
  });

  describe('onDislike prop', () => {
    it('should pass onDislike to assistant messages with valid id', () => {
      const onDislike = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Hi there!', created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onDislike={onDislike}
        />
      );

      const dislikeButton = screen.getByTestId('dislike-button');
      expect(dislikeButton).toBeInTheDocument();

      fireEvent.click(dislikeButton);
      expect(onDislike).toHaveBeenCalledWith(2);
    });
  });

  describe('onShare prop', () => {
    it('should pass onShare to assistant messages with valid id', () => {
      const onShare = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { id: 2, role: 'assistant' as const, content: 'Hi there!', created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
          onShare={onShare}
        />
      );

      const shareButton = screen.getByTestId('share-button');
      expect(shareButton).toBeInTheDocument();

      fireEvent.click(shareButton);
      expect(onShare).toHaveBeenCalledWith(2);
    });

    it('should show share button even when message has no id (for streaming messages)', () => {
      const onShare = jest.fn();
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
        { role: 'assistant' as const, content: 'Streaming...', isStreaming: true, created_at: '2024-01-01' },
      ];

      render(
        <MessageList
          sessionId={1}
          messages={messages as any}
          isLoading={false}
          onShare={onShare}
        />
      );

      // Assistant message should have share button even without id (icons show during streaming)
      expect(screen.getByTestId('share-button')).toBeInTheDocument();
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

    it('should copy string content to clipboard', () => {
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello world', created_at: '2024-01-01' },
      ];

      // Update mock to capture onCopy
      let capturedOnCopy: (() => void) | null = null;
      jest.spyOn(require('@/components/chat/ChatMessage'), 'ChatMessage').mockImplementation(
        ({ onCopy }: any) => {
          capturedOnCopy = onCopy;
          return <div data-testid="message"><button data-testid="copy-btn" onClick={onCopy}>Copy</button></div>;
        }
      );

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      const copyButton = screen.getByTestId('copy-btn');
      fireEvent.click(copyButton);

      expect(clipboardWriteText).toHaveBeenCalledWith('Hello world');
    });

    it('should extract text from array content when copying', () => {
      const messages = [
        {
          id: 1,
          role: 'assistant' as const,
          content: [
            { type: 'text', text: 'Part 1. ' },
            { type: 'text', text: 'Part 2.' },
            { type: 'image', url: 'test.jpg' },
          ],
          created_at: '2024-01-01',
        },
      ];

      // Update mock to capture onCopy
      jest.spyOn(require('@/components/chat/ChatMessage'), 'ChatMessage').mockImplementation(
        ({ onCopy }: any) => {
          return <div data-testid="message"><button data-testid="copy-btn" onClick={onCopy}>Copy</button></div>;
        }
      );

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      const copyButton = screen.getByTestId('copy-btn');
      fireEvent.click(copyButton);

      expect(clipboardWriteText).toHaveBeenCalledWith('Part 1. Part 2.');
    });

    it('should handle null/undefined content gracefully', () => {
      const messages = [
        {
          id: 1,
          role: 'assistant' as const,
          content: null as any,
          created_at: '2024-01-01',
        },
      ];

      // Update mock to capture onCopy
      jest.spyOn(require('@/components/chat/ChatMessage'), 'ChatMessage').mockImplementation(
        ({ onCopy }: any) => {
          return <div data-testid="message"><button data-testid="copy-btn" onClick={onCopy}>Copy</button></div>;
        }
      );

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      const copyButton = screen.getByTestId('copy-btn');
      fireEvent.click(copyButton);

      // Should return empty string for null/undefined content
      expect(clipboardWriteText).toHaveBeenCalledWith('');
    });

    it('should handle numeric content gracefully', () => {
      const messages = [
        {
          id: 1,
          role: 'assistant' as const,
          content: 12345 as any,
          created_at: '2024-01-01',
        },
      ];

      // Update mock to capture onCopy
      jest.spyOn(require('@/components/chat/ChatMessage'), 'ChatMessage').mockImplementation(
        ({ onCopy }: any) => {
          return <div data-testid="message"><button data-testid="copy-btn" onClick={onCopy}>Copy</button></div>;
        }
      );

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      const copyButton = screen.getByTestId('copy-btn');
      fireEvent.click(copyButton);

      // Should return empty string for non-string, non-array content
      expect(clipboardWriteText).toHaveBeenCalledWith('');
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

    it('should copy string content to clipboard', () => {
      const messages = [
        { id: 1, role: 'user' as const, content: 'Hello world', created_at: '2024-01-01' },
      ];

      // Update mock to capture onCopy
      let capturedOnCopy: (() => void) | null = null;
      jest.spyOn(require('@/components/chat/ChatMessage'), 'ChatMessage').mockImplementation(
        ({ onCopy }: any) => {
          capturedOnCopy = onCopy;
          return <div data-testid="message"><button data-testid="copy-btn" onClick={onCopy}>Copy</button></div>;
        }
      );

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      const copyButton = screen.getByTestId('copy-btn');
      fireEvent.click(copyButton);

      expect(clipboardWriteText).toHaveBeenCalledWith('Hello world');
    });

    it('should extract text from array content when copying', () => {
      const messages = [
        {
          id: 1,
          role: 'assistant' as const,
          content: [
            { type: 'text', text: 'Part 1. ' },
            { type: 'text', text: 'Part 2.' },
            { type: 'image', url: 'test.jpg' },
          ],
          created_at: '2024-01-01',
        },
      ];

      // Update mock to capture onCopy
      jest.spyOn(require('@/components/chat/ChatMessage'), 'ChatMessage').mockImplementation(
        ({ onCopy }: any) => {
          return <div data-testid="message"><button data-testid="copy-btn" onClick={onCopy}>Copy</button></div>;
        }
      );

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      const copyButton = screen.getByTestId('copy-btn');
      fireEvent.click(copyButton);

      expect(clipboardWriteText).toHaveBeenCalledWith('Part 1. Part 2.');
    });

    it('should handle null/undefined content gracefully', () => {
      const messages = [
        {
          id: 1,
          role: 'assistant' as const,
          content: null as any,
          created_at: '2024-01-01',
        },
      ];

      // Update mock to capture onCopy
      jest.spyOn(require('@/components/chat/ChatMessage'), 'ChatMessage').mockImplementation(
        ({ onCopy }: any) => {
          return <div data-testid="message"><button data-testid="copy-btn" onClick={onCopy}>Copy</button></div>;
        }
      );

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      const copyButton = screen.getByTestId('copy-btn');
      fireEvent.click(copyButton);

      // Should return empty string for null/undefined content
      expect(clipboardWriteText).toHaveBeenCalledWith('');
    });

    it('should handle numeric content gracefully', () => {
      const messages = [
        {
          id: 1,
          role: 'assistant' as const,
          content: 12345 as any,
          created_at: '2024-01-01',
        },
      ];

      // Update mock to capture onCopy
      jest.spyOn(require('@/components/chat/ChatMessage'), 'ChatMessage').mockImplementation(
        ({ onCopy }: any) => {
          return <div data-testid="message"><button data-testid="copy-btn" onClick={onCopy}>Copy</button></div>;
        }
      );

      render(
        <MessageList
          sessionId={1}
          messages={messages}
          isLoading={false}
        />
      );

      const copyButton = screen.getByTestId('copy-btn');
      fireEvent.click(copyButton);

      // Should return empty string for non-string, non-array content
      expect(clipboardWriteText).toHaveBeenCalledWith('');
    });
  });
});
