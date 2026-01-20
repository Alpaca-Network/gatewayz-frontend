import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MiniChatWidget } from '../mini-chat-widget';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Sparkles: () => <span data-testid="sparkles-icon">Sparkles</span>,
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: React.forwardRef<HTMLButtonElement, any>(({ children, disabled, onClick, title, ...props }, ref) => (
    <button ref={ref} disabled={disabled} onClick={onClick} title={title} data-testid="button" {...props}>
      {children}
    </button>
  )),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, onKeyDown, placeholder, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      data-testid="input"
      {...props}
    />
  ),
}));

// Mock SURPRISE_PROMPTS
jest.mock('@/lib/surprise-prompts', () => ({
  SURPRISE_PROMPTS: [
    'Test prompt 1',
    'Test prompt 2',
    'Test prompt 3',
  ],
}));

describe('MiniChatWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Math.random to always return 0 for predictable tests
    jest.spyOn(Math, 'random').mockReturnValue(0);

    // Mock Element.animate API for sparkle animations
    Element.prototype.animate = jest.fn(() => ({
      finished: Promise.resolve(),
      onfinish: null,
      cancel: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      reverse: jest.fn(),
      finish: jest.fn(),
      updatePlaybackRate: jest.fn(),
      persist: jest.fn(),
      commitStyles: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as any));

    // Mock timers for animation timing
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    // Clean up any sparkle particles
    document.querySelectorAll('.sparkle-particle').forEach(el => el.remove());
  });

  describe('Rendering', () => {
    it('should render the widget', () => {
      render(<MiniChatWidget />);

      expect(screen.getByTestId('input')).toBeInTheDocument();
      expect(screen.getByTestId('button')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<MiniChatWidget className="custom-class" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('custom-class');
    });

    it('should render with correct placeholder', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('placeholder', "What's on your mind?");
    });

    it('should render helper text', () => {
      render(<MiniChatWidget />);

      expect(screen.getByText(/Powered by 10,000\+ AI models • Try it for free/)).toBeInTheDocument();
    });
  });

  describe('Input State', () => {
    it('should update input value when user types', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Hello world' } });

      expect(input.value).toBe('Hello world');
    });

    it('should start with empty input', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('Button Icon Behavior', () => {
    it('should show Sparkles icon when input is empty', () => {
      render(<MiniChatWidget />);

      // There are multiple sparkles icons: one in the widget decoration and one in the button
      const sparklesIcons = screen.getAllByTestId('sparkles-icon');
      expect(sparklesIcons.length).toBeGreaterThan(0);
      expect(screen.queryByTestId('send-icon')).not.toBeInTheDocument();
    });

    it('should show Send icon when input has text', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Test message' } });

      expect(screen.getByTestId('send-icon')).toBeInTheDocument();
      // Widget decoration still has a sparkles icon, but button should show send
      const button = screen.getByTestId('button');
      expect(button.querySelector('[data-testid="send-icon"]')).toBeInTheDocument();
    });

    it('should show Sparkles icon when input has only whitespace', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: '   ' } });

      const sparklesIcons = screen.getAllByTestId('sparkles-icon');
      expect(sparklesIcons.length).toBeGreaterThan(0);
      expect(screen.queryByTestId('send-icon')).not.toBeInTheDocument();
    });
  });

  describe('Button Title Attribute', () => {
    it('should have "Surprise me!" title when input is empty', () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');
      expect(button).toHaveAttribute('title', 'Surprise me!');
    });

    it('should have "Send message" title when input has text', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Test message' } });

      const button = screen.getByTestId('button');
      expect(button).toHaveAttribute('title', 'Send message');
    });
  });

  describe('Send Message Functionality', () => {
    it('should navigate to chat with message when button is clicked with text', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Hello AI' } });

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      expect(mockPush).toHaveBeenCalledWith('/chat?message=Hello%20AI');
    });

    it('should navigate to chat when Enter key is pressed with text', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

      expect(mockPush).toHaveBeenCalledWith('/chat?message=Test%20message');
    });

    it('should not navigate when Enter+Shift is pressed', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should not navigate when input is empty and send is attempted', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should not navigate when input has only whitespace', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: '   ' } });

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should properly encode special characters in message', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Hello & goodbye!' } });

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      expect(mockPush).toHaveBeenCalledWith('/chat?message=Hello%20%26%20goodbye!');
    });
  });

  describe('Surprise Me Functionality', () => {
    it('should navigate with random prompt when button is clicked with empty input', async () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      // Fast-forward the setTimeout (300ms delay for animation)
      jest.advanceTimersByTime(300);

      // Wait for the navigation call
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?message=Test%20prompt%201');
      });
    });

    it('should select different prompts with different random values', async () => {
      // First test with random returning 0
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const { unmount } = render(<MiniChatWidget />);
      const button = screen.getByTestId('button');
      fireEvent.click(button);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?message=Test%20prompt%201');
      });

      unmount();
      mockPush.mockClear();
      // Clean up sparkles
      document.querySelectorAll('.sparkle-particle').forEach(el => el.remove());

      // Second test with random returning 0.5 (middle of array)
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      render(<MiniChatWidget />);
      const button2 = screen.getByTestId('button');
      fireEvent.click(button2);

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/chat?message=Test%20prompt%202');
      });
    });

    it('should disable button during animation', async () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      // Button should be disabled immediately after click
      expect(button).toBeDisabled();

      // Wait for navigation
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      }, { timeout: 400 });
    });

    it('should create sparkle particles when surprise me is clicked', () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      // Check that sparkle particles were created
      const sparkles = document.querySelectorAll('.sparkle-particle');
      expect(sparkles.length).toBe(12);
    });

    it('should clean up sparkle particles after animation', async () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      // Sparkles should exist initially
      let sparkles = document.querySelectorAll('.sparkle-particle');
      expect(sparkles.length).toBe(12);

      // Trigger animation completion callbacks manually
      const animateSpy = Element.prototype.animate as jest.Mock;
      const animationInstances = animateSpy.mock.results.map(r => r.value);
      animationInstances.forEach((instance: any) => {
        if (instance && typeof instance.onfinish === 'function') {
          instance.onfinish();
        }
      });

      // Wait for particles to be removed
      await waitFor(() => {
        sparkles = document.querySelectorAll('.sparkle-particle');
        expect(sparkles.length).toBe(0);
      });
    });
  });

  describe('Magical Animation', () => {
    it('should apply pulse and scale classes during animation', () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      // Button should have animation classes
      expect(button.className).toContain('animate-pulse');
      expect(button.className).toContain('scale-110');
    });

    it('should apply animation classes during surprise me', async () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');

      // Initially button should not be disabled
      expect(button).not.toBeDisabled();

      fireEvent.click(button);

      // Button should be disabled during animation
      expect(button).toBeDisabled();

      // Wait for animation classes to be applied
      await waitFor(() => {
        expect(button.className).toContain('animate-pulse');
        expect(button.className).toContain('scale-110');
      });
    });

    it('should position sparkle particles at button center', () => {
      // Mock getBoundingClientRect
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 200,
        width: 48,
        height: 48,
        right: 148,
        bottom: 248,
        x: 100,
        y: 200,
        toJSON: () => {},
      }));

      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      const sparkles = document.querySelectorAll('.sparkle-particle');
      sparkles.forEach(sparkle => {
        const element = sparkle as HTMLElement;
        // Each sparkle should be positioned at button center (100 + 24, 200 + 24)
        expect(element.style.left).toBe('124px');
        expect(element.style.top).toBe('224px');
      });
    });

    it('should create sparkles with random animation durations', () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');

      // Mock random to return predictable values
      const randomSpy = jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0) // For prompt selection
        .mockReturnValueOnce(0.5) // For distance
        .mockReturnValueOnce(0.5); // For duration

      fireEvent.click(button);

      // Random should be called multiple times for sparkle positioning
      expect(randomSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button tooltip for screen readers', () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');
      expect(button).toHaveAttribute('title');
    });

    it('should be keyboard navigable', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      const button = screen.getByTestId('button');

      // Both should be in tab order
      expect(input).not.toHaveAttribute('tabindex', '-1');
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', () => {
      render(<MiniChatWidget />);

      const longMessage = 'A'.repeat(1000);
      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: longMessage } });

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      expect(mockPush).toHaveBeenCalled();
      const callArg = mockPush.mock.calls[0][0] as string;
      expect(callArg).toContain(encodeURIComponent(longMessage));
    });

    it('should handle unicode characters', () => {
      render(<MiniChatWidget />);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Hello 世界 🌍' } });

      const button = screen.getByTestId('button');
      fireEvent.click(button);

      expect(mockPush).toHaveBeenCalledWith('/chat?message=Hello%20%E4%B8%96%E7%95%8C%20%F0%9F%8C%8D');
    });

    it('should handle rapid clicking on surprise me button', async () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');

      // Click multiple times rapidly
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Advance timers
      jest.advanceTimersByTime(300);

      // Should only navigate once (button is disabled after first click)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle button ref being null', () => {
      render(<MiniChatWidget />);

      // This should not throw even if ref is null initially
      expect(() => {
        const button = screen.getByTestId('button');
        fireEvent.click(button);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should not create excessive DOM nodes', () => {
      const { container } = render(<MiniChatWidget />);

      const allElements = container.querySelectorAll('*');
      // Should have reasonable number of elements (not excessive)
      expect(allElements.length).toBeLessThan(50);
    });

    it('should clean up sparkle particles to prevent memory leaks', async () => {
      render(<MiniChatWidget />);

      const button = screen.getByTestId('button');

      // Create sparkles
      fireEvent.click(button);

      // Advance time to complete navigation
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      });

      // Sparkles should be created
      const sparkles = document.querySelectorAll('.sparkle-particle');
      expect(sparkles.length).toBe(12);

      // Trigger animation completion callbacks
      const animateSpy = Element.prototype.animate as jest.Mock;
      const animationInstances = animateSpy.mock.results.map(r => r.value);
      animationInstances.forEach((instance: any) => {
        if (instance && instance.onfinish) {
          instance.onfinish();
        }
      });

      // Sparkles should be cleaned up
      await waitFor(() => {
        const remainingSparkles = document.querySelectorAll('.sparkle-particle');
        expect(remainingSparkles.length).toBe(0);
      });
    });
  });
});
