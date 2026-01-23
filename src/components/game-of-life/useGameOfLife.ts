'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createGridWithPattern } from './patterns';

export interface UseGameOfLifeOptions {
  initialCols?: number;
  initialRows?: number;
  initialSpeed?: number; // ms between generations
}

export interface UseGameOfLifeReturn {
  grid: boolean[][];
  isPlaying: boolean;
  generation: number;
  speed: number;
  gridSize: { cols: number; rows: number };
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  toggleCell: (row: number, col: number) => void;
  setCell: (row: number, col: number, alive: boolean) => void;
  setGridSize: (cols: number, rows: number) => void;
}

const MIN_SPEED = 50;
const MAX_SPEED = 500;
const DEFAULT_COLS = 60;
const DEFAULT_ROWS = 40;
const DEFAULT_SPEED = 150;

/**
 * Count the number of living neighbors for a cell
 * Uses toroidal (wrap-around) grid topology
 */
function countNeighbors(
  grid: boolean[][],
  row: number,
  col: number
): number {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let count = 0;

  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;

      // Wrap around edges (toroidal grid)
      const newRow = (row + i + rows) % rows;
      const newCol = (col + j + cols) % cols;

      if (grid[newRow][newCol]) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Compute the next generation according to Conway's Game of Life rules:
 * 1. Any live cell with 2 or 3 live neighbors survives
 * 2. Any dead cell with exactly 3 live neighbors becomes alive
 * 3. All other cells die or stay dead
 */
function computeNextGeneration(currentGrid: boolean[][]): boolean[][] {
  const rows = currentGrid.length;
  const cols = currentGrid[0]?.length ?? 0;

  const newGrid: boolean[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(false));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const neighbors = countNeighbors(currentGrid, row, col);
      const isAlive = currentGrid[row][col];

      if (isAlive && (neighbors === 2 || neighbors === 3)) {
        // Survival: live cell with 2-3 neighbors lives
        newGrid[row][col] = true;
      } else if (!isAlive && neighbors === 3) {
        // Birth: dead cell with exactly 3 neighbors becomes alive
        newGrid[row][col] = true;
      }
      // All other cells die or stay dead (already false)
    }
  }

  return newGrid;
}

/**
 * React hook for managing Conway's Game of Life state and logic
 */
export function useGameOfLife(
  options: UseGameOfLifeOptions = {}
): UseGameOfLifeReturn {
  const {
    initialCols = DEFAULT_COLS,
    initialRows = DEFAULT_ROWS,
    initialSpeed = DEFAULT_SPEED,
  } = options;

  const [gridSize, setGridSizeState] = useState({
    cols: initialCols,
    rows: initialRows,
  });
  const [grid, setGrid] = useState<boolean[][]>(() =>
    createGridWithPattern(initialCols, initialRows)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [speed, setSpeedState] = useState(initialSpeed);

  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);

  // Keep refs in sync with state for use in animation callback
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Animation loop using requestAnimationFrame
  const animate = useCallback((timestamp: number) => {
    if (!isPlayingRef.current) return;

    if (timestamp - lastUpdateRef.current >= speedRef.current) {
      setGrid((prev) => computeNextGeneration(prev));
      setGeneration((prev) => prev + 1);
      lastUpdateRef.current = timestamp;
    }

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Start animation
  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    setIsPlaying(true);
    lastUpdateRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);
  }, [animate]);

  // Stop animation
  const pause = useCallback(() => {
    setIsPlaying(false);
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Toggle play/pause
  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  // Reset to initial state with 404 pattern
  const reset = useCallback(() => {
    pause();
    setGrid(createGridWithPattern(gridSize.cols, gridSize.rows));
    setGeneration(0);
  }, [pause, gridSize.cols, gridSize.rows]);

  // Set speed with clamping
  const setSpeed = useCallback((newSpeed: number) => {
    setSpeedState(Math.max(MIN_SPEED, Math.min(MAX_SPEED, newSpeed)));
  }, []);

  // Toggle individual cell
  const toggleCell = useCallback((row: number, col: number) => {
    setGrid((prev) => {
      if (row < 0 || row >= prev.length) return prev;
      if (col < 0 || col >= (prev[0]?.length ?? 0)) return prev;

      const newGrid = prev.map((r) => [...r]);
      newGrid[row][col] = !newGrid[row][col];
      return newGrid;
    });
  }, []);

  // Set individual cell to a specific state (used for drag interactions)
  const setCell = useCallback((row: number, col: number, alive: boolean) => {
    setGrid((prev) => {
      if (row < 0 || row >= prev.length) return prev;
      if (col < 0 || col >= (prev[0]?.length ?? 0)) return prev;
      if (prev[row][col] === alive) return prev; // No change needed

      const newGrid = prev.map((r) => [...r]);
      newGrid[row][col] = alive;
      return newGrid;
    });
  }, []);

  // Update grid size and reset pattern
  const setGridSize = useCallback(
    (cols: number, rows: number) => {
      if (cols <= 0 || rows <= 0) return;
      setGridSizeState({ cols, rows });
      setGrid(createGridWithPattern(cols, rows));
      setGeneration(0);
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    grid,
    isPlaying,
    generation,
    speed,
    gridSize,
    play,
    pause,
    toggle,
    reset,
    setSpeed,
    toggleCell,
    setCell,
    setGridSize,
  };
}
