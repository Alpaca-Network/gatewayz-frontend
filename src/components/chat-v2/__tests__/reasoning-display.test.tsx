import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ReasoningDisplay } from '../reasoning-display';

// Mock Badge component
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span data-testid="badge" className={className}>{children}</span>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  BrainCircuit: () => <span data-testid="icon-brain">BrainIcon</span>,
  Check: () => <span data-testid="icon-check">CheckIcon</span>,
  Loader2: ({ className }: any) => <span data-testid="icon-loader" className={className}>LoaderIcon</span>,
  Sparkles: () => <span data-testid="icon-sparkles">SparklesIcon</span>,
}));

// Mock the chain-of-thought components
jest.mock('../chain-of-thought', () => ({
  ChainOfThought: ({ children, open, onOpenChange, className }: any) => (
    <div data-testid="chain-of-thought" data-open={open} className={className}>
      <button onClick={() => onOpenChange(!open)} data-testid="toggle-button">Toggle</button>
      {children}
    </div>
  ),
  ChainOfThoughtHeader: ({ children, badge, className }: any) => (
    <div data-testid="chain-of-thought-header" className={className}>
      {children}
      {badge && <span data-testid="header-badge">{badge}</span>}
    </div>
  ),
  ChainOfThoughtContent: ({ children, className }: any) => (
    <div data-testid="chain-of-thought-content" className={className}>{children}</div>
  ),
  ChainOfThoughtStep: ({ children, icon: Icon, label, status }: any) => (
    <div data-testid="chain-of-thought-step" data-status={status}>
      <span data-testid="step-label">{label}</span>
      {children}
    </div>
  ),
}));

