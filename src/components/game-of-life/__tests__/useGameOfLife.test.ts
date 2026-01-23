import { renderHook, act } from '@testing-library/react';
import { useGameOfLife } from '../useGameOfLife';
import { PATTERN_404 } from '../patterns';

// Mock requestAnimationFrame and cancelAnimationFrame
const mockRAF = jest.fn((cb: FrameRequestCallback) => {
  return setTimeout(() => cb(performance.now()), 16) as unknown as number;
});
const mockCAF = jest.fn((id: number) => {
  clearTimeout(id);
});

beforeAll(() => {
  global.requestAnimationFrame = mockRAF;
  global.cancelAnimationFrame = mockCAF;
});

describe('useGameOfLife', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('initializes with default grid size', () => {
      const { result } = renderHook(() => useGameOfLife());
      expect(result.current.gridSize.cols).toBe(60);
      expect(result.current.gridSize.rows).toBe(40);
    });

    it('initializes with custom grid size', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 30, initialRows: 20 })
      );
      expect(result.current.gridSize.cols).toBe(30);
      expect(result.current.gridSize.rows).toBe(20);
    });

    it('initializes with custom speed', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialSpeed: 200 })
      );
      expect(result.current.speed).toBe(200);
    });

    it('starts paused', () => {
      const { result } = renderHook(() => useGameOfLife());
      expect(result.current.isPlaying).toBe(false);
    });

    it('starts at generation 0', () => {
      const { result } = renderHook(() => useGameOfLife());
      expect(result.current.generation).toBe(0);
    });

    it('creates grid with 404 pattern (has alive cells)', () => {
      const { result } = renderHook(() => useGameOfLife());
      const aliveCount = result.current.grid.flat().filter(Boolean).length;
      // 404 pattern has specific number of cells
      expect(aliveCount).toBe(PATTERN_404.length);
    });

    it('creates grid with correct dimensions', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 25, initialRows: 15 })
      );
      expect(result.current.grid.length).toBe(15);
      expect(result.current.grid[0].length).toBe(25);
    });
  });

  describe('play/pause', () => {
    it('play sets isPlaying to true', () => {
      const { result } = renderHook(() => useGameOfLife());

      expect(result.current.isPlaying).toBe(false);

      act(() => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);
    });

    it('pause sets isPlaying to false', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.play();
      });
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.pause();
      });
      expect(result.current.isPlaying).toBe(false);
    });

    it('toggle switches between play and pause', () => {
      const { result } = renderHook(() => useGameOfLife());

      expect(result.current.isPlaying).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isPlaying).toBe(false);
    });

    it('calling play multiple times does not cause issues', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.play();
        result.current.play();
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets generation to 0', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Manually toggle a cell to change state
      act(() => {
        result.current.toggleCell(0, 0);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.generation).toBe(0);
    });

    it('pauses the simulation when reset', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.play();
      });
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.reset();
      });
      expect(result.current.isPlaying).toBe(false);
    });

    it('restores the 404 pattern', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Toggle some cells to change the pattern
      act(() => {
        result.current.toggleCell(0, 0);
        result.current.toggleCell(1, 1);
        result.current.toggleCell(2, 2);
      });

      act(() => {
        result.current.reset();
      });

      const aliveCount = result.current.grid.flat().filter(Boolean).length;
      expect(aliveCount).toBe(PATTERN_404.length);
    });
  });

  describe('speed control', () => {
    it('sets speed to the given value', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.setSpeed(200);
      });

      expect(result.current.speed).toBe(200);
    });

    it('clamps speed to minimum 50ms', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.setSpeed(10);
      });

      expect(result.current.speed).toBe(50);
    });

    it('clamps speed to maximum 500ms', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.setSpeed(1000);
      });

      expect(result.current.speed).toBe(500);
    });

    it('accepts values within range', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.setSpeed(300);
      });

      expect(result.current.speed).toBe(300);
    });
  });

  describe('toggleCell', () => {
    it('toggles a dead cell to alive', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 10, initialRows: 10 })
      );

      // Find a dead cell
      const row = 0;
      const col = 0;
      const initialState = result.current.grid[row][col];

      act(() => {
        result.current.toggleCell(row, col);
      });

      expect(result.current.grid[row][col]).toBe(!initialState);
    });

    it('toggles an alive cell to dead', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 10, initialRows: 10 })
      );

      // Toggle once to make it alive (if dead) or dead (if alive)
      act(() => {
        result.current.toggleCell(0, 0);
      });
      const firstState = result.current.grid[0][0];

      // Toggle again to reverse
      act(() => {
        result.current.toggleCell(0, 0);
      });

      expect(result.current.grid[0][0]).toBe(!firstState);
    });

    it('handles negative row index gracefully', () => {
      const { result } = renderHook(() => useGameOfLife());
      const gridBefore = JSON.stringify(result.current.grid);

      act(() => {
        result.current.toggleCell(-1, 5);
      });

      expect(JSON.stringify(result.current.grid)).toBe(gridBefore);
    });

    it('handles negative col index gracefully', () => {
      const { result } = renderHook(() => useGameOfLife());
      const gridBefore = JSON.stringify(result.current.grid);

      act(() => {
        result.current.toggleCell(5, -1);
      });

      expect(JSON.stringify(result.current.grid)).toBe(gridBefore);
    });

    it('handles out of bounds row gracefully', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 10, initialRows: 10 })
      );
      const gridBefore = JSON.stringify(result.current.grid);

      act(() => {
        result.current.toggleCell(100, 5);
      });

      expect(JSON.stringify(result.current.grid)).toBe(gridBefore);
    });

    it('handles out of bounds col gracefully', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 10, initialRows: 10 })
      );
      const gridBefore = JSON.stringify(result.current.grid);

      act(() => {
        result.current.toggleCell(5, 100);
      });

      expect(JSON.stringify(result.current.grid)).toBe(gridBefore);
    });
  });

  describe('setCell', () => {
    it('sets a dead cell to alive', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 10, initialRows: 10 })
      );

      // Ensure cell is dead first
      if (result.current.grid[0][0]) {
        act(() => {
          result.current.toggleCell(0, 0);
        });
      }
      expect(result.current.grid[0][0]).toBe(false);

      act(() => {
        result.current.setCell(0, 0, true);
      });

      expect(result.current.grid[0][0]).toBe(true);
    });

    it('sets an alive cell to dead', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 10, initialRows: 10 })
      );

      // Ensure cell is alive first
      if (!result.current.grid[0][0]) {
        act(() => {
          result.current.toggleCell(0, 0);
        });
      }
      expect(result.current.grid[0][0]).toBe(true);

      act(() => {
        result.current.setCell(0, 0, false);
      });

      expect(result.current.grid[0][0]).toBe(false);
    });

    it('does not change grid when setting cell to same state', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 10, initialRows: 10 })
      );

      // Ensure cell is alive
      if (!result.current.grid[0][0]) {
        act(() => {
          result.current.toggleCell(0, 0);
        });
      }

      const gridBefore = result.current.grid;

      act(() => {
        result.current.setCell(0, 0, true); // Already true
      });

      // Grid reference should be the same (no new grid created)
      expect(result.current.grid).toBe(gridBefore);
    });

    it('handles out of bounds gracefully', () => {
      const { result } = renderHook(() =>
        useGameOfLife({ initialCols: 10, initialRows: 10 })
      );

      const gridBefore = JSON.stringify(result.current.grid);

      act(() => {
        result.current.setCell(-1, 0, true);
        result.current.setCell(0, -1, true);
        result.current.setCell(100, 0, true);
        result.current.setCell(0, 100, true);
      });

      expect(JSON.stringify(result.current.grid)).toBe(gridBefore);
    });
  });

  describe('setGridSize', () => {
    it('updates grid size', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.setGridSize(30, 20);
      });

      expect(result.current.gridSize.cols).toBe(30);
      expect(result.current.gridSize.rows).toBe(20);
      expect(result.current.grid.length).toBe(20);
      expect(result.current.grid[0].length).toBe(30);
    });

    it('resets generation when grid size changes', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Toggle a cell to simulate activity
      act(() => {
        result.current.toggleCell(0, 0);
      });

      act(() => {
        result.current.setGridSize(50, 30);
      });

      expect(result.current.generation).toBe(0);
    });

    it('ignores invalid dimensions (zero cols)', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.setGridSize(0, 20);
      });

      // Should not change from defaults
      expect(result.current.gridSize.cols).toBe(60);
    });

    it('ignores invalid dimensions (negative rows)', () => {
      const { result } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.setGridSize(30, -5);
      });

      // Should not change from defaults
      expect(result.current.gridSize.rows).toBe(40);
    });
  });

  describe('Game of Life rules', () => {
    // Helper to create a clean grid and manually set specific cells
    // First clears ALL cells, then sets the specified ones
    function setupCleanGridWithCells(
      result: { current: ReturnType<typeof useGameOfLife> },
      size: number,
      aliveCells: [number, number][]
    ) {
      // Set a new grid size - this resets with 404 pattern
      act(() => {
        result.current.setGridSize(size, size);
      });

      // First, turn OFF all cells that are on (from 404 pattern)
      const grid = result.current.grid;
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          if (grid[row][col]) {
            act(() => {
              result.current.toggleCell(row, col);
            });
          }
        }
      }

      // Now toggle ON the specified cells
      aliveCells.forEach(([row, col]) => {
        act(() => {
          result.current.toggleCell(row, col);
        });
      });
    }

    it('grid can be set up with specific cells', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Create a 2x2 block pattern (stable)
      setupCleanGridWithCells(result, 8, [
        [2, 2],
        [2, 3],
        [3, 2],
        [3, 3],
      ]);

      const aliveCount = result.current.grid.flat().filter(Boolean).length;
      expect(aliveCount).toBe(4);

      // Verify specific cells
      expect(result.current.grid[2][2]).toBe(true);
      expect(result.current.grid[2][3]).toBe(true);
      expect(result.current.grid[3][2]).toBe(true);
      expect(result.current.grid[3][3]).toBe(true);
    });

    it('oscillator: blinker pattern can be set up', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Create a horizontal blinker (3 cells in a row)
      setupCleanGridWithCells(result, 7, [
        [3, 2],
        [3, 3],
        [3, 4],
      ]);

      // Verify initial state - horizontal line
      expect(result.current.grid[3][2]).toBe(true);
      expect(result.current.grid[3][3]).toBe(true);
      expect(result.current.grid[3][4]).toBe(true);
      expect(result.current.grid[2][3]).toBe(false);
      expect(result.current.grid[4][3]).toBe(false);
    });

    it('underpopulation: single cell is isolated', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Create a single isolated cell
      setupCleanGridWithCells(result, 5, [[2, 2]]);

      expect(result.current.grid[2][2]).toBe(true);
      // Verify it's isolated (no neighbors)
      expect(result.current.grid[1][1]).toBe(false);
      expect(result.current.grid[1][2]).toBe(false);
      expect(result.current.grid[1][3]).toBe(false);
      expect(result.current.grid[2][1]).toBe(false);
      expect(result.current.grid[2][3]).toBe(false);
    });

    it('birth setup: dead cell has 3 neighbors', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Create an L-shape - the corner cell (2,2) is dead with 3 neighbors
      setupCleanGridWithCells(result, 6, [
        [1, 2], // neighbor above
        [2, 1], // neighbor left
        [2, 3], // neighbor right
      ]);

      // Cell (2,2) is dead but has 3 neighbors
      expect(result.current.grid[2][2]).toBe(false);
      expect(result.current.grid[1][2]).toBe(true);
      expect(result.current.grid[2][1]).toBe(true);
      expect(result.current.grid[2][3]).toBe(true);
    });

    it('survival setup: cell has 2 neighbors', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Create a diagonal line - middle cell has 2 neighbors
      setupCleanGridWithCells(result, 5, [
        [1, 1],
        [2, 2],
        [3, 3],
      ]);

      // Middle cell (2,2) is alive with 2 neighbors
      expect(result.current.grid[1][1]).toBe(true);
      expect(result.current.grid[2][2]).toBe(true);
      expect(result.current.grid[3][3]).toBe(true);
    });

    it('overpopulation setup: cell has 4 neighbors', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Create a plus shape - center cell has 4 neighbors
      setupCleanGridWithCells(result, 5, [
        [2, 2], // center
        [1, 2], // top neighbor
        [3, 2], // bottom neighbor
        [2, 1], // left neighbor
        [2, 3], // right neighbor
      ]);

      // Center cell is alive with 4 neighbors
      expect(result.current.grid[2][2]).toBe(true);
      expect(result.current.grid[1][2]).toBe(true);
      expect(result.current.grid[3][2]).toBe(true);
      expect(result.current.grid[2][1]).toBe(true);
      expect(result.current.grid[2][3]).toBe(true);
    });

    it('toroidal wrapping: cells on edges can be set', () => {
      const { result } = renderHook(() => useGameOfLife());

      // Small grid to test edge cells
      setupCleanGridWithCells(result, 5, [
        [0, 0], // top-left corner
        [0, 4], // top-right corner
        [4, 0], // bottom-left corner
        [4, 4], // bottom-right corner
      ]);

      // Verify corner cells are set
      expect(result.current.grid[0][0]).toBe(true);
      expect(result.current.grid[0][4]).toBe(true);
      expect(result.current.grid[4][0]).toBe(true);
      expect(result.current.grid[4][4]).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('cancels animation frame on unmount when playing', () => {
      // Use real timers for this test since we need RAF to actually fire
      jest.useRealTimers();

      const { result, unmount } = renderHook(() => useGameOfLife());

      act(() => {
        result.current.play();
      });

      // The play() should have called requestAnimationFrame
      expect(mockRAF).toHaveBeenCalled();

      unmount();

      // cancelAnimationFrame should have been called during cleanup
      expect(mockCAF).toHaveBeenCalled();
    });

    it('does not throw when unmounting while paused', () => {
      const { unmount } = renderHook(() => useGameOfLife());

      // Should not throw when unmounting without playing
      expect(() => unmount()).not.toThrow();
    });
  });
});
