'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { GameOfLife } from '@/components/game-of-life/GameOfLife';
import { useGameOfLife } from '@/components/game-of-life/useGameOfLife';
import { Play, Pause, RotateCcw, Home, Zap } from 'lucide-react';

export default function NotFoundClient() {
  const gameState = useGameOfLife({
    initialSpeed: 150,
  });

  const { isPlaying, generation, speed, toggle, reset, setSpeed } = gameState;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header Section */}
      <div className="text-center pt-8 pb-4 px-4 z-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-2">
          404: Page Has Evolved
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
          This page has gone through too many generations and mutated beyond
          recognition. Watch the cells evolve, or help them find a stable state!
        </p>
      </div>

      {/* Game of Life Canvas */}
      <div className="flex-1 relative px-4 pb-4 min-h-[300px] sm:min-h-[400px]">
        <GameOfLife
          gameState={gameState}
          className="w-full h-full rounded-lg border border-border overflow-hidden"
          cellSize={12}
        />
      </div>

      {/* Controls */}
      <div className="bg-card border-t border-border p-4 z-10">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Generation counter */}
          <div className="text-center text-sm text-muted-foreground">
            Generation:{' '}
            <span className="font-mono font-medium text-foreground">
              {generation}
            </span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              onClick={toggle}
              variant="default"
              size="lg"
              className="min-w-[120px]"
              aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Play
                </>
              )}
            </Button>

            <Button
              onClick={reset}
              variant="outline"
              size="lg"
              aria-label="Reset simulation to initial 404 pattern"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
          </div>

          {/* Speed slider */}
          <div className="flex items-center gap-4 max-w-sm mx-auto">
            <Zap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[500 - speed]} // Invert so right = faster
              onValueChange={([value]) => setSpeed(500 - (value ?? 0))}
              min={0}
              max={450}
              step={50}
              className="flex-1"
              aria-label="Simulation speed"
            />
            <span className="text-xs text-muted-foreground w-12 text-right">
              {speed}ms
            </span>
          </div>

          {/* Instructions */}
          <p className="text-center text-xs text-muted-foreground">
            Click or tap on the grid to toggle cells. Adjust speed with the
            slider.
          </p>
        </div>
      </div>
    </div>
  );
}
