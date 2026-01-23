'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useGameOfLife, UseGameOfLifeReturn } from './useGameOfLife';
import { cn } from '@/lib/utils';

export interface GameOfLifeProps {
  className?: string;
  cellSize?: number;
  /** External hook instance - if not provided, creates internal one */
  gameState?: UseGameOfLifeReturn;
  /** Called when grid size changes based on container */
  onGridSizeChange?: (cols: number, rows: number) => void;
}

/**
 * Canvas-based Conway's Game of Life component
 * Supports click/touch to toggle cells, responsive sizing, and theme-aware colors
 */
export function GameOfLife({
  className,
  cellSize = 12,
  gameState: externalGameState,
  onGridSizeChange,
}: GameOfLifeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalGameState = useGameOfLife();
  const gameState = externalGameState ?? internalGameState;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const { grid, toggleCell, setCell, setGridSize } = gameState;

  // Track dragging state for click-and-drag cell activation
  const isDraggingRef = useRef(false);
  const lastCellRef = useRef<{ row: number; col: number } | null>(null);

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Vibrant color palette for cells
  const CELL_COLORS = [
    '#FF6B6B', // coral red
    '#FF8E53', // orange
    '#FFD93D', // yellow
    '#6BCB77', // green
    '#4D96FF', // blue
    '#9B59B6', // purple
    '#E91E63', // pink
    '#00BCD4', // cyan
  ];

  // Get color for a cell based on position (creates rainbow gradient effect)
  const getCellColor = useCallback(
    (row: number, col: number, totalCols: number) => {
      // Use diagonal position to create a gradient effect
      const position = (row + col) % CELL_COLORS.length;
      return CELL_COLORS[position];
    },
    []
  );

  // Get theme colors from CSS variables
  const getColors = useCallback(() => {
    if (typeof window === 'undefined') {
      return { dead: '#f9fafb', grid: '#e5e7eb' };
    }

    const isDark = document.documentElement.classList.contains('dark');

    return {
      dead: isDark
        ? 'hsl(222.2, 84%, 4.9%)' // dark mode background
        : 'hsl(0, 0%, 100%)', // light mode background
      grid: isDark
        ? 'hsl(217.2, 32.6%, 17.5%)' // dark mode border
        : 'hsl(214.3, 31.8%, 91.4%)', // light mode border
    };
  }, []);

  // Handle responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const newCols = Math.max(5, Math.floor(rect.width / cellSize));
      const newRows = Math.max(5, Math.floor(rect.height / cellSize));

      if (newCols > 0 && newRows > 0) {
        setGridSize(newCols, newRows);
        onGridSizeChange?.(newCols, newRows);
      }
    };

    // Initial size
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [cellSize, setGridSize, onGridSizeChange]);

  // Draw grid on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = getColors();
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;

    // Set canvas size
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;

    // Clear canvas with dead cell color
    ctx.fillStyle = colors.dead;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw alive cells with colorful gradient
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col]) {
          ctx.fillStyle = getCellColor(row, col, cols);
          // Draw cell with 1px padding for visual separation
          ctx.fillRect(
            col * cellSize + 1,
            row * cellSize + 1,
            cellSize - 2,
            cellSize - 2
          );
        }
      }
    }

    // Draw grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, rows * cellSize);
      ctx.stroke();
    }

    // Horizontal lines
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(cols * cellSize, i * cellSize);
      ctx.stroke();
    }
  }, [grid, cellSize, getColors]);

  // Helper to get cell coordinates from event
  const getCellFromEvent = useCallback(
    (
      event:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>
        | MouseEvent
        | TouchEvent
    ): { row: number; col: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ('touches' in event) {
        const touch = event.touches[0];
        if (!touch) return null;
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);

      return { row, col };
    },
    [cellSize]
  );

  // Handle mouse/touch down - start dragging and toggle first cell
  const handlePointerDown = useCallback(
    (
      event:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>
    ) => {
      event.preventDefault();
      isDraggingRef.current = true;

      const cell = getCellFromEvent(event);
      if (cell) {
        lastCellRef.current = cell;
        toggleCell(cell.row, cell.col);
      }
    },
    [getCellFromEvent, toggleCell]
  );

  // Handle mouse/touch move - activate cells while dragging
  const handlePointerMove = useCallback(
    (
      event:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>
    ) => {
      if (!isDraggingRef.current) return;
      event.preventDefault();

      const cell = getCellFromEvent(event);
      if (!cell) return;

      // Only activate if we moved to a different cell
      if (
        !lastCellRef.current ||
        cell.row !== lastCellRef.current.row ||
        cell.col !== lastCellRef.current.col
      ) {
        lastCellRef.current = cell;
        setCell(cell.row, cell.col, true); // Always activate on drag
      }
    },
    [getCellFromEvent, setCell]
  );

  // Handle mouse/touch up - stop dragging
  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    lastCellRef.current = null;
  }, []);

  // Add global event listeners for mouse/touch up to handle when pointer leaves canvas
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isDraggingRef.current = false;
      lastCellRef.current = null;
    };

    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('touchend', handleGlobalPointerUp);
    window.addEventListener('touchcancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('touchend', handleGlobalPointerUp);
      window.removeEventListener('touchcancel', handleGlobalPointerUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full min-h-[200px]', className)}
      role="application"
      aria-label="Conway's Game of Life simulation"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        className={cn(
          'block mx-auto cursor-pointer touch-none select-none',
          prefersReducedMotion && 'transition-none'
        )}
        aria-label="Game of Life grid - click or drag to toggle cells"
        tabIndex={0}
      />
    </div>
  );
}

export default GameOfLife;
