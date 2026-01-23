import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameOfLife } from '../GameOfLife';

// Mock the hook
const mockToggleCell = jest.fn();
const mockSetCell = jest.fn();
const mockSetGridSize = jest.fn();

// Create a grid with specific values for testing drag behavior
const createMockGrid = () => {
  const grid = Array(10)
    .fill(null)
    .map(() => Array(10).fill(false));
  // Set some cells to true to test draw/erase modes
  grid[1][1] = true;
  return grid;
};

jest.mock('../useGameOfLife', () => ({
  useGameOfLife: () => ({
    grid: createMockGrid(),
    isPlaying: false,
    generation: 0,
    speed: 150,
    gridSize: { cols: 10, rows: 10 },
    play: jest.fn(),
    pause: jest.fn(),
    toggle: jest.fn(),
    reset: jest.fn(),
    setSpeed: jest.fn(),
    toggleCell: mockToggleCell,
    setCell: mockSetCell,
    setGridSize: mockSetGridSize,
  }),
}));

// Mock ResizeObserver
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = mockObserve;
    disconnect = mockDisconnect;
    unobserve = jest.fn();
    constructor(callback: ResizeObserverCallback) {
      // Call the callback immediately with mock entries
      setTimeout(() => {
        callback(
          [
            {
              contentRect: { width: 120, height: 120 },
              target: document.createElement('div'),
              borderBoxSize: [],
              contentBoxSize: [],
              devicePixelContentBoxSize: [],
            },
          ] as ResizeObserverEntry[],
          this
        );
      }, 0);
    }
  };
});

// Mock matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

