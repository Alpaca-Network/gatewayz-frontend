import { render, screen, act } from '@testing-library/react';
import React from 'react';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Clock: () => <span data-testid="clock-icon">Clock</span>,
}));

// Mock store state
let mockMessageStartTime: number | null = null;

jest.mock('@/lib/store/chat-ui-store', () => ({
  useChatUIStore: (selector: (state: { messageStartTime: number | null }) => number | null) => {
    return selector({ messageStartTime: mockMessageStartTime });
  },
}));

// Import after mocks are set up
import { ChatTimer } from '../ChatTimer';

describe('ChatTimer', () => {
  beforeEach(() => {
    mockMessageStartTime = null;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('should not render when messageStartTime is null', () => {
      mockMessageStartTime = null;
      const { container } = render(<ChatTimer />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when messageStartTime is set', () => {
      mockMessageStartTime = Date.now();
      render(<ChatTimer />);
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('should display clock icon', () => {
      mockMessageStartTime = Date.now();
      render(<ChatTimer />);
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });
  });

  describe('time formatting', () => {
    it('should display milliseconds for times under 1 second', () => {
      const now = Date.now();
      mockMessageStartTime = now - 500; // 500ms ago
      jest.setSystemTime(now);

      render(<ChatTimer />);
      expect(screen.getByText(/500ms/)).toBeInTheDocument();
    });

    it('should display seconds with decimals for times 1-60 seconds', () => {
      const now = Date.now();
      mockMessageStartTime = now - 5000; // 5 seconds ago
      jest.setSystemTime(now);

      render(<ChatTimer />);
      expect(screen.getByText(/5\.00s/)).toBeInTheDocument();
    });

    it('should display minutes and seconds for times over 60 seconds', () => {
      const now = Date.now();
      mockMessageStartTime = now - 90000; // 1 minute 30 seconds ago
      jest.setSystemTime(now);

      render(<ChatTimer />);
      expect(screen.getByText(/1m 30\.00s/)).toBeInTheDocument();
    });
  });

  describe('timer updates', () => {
    it('should update elapsed time every 10ms', () => {
      const now = Date.now();
      mockMessageStartTime = now;
      jest.setSystemTime(now);

      render(<ChatTimer />);

      // Initial render should show 0ms
      expect(screen.getByText(/0ms/)).toBeInTheDocument();

      // Advance time by 100ms
      act(() => {
        jest.setSystemTime(now + 100);
        jest.advanceTimersByTime(10);
      });

      // Should show approximately 100ms (allow for small timing variations)
      expect(screen.getByText(/\d+ms/)).toBeInTheDocument();
    });

    it('should clean up interval on unmount', () => {
      mockMessageStartTime = Date.now();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = render(<ChatTimer />);
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should reset elapsed time when messageStartTime becomes null', () => {
      const now = Date.now();
      mockMessageStartTime = now - 5000;
      jest.setSystemTime(now);

      const { rerender } = render(<ChatTimer />);
      expect(screen.getByText(/5\.00s/)).toBeInTheDocument();

      // Simulate messageStartTime becoming null
      mockMessageStartTime = null;
      rerender(<ChatTimer />);

      // Component should not render anything
      expect(screen.queryByTestId('clock-icon')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very small elapsed times', () => {
      const now = Date.now();
      mockMessageStartTime = now - 1; // 1ms ago
      jest.setSystemTime(now);

      render(<ChatTimer />);
      expect(screen.getByText(/1ms/)).toBeInTheDocument();
    });

    it('should handle exactly 1 second', () => {
      const now = Date.now();
      mockMessageStartTime = now - 1000; // exactly 1 second
      jest.setSystemTime(now);

      render(<ChatTimer />);
      expect(screen.getByText(/1\.00s/)).toBeInTheDocument();
    });

    it('should handle exactly 60 seconds', () => {
      const now = Date.now();
      mockMessageStartTime = now - 60000; // exactly 60 seconds
      jest.setSystemTime(now);

      render(<ChatTimer />);
      expect(screen.getByText(/1m 0\.00s/)).toBeInTheDocument();
    });

    it('should handle long durations', () => {
      const now = Date.now();
      mockMessageStartTime = now - 125000; // 2 minutes 5 seconds
      jest.setSystemTime(now);

      render(<ChatTimer />);
      expect(screen.getByText(/2m 5\.00s/)).toBeInTheDocument();
    });
  });
});
