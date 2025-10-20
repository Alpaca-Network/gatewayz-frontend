"use client";

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReasoningDisplayProps {
  reasoning: string;
  className?: string;
  isStreaming?: boolean;
}

export function ReasoningDisplay({ reasoning, className, isStreaming = false }: ReasoningDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(() => isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    }
  }, [isStreaming]);

  // Always show for debugging - log when reasoning is present
  useEffect(() => {
    if (reasoning && reasoning.trim().length > 0) {
      console.log('[ReasoningDisplay] Rendering reasoning:', {
        length: reasoning.length,
        isStreaming,
        isExpanded,
        preview: reasoning.substring(0, 100)
      });
    }
  }, [reasoning, isStreaming, isExpanded]);

  if (!reasoning || reasoning.trim().length === 0) return null;

  return (
    <div
      className={cn(
        "mb-3 rounded-lg border border-amber-200/50 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/40 backdrop-blur-sm transition-all",
        className
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors rounded-lg"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <BrainCircuit className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-300" />
        <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
          {isStreaming
            ? isExpanded
              ? 'Thinking... (click to hide)'
              : 'Thinking...'
            : isExpanded
              ? 'Hide reasoning'
              : 'Show reasoning'}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-amber-200/50 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap relative">
          {reasoning.trim()}
          {isStreaming && (
            <span className="inline-block ml-1 w-2 h-4 bg-amber-600 dark:bg-amber-400 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}
