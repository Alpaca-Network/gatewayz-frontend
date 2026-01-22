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

  const { grid, toggleCell, setGridSize } = gameState;

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

  // Get theme colors from CSS variables
  const getColors = useCallback(() => {
    if (typeof window === 'undefined') {
      return { alive: '#1f2937', dead: '#f9fafb', grid: '#e5e7eb' };
    }

    const isDark = document.documentElement.classList.contains('dark');

    return {
      // Use theme colors - foreground for alive cells, background for dead
      alive: isDark
        ? 'hsl(210, 40%, 98%)' // dark mode foreground
        : 'hsl(222.2, 47.4%, 11.2%)', // light mode foreground
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

    // Draw alive cells
    ctx.fillStyle = colors.alive;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col]) {
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

  // Handle click/touch to toggle cells
  const handleInteraction = useCallback(
    (
      event:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ('touches' in event) {
        const touch = event.touches[0];
        if (!touch) return;
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

      toggleCell(row, col);
    },
    [cellSize, toggleCell]
  );

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full min-h-[200px]', className)}
      role="application"
      aria-label="Conway's Game of Life simulation"
    >
      <canvas
        ref={canvasRef}
        onClick={handleInteraction}
        onTouchStart={handleInteraction}
        className={cn(
          'block mx-auto cursor-pointer touch-none',
          prefersReducedMotion && 'transition-none'
        )}
        aria-label="Game of Life grid - click or tap to toggle cells"
        tabIndex={0}
      />
    </div>
  );
}

export default GameOfLife;
