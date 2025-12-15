import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage, ChatMessageProps } from '../ChatMessage';

// Mock next/dynamic to render components synchronously
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (importFn: () => Promise<any>, options?: any) => {
    // Extract the module path from the import function string
    const importStr = importFn.toString();
    if (importStr.includes('react-markdown')) {
      return require('react-markdown').default;
    }
    if (importStr.includes('reasoning-display')) {
      return ({ reasoning }: { reasoning: string }) => (
        <div data-testid="reasoning-display">{reasoning}</div>
      );
    }
    return () => null;
  },
}));

// Mock react-markdown
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children, remarkPlugins, components }: any) => {
    // Simple markdown parser for testing
    const content = children || '';

    // Check if content contains a table
    if (content.includes('|') && content.includes('---')) {
      const lines = content.split('\n').filter((l: string) => l.trim());
      const headerLine = lines[0];
      const dataLines = lines.slice(2); // Skip header and separator

      if (headerLine && components?.table) {
        const headers = headerLine.split('|').filter((h: string) => h.trim()).map((h: string) => h.trim());
        const rows = dataLines.map((line: string) =>
          line.split('|').filter((c: string) => c.trim()).map((c: string) => c.trim())
        );

        const Th = components.th;
        const Td = components.td;

        return components.table({
          children: (
            <>
              {components.thead({
                children: (
                  <tr>
                    {headers.map((h: string, i: number) => (
                      <Th key={i}>{h}</Th>
                    ))}
                  </tr>
                )
              })}
              <tbody>
                {rows.map((row: string[], ri: number) => (
                  <tr key={ri}>
                    {row.map((cell: string, ci: number) => (
                      <Td key={ci}>{cell}</Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </>
          )
        });
      }
    }

    // Check for code blocks
    if (content.includes('```')) {
      const codeMatch = content.match(/```(\w*)\n?([\s\S]*?)```/);
      if (codeMatch && components?.code) {
        return components.code({
          inline: false,
          className: codeMatch[1] ? `language-${codeMatch[1]}` : undefined,
          children: codeMatch[2]
        });
      }
    }

    // Check for inline code
    if (content.includes('`') && !content.includes('```')) {
      const parts = content.split(/`([^`]+)`/);
      const Code = components?.code;
      return (
        <div data-testid="markdown-content">
          {parts.map((part: string, i: number) =>
            i % 2 === 1 && Code
              ? <Code key={i} inline={true}>{part}</Code>
              : <span key={i}>{part}</span>
          )}
        </div>
      );
    }

    // Default paragraph rendering
    if (components?.p) {
      return components.p({ children: content });
    }

    return <div data-testid="markdown-content">{content}</div>;
  },
}));

// Mock remark-gfm
jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}));

// Mock reasoning-display
jest.mock('@/components/chat/reasoning-display', () => ({
  ReasoningDisplay: ({ reasoning }: { reasoning: string }) => (
    <div data-testid="reasoning-display">{reasoning}</div>
  ),
}));

// Mock Privy
jest.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    login: jest.fn(),
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Bot: () => <span data-testid="bot-icon">Bot</span>,
  User: () => <span data-testid="user-icon">User</span>,
  Copy: () => <span data-testid="copy-icon">Copy</span>,
  RotateCcw: () => <span data-testid="regenerate-icon">Regenerate</span>,
  LogIn: () => <span data-testid="login-icon">LogIn</span>,
  Check: () => <span data-testid="check-icon">Check</span>,
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  RefreshCw: () => <span data-testid="refresh-icon">RefreshCw</span>,
}));

describe('ChatMessage', () => {
  const defaultProps: ChatMessageProps = {
    role: 'assistant',
    content: 'Hello, world!',
  };

  describe('Basic rendering', () => {
    it('should render assistant message', () => {
      render(<ChatMessage {...defaultProps} />);
      expect(screen.getByTestId('bot-icon')).toBeInTheDocument();
    });

    it('should render user message', () => {
      render(<ChatMessage {...defaultProps} role="user" />);
      expect(screen.getByTestId('user-icon')).toBeInTheDocument();
    });

    it('should display message content', () => {
      render(<ChatMessage {...defaultProps} content="Test message content" />);
      expect(screen.getByText('Test message content')).toBeInTheDocument();
    });

    it('should render user content as plain text (not markdown)', () => {
      render(<ChatMessage {...defaultProps} role="user" content="User **bold** text" />);
      // User messages should show raw text, not processed markdown
      expect(screen.getByText('User **bold** text')).toBeInTheDocument();
    });
  });

  describe('Table rendering (GFM support)', () => {
    const tableContent = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`;

    it('should render markdown tables for assistant messages', () => {
      render(<ChatMessage {...defaultProps} content={tableContent} />);

      // Check table structure is rendered
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render table headers correctly', () => {
      render(<ChatMessage {...defaultProps} content={tableContent} />);

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
    });

    it('should render table cells correctly', () => {
      render(<ChatMessage {...defaultProps} content={tableContent} />);

      expect(screen.getByText('Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 2')).toBeInTheDocument();
      expect(screen.getByText('Cell 3')).toBeInTheDocument();
      expect(screen.getByText('Cell 4')).toBeInTheDocument();
    });

    it('should apply proper table styling classes', () => {
      const { container } = render(<ChatMessage {...defaultProps} content={tableContent} />);

      const table = container.querySelector('table');
      expect(table).toHaveClass('min-w-full', 'border-collapse', 'border', 'border-border');
    });

    it('should wrap table in overflow container', () => {
      const { container } = render(<ChatMessage {...defaultProps} content={tableContent} />);

      const wrapper = container.querySelector('.overflow-x-auto');
      expect(wrapper).toBeInTheDocument();
    });

    it('should style table headers with background', () => {
      const { container } = render(<ChatMessage {...defaultProps} content={tableContent} />);

      const thead = container.querySelector('thead');
      expect(thead).toHaveClass('bg-muted/50');
    });

    it('should style header cells with borders and padding', () => {
      const { container } = render(<ChatMessage {...defaultProps} content={tableContent} />);

      const th = container.querySelector('th');
      expect(th).toHaveClass('border', 'border-border', 'px-3', 'py-2', 'text-left', 'font-semibold');
    });

    it('should style data cells with borders and padding', () => {
      const { container } = render(<ChatMessage {...defaultProps} content={tableContent} />);

      const td = container.querySelector('td');
      expect(td).toHaveClass('border', 'border-border', 'px-3', 'py-2');
    });
  });

  describe('Code block rendering', () => {
    it('should render code blocks with proper styling', () => {
      const codeContent = '```javascript\nconst x = 1;\n```';
      const { container } = render(<ChatMessage {...defaultProps} content={codeContent} />);

      const pre = container.querySelector('pre');
      expect(pre).toBeInTheDocument();
      expect(pre).toHaveClass('bg-slate-800', 'dark:bg-slate-900', 'text-slate-100', 'p-3', 'rounded-md', 'overflow-x-auto');
    });

    it('should render inline code with proper styling', () => {
      const inlineCodeContent = 'Use the `console.log` function';
      const { container } = render(<ChatMessage {...defaultProps} content={inlineCodeContent} />);

      const code = container.querySelector('code');
      expect(code).toBeInTheDocument();
      expect(code).toHaveClass('bg-slate-200', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-slate-200', 'px-1.5', 'py-0.5', 'rounded', 'text-sm');
    });
  });

  describe('Media attachments', () => {
    it('should render image attachments', () => {
      render(<ChatMessage {...defaultProps} image="https://example.com/image.png" />);

      const img = screen.getByAltText('Uploaded');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    });

    it('should render video attachments', () => {
      const { container } = render(<ChatMessage {...defaultProps} video="https://example.com/video.mp4" />);

      const video = container.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
      expect(video).toHaveAttribute('controls');
    });

    it('should render audio attachments', () => {
      const { container } = render(<ChatMessage {...defaultProps} audio="https://example.com/audio.mp3" />);

      const audio = container.querySelector('audio');
      expect(audio).toBeInTheDocument();
      expect(audio).toHaveAttribute('src', 'https://example.com/audio.mp3');
      expect(audio).toHaveAttribute('controls');
    });

    it('should handle array content with image_url', () => {
      const arrayContent = [
        { type: 'text', text: 'Check this image' },
        { type: 'image_url', image_url: { url: 'https://example.com/array-image.png' } },
      ];

      render(<ChatMessage {...defaultProps} content={arrayContent} />);

      expect(screen.getByText('Check this image')).toBeInTheDocument();
      const img = screen.getByAltText('Uploaded');
      expect(img).toHaveAttribute('src', 'https://example.com/array-image.png');
    });

    it('should render document attachments', () => {
      render(<ChatMessage {...defaultProps} document="https://example.com/document.pdf" />);

      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com/document.pdf');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
      expect(screen.getByText('Attached document')).toBeInTheDocument();
    });

    it('should handle array content with file_url', () => {
      const arrayContent = [
        { type: 'text', text: 'Check this document' },
        { type: 'file_url', file_url: { url: 'https://example.com/report.pdf' } },
      ];

      render(<ChatMessage {...defaultProps} content={arrayContent} />);

      expect(screen.getByText('Check this document')).toBeInTheDocument();
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com/report.pdf');
    });

    it('should apply correct styling for document in user message', () => {
      const { container } = render(
        <ChatMessage {...defaultProps} role="user" document="https://example.com/doc.pdf" />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveClass('border-white/20');
    });

    it('should apply correct styling for document in assistant message', () => {
      const { container } = render(
        <ChatMessage {...defaultProps} role="assistant" document="https://example.com/doc.pdf" />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveClass('border-border');
    });
  });

  describe('Reasoning display', () => {
    it('should render reasoning for assistant messages', () => {
      render(<ChatMessage {...defaultProps} reasoning="This is my reasoning" />);

      expect(screen.getByTestId('reasoning-display')).toBeInTheDocument();
      expect(screen.getByText('This is my reasoning')).toBeInTheDocument();
    });

    it('should not render reasoning for user messages', () => {
      render(<ChatMessage {...defaultProps} role="user" reasoning="This is my reasoning" />);

      expect(screen.queryByTestId('reasoning-display')).not.toBeInTheDocument();
    });
  });

  describe('Streaming indicator', () => {
    it('should show streaming indicator when isStreaming is true', () => {
      const { container } = render(<ChatMessage {...defaultProps} isStreaming={true} />);

      const bouncingDots = container.querySelectorAll('.animate-bounce');
      expect(bouncingDots.length).toBe(3);
    });

    it('should not show streaming indicator when isStreaming is false', () => {
      const { container } = render(<ChatMessage {...defaultProps} isStreaming={false} />);

      const bouncingDots = container.querySelectorAll('.animate-bounce');
      expect(bouncingDots.length).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should display error message when hasError is true', () => {
      render(<ChatMessage {...defaultProps} hasError={true} error="Something went wrong" />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should show sign-in button for auth errors', () => {
      render(<ChatMessage {...defaultProps} hasError={true} error="Please sign in to continue" />);

      expect(screen.getByText('Sign in to continue')).toBeInTheDocument();
    });

    it('should not show sign-in button for non-auth errors', () => {
      render(<ChatMessage {...defaultProps} hasError={true} error="Network error occurred" />);

      expect(screen.queryByText('Sign in to continue')).not.toBeInTheDocument();
    });

    it('should apply error styling to card', () => {
      const { container } = render(<ChatMessage {...defaultProps} hasError={true} error="Error" />);

      const card = container.querySelector('.border-destructive');
      expect(card).toBeInTheDocument();
    });

    it('should show retry button for rate limit errors', () => {
      const onRetry = jest.fn();
      render(<ChatMessage {...defaultProps} hasError={true} error="Rate limit exceeded. The model is temporarily unavailable." onRetry={onRetry} />);

      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked for rate limit errors', () => {
      const onRetry = jest.fn();
      render(<ChatMessage {...defaultProps} hasError={true} error="Rate limit exceeded" onRetry={onRetry} />);

      const retryButton = screen.getByText('Try again');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should show retry button for too many requests errors', () => {
      const onRetry = jest.fn();
      render(<ChatMessage {...defaultProps} hasError={true} error="Too many requests, please try again later" onRetry={onRetry} />);

      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('should show retry button for high demand errors', () => {
      const onRetry = jest.fn();
      render(<ChatMessage {...defaultProps} hasError={true} error="Model temporarily unavailable due to high demand" onRetry={onRetry} />);

      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('should not show retry button for rate limit errors when onRetry is not provided', () => {
      render(<ChatMessage {...defaultProps} hasError={true} error="Rate limit exceeded" />);

      expect(screen.queryByText('Try again')).not.toBeInTheDocument();
    });

    it('should not show retry button for non-rate-limit errors', () => {
      const onRetry = jest.fn();
      render(<ChatMessage {...defaultProps} hasError={true} error="Server error occurred" onRetry={onRetry} />);

      expect(screen.queryByText('Try again')).not.toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should render copy button when onCopy is provided', () => {
      const onCopy = jest.fn();
      render(<ChatMessage {...defaultProps} onCopy={onCopy} />);

      expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    });

    it('should call onCopy when copy button is clicked', () => {
      const onCopy = jest.fn();
      render(<ChatMessage {...defaultProps} onCopy={onCopy} />);

      const copyButton = screen.getByTitle('Copy message');
      fireEvent.click(copyButton);

      expect(onCopy).toHaveBeenCalledTimes(1);
    });

    it('should render regenerate button when onRegenerate is provided', () => {
      const onRegenerate = jest.fn();
      render(<ChatMessage {...defaultProps} onRegenerate={onRegenerate} />);

      expect(screen.getByTestId('regenerate-icon')).toBeInTheDocument();
    });

    it('should call onRegenerate when regenerate button is clicked', () => {
      const onRegenerate = jest.fn();
      render(<ChatMessage {...defaultProps} onRegenerate={onRegenerate} />);

      const regenerateButton = screen.getByTitle('Regenerate response');
      fireEvent.click(regenerateButton);

      expect(onRegenerate).toHaveBeenCalledTimes(1);
    });

    it('should hide actions when showActions is false', () => {
      const onCopy = jest.fn();
      render(<ChatMessage {...defaultProps} onCopy={onCopy} showActions={false} />);

      expect(screen.queryByTitle('Copy message')).not.toBeInTheDocument();
    });

    it('should not show actions for user messages', () => {
      const onCopy = jest.fn();
      render(<ChatMessage {...defaultProps} role="user" onCopy={onCopy} />);

      expect(screen.queryByTitle('Copy message')).not.toBeInTheDocument();
    });
  });

  describe('Model display', () => {
    it('should display model name for assistant messages', () => {
      render(<ChatMessage {...defaultProps} model="gpt-4" showActions={true} onCopy={() => {}} />);

      expect(screen.getByText('gpt-4')).toBeInTheDocument();
    });

    it('should not display "openrouter/auto" model', () => {
      render(<ChatMessage {...defaultProps} model="openrouter/auto" showActions={true} onCopy={() => {}} />);

      expect(screen.queryByText('openrouter/auto')).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply user message styling', () => {
      const { container } = render(<ChatMessage {...defaultProps} role="user" />);

      const card = container.querySelector('.bg-blue-600');
      expect(card).toBeInTheDocument();
    });

    it('should apply assistant message styling', () => {
      const { container } = render(<ChatMessage {...defaultProps} role="assistant" />);

      const card = container.querySelector('.bg-transparent');
      expect(card).toBeInTheDocument();
    });

    it('should align user messages to the right', () => {
      const { container } = render(<ChatMessage {...defaultProps} role="user" />);

      const messageContainer = container.querySelector('.justify-end');
      expect(messageContainer).toBeInTheDocument();
    });

    it('should align assistant messages to the left', () => {
      const { container } = render(<ChatMessage {...defaultProps} role="assistant" />);

      const messageContainer = container.querySelector('.justify-start');
      expect(messageContainer).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('should be a memoized component', () => {
      expect(ChatMessage.displayName).toBe('ChatMessage');
    });
  });

  describe('Stopped indicator (wasStopped)', () => {
    it('should show "Response stopped" indicator when wasStopped is true and not streaming', () => {
      render(<ChatMessage {...defaultProps} wasStopped={true} isStreaming={false} />);

      expect(screen.getByText('Response stopped')).toBeInTheDocument();
    });

    it('should not show stopped indicator when wasStopped is false', () => {
      render(<ChatMessage {...defaultProps} wasStopped={false} isStreaming={false} />);

      expect(screen.queryByText('Response stopped')).not.toBeInTheDocument();
    });

    it('should not show stopped indicator when still streaming', () => {
      // Even if wasStopped is somehow set while streaming, indicator should not show
      render(<ChatMessage {...defaultProps} wasStopped={true} isStreaming={true} />);

      // Should show streaming indicator instead
      expect(screen.queryByText('Response stopped')).not.toBeInTheDocument();
    });

    it('should not show stopped indicator when wasStopped is undefined', () => {
      render(<ChatMessage {...defaultProps} wasStopped={undefined} isStreaming={false} />);

      expect(screen.queryByText('Response stopped')).not.toBeInTheDocument();
    });

    it('should apply italic styling to stopped indicator', () => {
      const { container } = render(<ChatMessage {...defaultProps} wasStopped={true} isStreaming={false} />);

      const stoppedIndicator = container.querySelector('.italic');
      expect(stoppedIndicator).toBeInTheDocument();
      expect(stoppedIndicator).toHaveTextContent('Response stopped');
    });

    it('should show content alongside stopped indicator', () => {
      render(<ChatMessage {...defaultProps} content="Partial response text" wasStopped={true} isStreaming={false} />);

      // Both content and stopped indicator should be present
      expect(screen.getByText('Partial response text')).toBeInTheDocument();
      expect(screen.getByText('Response stopped')).toBeInTheDocument();
    });
  });

  describe('Memoization comparison with wasStopped', () => {
    // The custom comparison function should include wasStopped
    it('should have wasStopped in comparison function', () => {
      // Verify by checking the component re-renders when wasStopped changes
      const { rerender } = render(<ChatMessage {...defaultProps} wasStopped={false} />);

      // Should not show indicator initially
      expect(screen.queryByText('Response stopped')).not.toBeInTheDocument();

      // Rerender with wasStopped=true
      rerender(<ChatMessage {...defaultProps} wasStopped={true} />);

      // Should now show the indicator (proves comparison function works)
      expect(screen.getByText('Response stopped')).toBeInTheDocument();
    });
  });
});
