/**
 * "404" pattern coordinates for Conway's Game of Life
 *
 * Each digit is 5 cells wide, 7 cells tall
 * Pattern layout: [4][0][4] with 2-cell spacing between digits
 * Total width: 5 + 2 + 5 + 2 + 5 = 19 cells
 * Total height: 7 cells
 */

// Digit "4" (first) - x positions 0-4
const FOUR_1: [number, number][] = [
  // Vertical left stem
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 3],
  // Vertical right stem (full height)
  [3, 0],
  [3, 1],
  [3, 2],
  [3, 3],
  [3, 4],
  [3, 5],
  [3, 6],
  // Horizontal bar at row 3
  [1, 3],
  [2, 3],
  [4, 3],
];

// Digit "0" - x positions 7-11
const ZERO: [number, number][] = [
  // Top horizontal
  [8, 0],
  [9, 0],
  [10, 0],
  // Left vertical
  [7, 1],
  [7, 2],
  [7, 3],
  [7, 4],
  [7, 5],
  // Right vertical
  [11, 1],
  [11, 2],
  [11, 3],
  [11, 4],
  [11, 5],
  // Bottom horizontal
  [8, 6],
  [9, 6],
  [10, 6],
];

// Digit "4" (second) - x positions 14-18
const FOUR_2: [number, number][] = [
  // Vertical left stem
  [14, 0],
  [14, 1],
  [14, 2],
  [14, 3],
  // Vertical right stem (full height)
  [17, 0],
  [17, 1],
  [17, 2],
  [17, 3],
  [17, 4],
  [17, 5],
  [17, 6],
  // Horizontal bar at row 3
  [15, 3],
  [16, 3],
  [18, 3],
];

export const PATTERN_404: [number, number][] = [
  ...FOUR_1,
  ...ZERO,
  ...FOUR_2,
];

export const PATTERN_WIDTH = 19;
export const PATTERN_HEIGHT = 7;

/**
 * Creates a grid with the 404 pattern centered
 */
export function createGridWithPattern(
  cols: number,
  rows: number
): boolean[][] {
  const grid: boolean[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(false));

  // Center the pattern
  const offsetX = Math.floor((cols - PATTERN_WIDTH) / 2);
  const offsetY = Math.floor((rows - PATTERN_HEIGHT) / 2);

  PATTERN_404.forEach(([x, y]) => {
    const gridX = x + offsetX;
    const gridY = y + offsetY;
    if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
      grid[gridY][gridX] = true;
    }
  });

  return grid;
}
