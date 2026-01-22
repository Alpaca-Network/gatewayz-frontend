import {
  GameOfLife,
  useGameOfLife,
  PATTERN_404,
  PATTERN_WIDTH,
  PATTERN_HEIGHT,
  createGridWithPattern,
} from '../index';

describe('game-of-life exports', () => {
  it('exports GameOfLife component', () => {
    expect(GameOfLife).toBeDefined();
    expect(typeof GameOfLife).toBe('function');
  });

  it('exports useGameOfLife hook', () => {
    expect(useGameOfLife).toBeDefined();
    expect(typeof useGameOfLife).toBe('function');
  });

  it('exports PATTERN_404 coordinates', () => {
    expect(PATTERN_404).toBeDefined();
    expect(Array.isArray(PATTERN_404)).toBe(true);
    expect(PATTERN_404.length).toBeGreaterThan(0);
    // Each coordinate should be a tuple [x, y]
    PATTERN_404.forEach(([x, y]) => {
      expect(typeof x).toBe('number');
      expect(typeof y).toBe('number');
    });
  });

  it('exports PATTERN_WIDTH constant', () => {
    expect(PATTERN_WIDTH).toBe(19);
  });

  it('exports PATTERN_HEIGHT constant', () => {
    expect(PATTERN_HEIGHT).toBe(7);
  });

  it('exports createGridWithPattern function', () => {
    expect(createGridWithPattern).toBeDefined();
    expect(typeof createGridWithPattern).toBe('function');
  });

  it('createGridWithPattern creates correct size grid', () => {
    const grid = createGridWithPattern(30, 20);
    expect(grid.length).toBe(20);
    expect(grid[0].length).toBe(30);
  });

  it('createGridWithPattern centers the pattern', () => {
    const grid = createGridWithPattern(40, 20);
    // Pattern should have some alive cells
    const aliveCount = grid.flat().filter(Boolean).length;
    expect(aliveCount).toBe(PATTERN_404.length);
  });
});
