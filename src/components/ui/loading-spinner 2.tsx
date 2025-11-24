import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

/**
 * Reusable loading spinner component
 * Shows animated spinner with optional message
 *
 * @example
 * <LoadingSpinner message="Loading data..." />
 * <LoadingSpinner size="sm" />
 */
export function LoadingSpinner({ message, size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div className={cn("text-center py-12 border border-border rounded-lg bg-card", className)}>
      <div className="flex flex-col items-center gap-3">
        <div className={cn(
          "animate-spin rounded-full border-b-2 border-primary",
          sizeClasses[size]
        )}></div>
        {message && <p className="text-muted-foreground text-sm">{message}</p>}
      </div>
    </div>
  );
}