describe('GameOfLife', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the container with role="application"', () => {
    render(<GameOfLife />);
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('has proper aria-label for accessibility', () => {
    render(<GameOfLife />);
    expect(
      screen.getByLabelText(/Conway's Game of Life simulation/i)
    ).toBeInTheDocument();
  });

  it('renders canvas element', () => {
    render(<GameOfLife />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('applies custom className to container', () => {
    render(<GameOfLife className="custom-class" />);
    const container = screen.getByRole('application');
    expect(container).toHaveClass('custom-class');
  });

  it('canvas has touch-none class for proper mobile handling', () => {
    render(<GameOfLife />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);
    expect(canvas).toHaveClass('touch-none');
  });

  it('canvas is focusable for keyboard accessibility', () => {
    render(<GameOfLife />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);
    expect(canvas).toHaveAttribute('tabIndex', '0');
  });

  it('handles mouseDown events to toggle cells', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    // Mock getBoundingClientRect
    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    fireEvent.mouseDown(canvas, { clientX: 15, clientY: 15 });

    expect(mockToggleCell).toHaveBeenCalledWith(1, 1); // row 1, col 1 for cellSize 12
  });

  it('handles touchStart events for mobile', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 25, clientY: 25 }],
    });

    expect(mockToggleCell).toHaveBeenCalledWith(2, 2); // row 2, col 2 for cellSize 12
  });

  it('handles drag interaction with mouseMove after mouseDown', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Start drag at cell (0,0) which is dead in our mock grid
    fireEvent.mouseDown(canvas, { clientX: 5, clientY: 5 });
    expect(mockToggleCell).toHaveBeenCalledWith(0, 0);

    // Move to cell (0,1)
    fireEvent.mouseMove(canvas, { clientX: 17, clientY: 5 });
    expect(mockSetCell).toHaveBeenCalledWith(0, 1, true); // Drawing mode since first cell was dead

    // End drag
    fireEvent.mouseUp(canvas);
  });

  it('handles touch drag interaction', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Start drag at cell (0,0)
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 5, clientY: 5 }],
    });
    expect(mockToggleCell).toHaveBeenCalledWith(0, 0);

    // Move to cell (0,1)
    fireEvent.touchMove(canvas, {
      touches: [{ clientX: 17, clientY: 5 }],
    });
    expect(mockSetCell).toHaveBeenCalledWith(0, 1, true);

    // End drag
    fireEvent.touchEnd(canvas);
  });

  it('does not activate cells on mouseMove without mouseDown', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Move without prior mouseDown
    fireEvent.mouseMove(canvas, { clientX: 15, clientY: 15 });

    expect(mockToggleCell).not.toHaveBeenCalled();
    expect(mockSetCell).not.toHaveBeenCalled();
  });

  it('stops dragging on mouseLeave', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Start drag
    fireEvent.mouseDown(canvas, { clientX: 5, clientY: 5 });
    mockSetCell.mockClear();

    // Leave canvas
    fireEvent.mouseLeave(canvas);

    // Move should not activate cells after leaving
    fireEvent.mouseMove(canvas, { clientX: 17, clientY: 5 });
    expect(mockSetCell).not.toHaveBeenCalled();
  });

  it('does not trigger setCell when staying on the same cell during drag', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Start drag at cell (0,0)
    fireEvent.mouseDown(canvas, { clientX: 5, clientY: 5 });
    mockSetCell.mockClear();

    // Move within the same cell (still at 0,0)
    fireEvent.mouseMove(canvas, { clientX: 6, clientY: 6 });
    expect(mockSetCell).not.toHaveBeenCalled();

    // Move to different cell (0,1)
    fireEvent.mouseMove(canvas, { clientX: 17, clientY: 5 });
    expect(mockSetCell).toHaveBeenCalledWith(0, 1, true);
  });

  it('stops dragging on global mouseup event', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Start drag
    fireEvent.mouseDown(canvas, { clientX: 5, clientY: 5 });
    mockSetCell.mockClear();

    // Global mouseup (not on canvas)
    fireEvent.mouseUp(window);

    // Move should not activate cells after global mouseup
    fireEvent.mouseMove(canvas, { clientX: 17, clientY: 5 });
    expect(mockSetCell).not.toHaveBeenCalled();
  });

  it('handles touchEnd to stop dragging', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Start touch drag
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 5, clientY: 5 }],
    });
    mockSetCell.mockClear();

    // End touch
    fireEvent.touchEnd(canvas);

    // Move should not activate cells after touchEnd
    fireEvent.touchMove(canvas, {
      touches: [{ clientX: 17, clientY: 5 }],
    });
    expect(mockSetCell).not.toHaveBeenCalled();
  });

  it('handles touchMove with no touches gracefully', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Start touch drag
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 5, clientY: 5 }],
    });
    mockSetCell.mockClear();

    // Touch move with empty touches array
    fireEvent.touchMove(canvas, { touches: [] });

    // Should not call setCell since there are no touches
    expect(mockSetCell).not.toHaveBeenCalled();
  });

  it('uses external gameState when provided', () => {
    const externalToggleCell = jest.fn();
    const externalGameState = {
      grid: Array(5)
        .fill(null)
        .map(() => Array(5).fill(false)),
      isPlaying: true,
      generation: 10,
      speed: 100,
      gridSize: { cols: 5, rows: 5 },
      play: jest.fn(),
      pause: jest.fn(),
      toggle: jest.fn(),
      reset: jest.fn(),
      setSpeed: jest.fn(),
      toggleCell: externalToggleCell,
      setCell: jest.fn(),
      setGridSize: jest.fn(),
    };

    render(<GameOfLife gameState={externalGameState} cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 60,
      height: 60,
      right: 60,
      bottom: 60,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    fireEvent.mouseDown(canvas, { clientX: 6, clientY: 6 });

    expect(externalToggleCell).toHaveBeenCalled();
    expect(mockToggleCell).not.toHaveBeenCalled();
  });

  it('calls onGridSizeChange when provided', async () => {
    const onGridSizeChange = jest.fn();

    render(<GameOfLife onGridSizeChange={onGridSizeChange} cellSize={12} />);

    // Wait for ResizeObserver callback
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onGridSizeChange).toHaveBeenCalled();
  });

  it('applies different cellSize', () => {
    render(<GameOfLife cellSize={20} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);
    expect(canvas).toBeInTheDocument();
  });

  it('handles touch event with no touches gracefully', () => {
    render(<GameOfLife cellSize={12} />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);

    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 120,
      height: 120,
      right: 120,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    // Fire touch event with empty touches array
    fireEvent.touchStart(canvas, { touches: [] });

    // Should not call toggleCell when there are no touches
    expect(mockToggleCell).not.toHaveBeenCalled();
  });

  it('has cursor-pointer class for visual feedback', () => {
    render(<GameOfLife />);
    const canvas = screen.getByLabelText(/Game of Life grid/i);
    expect(canvas).toHaveClass('cursor-pointer');
  });

  it('container has minimum height', () => {
    render(<GameOfLife />);
    const container = screen.getByRole('application');
    expect(container).toHaveClass('min-h-[200px]');
  });
});
