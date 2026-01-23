import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameOfLife } from '../GameOfLife';

// Mock the hook
const mockToggleCell = jest.fn();
const mockSetCell = jest.fn();
const mockSetGridSize = jest.fn();

jest.mock('../useGameOfLife', () => ({
  useGameOfLife: () => ({
    grid: Array(10)
      .fill(null)
      .map(() => Array(10).fill(false)),
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

  it('handles mousedown events to toggle cells', () => {
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

  it('handles drag to activate multiple cells', () => {
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

    // Start drag at cell (1, 1)
    fireEvent.mouseDown(canvas, { clientX: 15, clientY: 15 });
    expect(mockToggleCell).toHaveBeenCalledWith(1, 1);

    // Move to cell (2, 2)
    fireEvent.mouseMove(canvas, { clientX: 27, clientY: 27 });
    expect(mockSetCell).toHaveBeenCalledWith(2, 2, true);

    // Move to cell (3, 3)
    fireEvent.mouseMove(canvas, { clientX: 39, clientY: 39 });
    expect(mockSetCell).toHaveBeenCalledWith(3, 3, true);

    // End drag
    fireEvent.mouseUp(canvas);
  });

  it('does not activate cells on mousemove without mousedown', () => {
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

    // Move without dragging
    fireEvent.mouseMove(canvas, { clientX: 27, clientY: 27 });

    expect(mockSetCell).not.toHaveBeenCalled();
    expect(mockToggleCell).not.toHaveBeenCalled();
  });

  it('stops dragging on mouseup', () => {
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
    fireEvent.mouseDown(canvas, { clientX: 15, clientY: 15 });
    mockToggleCell.mockClear();
    mockSetCell.mockClear();

    // End drag
    fireEvent.mouseUp(canvas);

    // Try to move after mouseup
    fireEvent.mouseMove(canvas, { clientX: 27, clientY: 27 });

    expect(mockSetCell).not.toHaveBeenCalled();
  });

  it('stops dragging on mouseleave', () => {
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
    fireEvent.mouseDown(canvas, { clientX: 15, clientY: 15 });
    mockToggleCell.mockClear();
    mockSetCell.mockClear();

    // Leave canvas
    fireEvent.mouseLeave(canvas);

    // Try to move after leaving (shouldn't do anything)
    fireEvent.mouseMove(canvas, { clientX: 27, clientY: 27 });

    expect(mockSetCell).not.toHaveBeenCalled();
  });

  it('handles touch events for mobile', () => {
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

  it('handles touch drag to activate multiple cells', () => {
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

    // Start touch at cell (1, 1)
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 15, clientY: 15 }],
    });
    expect(mockToggleCell).toHaveBeenCalledWith(1, 1);

    // Move to cell (2, 2)
    fireEvent.touchMove(canvas, {
      touches: [{ clientX: 27, clientY: 27 }],
    });
    expect(mockSetCell).toHaveBeenCalledWith(2, 2, true);

    // End touch
    fireEvent.touchEnd(canvas);
  });

  it('uses external gameState when provided', () => {
    const externalToggleCell = jest.fn();
    const externalSetCell = jest.fn();
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
      setCell: externalSetCell,
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