describe('ReasoningDisplay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders nothing when reasoning is empty', () => {
      const { container } = render(<ReasoningDisplay reasoning="" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when reasoning is only whitespace', () => {
      const { container } = render(<ReasoningDisplay reasoning="   " />);
      expect(container.firstChild).toBeNull();
    });

    it('renders reasoning content when provided', () => {
      render(<ReasoningDisplay reasoning="Test reasoning content" />);
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();
    });

    it('displays "Chain of Thought" header when not streaming', () => {
      render(<ReasoningDisplay reasoning="Test" isStreaming={false} />);
      expect(screen.getByText('Chain of Thought')).toBeInTheDocument();
    });

    it('displays "Thinking…" header when streaming', () => {
      render(<ReasoningDisplay reasoning="Test" isStreaming={true} />);
      expect(screen.getByText('Thinking…')).toBeInTheDocument();
    });
  });

  describe('Collapsed State', () => {
    it('starts collapsed by default', () => {
      render(<ReasoningDisplay reasoning="Test" />);
      const chainOfThought = screen.getByTestId('chain-of-thought');
      expect(chainOfThought).toHaveAttribute('data-open', 'false');
    });

    it('allows manual toggle', () => {
      render(<ReasoningDisplay reasoning="Test" />);
      const toggleButton = screen.getByTestId('toggle-button');

      // Initially collapsed
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'false');

      // Click to expand
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'true');

      // Click to collapse
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'false');
    });
  });

  describe('Auto-expand Behavior', () => {
    it('auto-expands when streaming and content has not started', () => {
      const { rerender } = render(
        <ReasoningDisplay reasoning="Test" isStreaming={false} hasContentStarted={false} />
      );

      // Initially collapsed
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'false');

      // Start streaming without content - should auto-expand
      rerender(
        <ReasoningDisplay reasoning="Test" isStreaming={true} hasContentStarted={false} />
      );
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'true');
    });

    it('does not auto-expand if user has manually toggled', () => {
      const { rerender } = render(
        <ReasoningDisplay reasoning="Test" isStreaming={false} hasContentStarted={false} />
      );

      // User manually expands then collapses
      const toggleButton = screen.getByTestId('toggle-button');
      fireEvent.click(toggleButton); // expand
      fireEvent.click(toggleButton); // collapse

      // Start streaming - should NOT auto-expand because user toggled
      rerender(
        <ReasoningDisplay reasoning="Test" isStreaming={true} hasContentStarted={false} />
      );
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'false');
    });
  });

  describe('Auto-collapse Behavior', () => {
    it('auto-collapses when content starts streaming', () => {
      const { rerender } = render(
        <ReasoningDisplay reasoning="Test" isStreaming={true} hasContentStarted={false} />
      );

      // Auto-expanded from streaming
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'true');

      // Content starts streaming
      rerender(
        <ReasoningDisplay reasoning="Test" isStreaming={true} hasContentStarted={true} />
      );

      // Should auto-collapse after delay
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'false');
    });

    it('does not auto-collapse if user has manually toggled', () => {
      const { rerender } = render(
        <ReasoningDisplay reasoning="Test" isStreaming={true} hasContentStarted={false} />
      );

      // User manually interacts
      const toggleButton = screen.getByTestId('toggle-button');
      fireEvent.click(toggleButton); // This sets userToggledRef to true

      // Content starts streaming
      rerender(
        <ReasoningDisplay reasoning="Test" isStreaming={true} hasContentStarted={true} />
      );

      // Should NOT auto-collapse
      act(() => {
        jest.advanceTimersByTime(300);
      });
      // User toggled, so stays in their preferred state (which was collapsed after toggle from expanded)
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'false');
    });
  });

  describe('Reset Behavior', () => {
    it('resets toggle tracking when streaming ends', () => {
      const { rerender } = render(
        <ReasoningDisplay reasoning="Test" isStreaming={true} hasContentStarted={false} />
      );

      // User manually toggles
      const toggleButton = screen.getByTestId('toggle-button');
      fireEvent.click(toggleButton);

      // Streaming ends
      rerender(
        <ReasoningDisplay reasoning="Test" isStreaming={false} hasContentStarted={true} />
      );

      // Start new streaming session - should auto-expand since refs were reset
      rerender(
        <ReasoningDisplay reasoning="New test" isStreaming={true} hasContentStarted={false} />
      );
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'true');
    });
  });

  describe('Source Badge', () => {
    it('shows Gateway badge for gatewayz source', () => {
      render(<ReasoningDisplay reasoning="Test" source="gatewayz" />);
      expect(screen.getByText('Gateway')).toBeInTheDocument();
    });

    it('shows AI SDK badge for ai-sdk source', () => {
      render(<ReasoningDisplay reasoning="Test" source="ai-sdk" />);
      expect(screen.getByText('AI SDK')).toBeInTheDocument();
    });
  });

  describe('Structured Steps', () => {
    it('renders structured steps when provided', () => {
      const steps = [
        { id: '1', title: 'Step 1', content: 'First step content', status: 'completed' as const },
        { id: '2', title: 'Step 2', content: 'Second step content', status: 'in_progress' as const },
      ];

      render(<ReasoningDisplay reasoning="" steps={steps} />);

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Step 2')).toBeInTheDocument();
      expect(screen.getByText('First step content')).toBeInTheDocument();
      expect(screen.getByText('Second step content')).toBeInTheDocument();
    });

    it('shows correct status for steps', () => {
      const steps = [
        { id: '1', title: 'Done', content: 'Done content', status: 'completed' as const },
        { id: '2', title: 'In Progress', content: 'Progress content', status: 'in_progress' as const },
      ];

      render(<ReasoningDisplay reasoning="" steps={steps} />);

      const stepElements = screen.getAllByTestId('chain-of-thought-step');
      expect(stepElements[0]).toHaveAttribute('data-status', 'complete');
      expect(stepElements[1]).toHaveAttribute('data-status', 'active');
    });
  });

  describe('hasContentStarted prop', () => {
    it('starts collapsed when hasContentStarted is true', () => {
      render(<ReasoningDisplay reasoning="Test" hasContentStarted={true} />);
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'false');
    });

    it('remains collapsed for completed messages', () => {
      render(
        <ReasoningDisplay
          reasoning="Test"
          isStreaming={false}
          hasContentStarted={true}
        />
      );
      expect(screen.getByTestId('chain-of-thought')).toHaveAttribute('data-open', 'false');
    });
  });
});
