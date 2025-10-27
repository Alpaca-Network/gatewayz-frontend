"use client";

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit, Lightbulb, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReasoningStep {
  id: string;
  title: string;
  content: string;
  status: 'in_progress' | 'completed';
}

interface ReasoningDisplayProps {
  reasoning: string;
  className?: string;
  isStreaming?: boolean;
  steps?: ReasoningStep[];
  source?: 'gatewayz' | 'ai-sdk'; // Which system generated this reasoning
}

export function ReasoningDisplay({
  reasoning,
  className,
  isStreaming = false,
  steps,
  source = 'gatewayz',
}: ReasoningDisplayProps) {
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
        source,
        hasSteps: !!steps && steps.length > 0,
        preview: reasoning.substring(0, 100),
      });
    }
  }, [reasoning, isStreaming, isExpanded, source, steps]);

  if (!reasoning || reasoning.trim().length === 0) return null;

  // Check if we have structured steps (from AI SDK)
  const hasStructuredSteps = steps && steps.length > 0;

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
        {source === 'ai-sdk' && (
          <span className="ml-auto text-xs px-2 py-1 rounded bg-amber-200/50 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200">
            AI SDK
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-amber-200/50 dark:border-amber-500/30 px-4 py-3">
          {hasStructuredSteps ? (
            // Structured reasoning steps (AI SDK format)
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-lg bg-amber-100/50 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-700/50 p-3 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 pt-0.5">
                      {step.status === 'completed' ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-300 animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-amber-900 dark:text-amber-100 mb-1">
                        {step.title}
                      </h4>
                      <p className="text-sm text-amber-800/80 dark:text-amber-200/80 whitespace-pre-wrap">
                        {step.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Plain text reasoning (Gatewayz format)
            <div className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
              {reasoning.trim()}
              {isStreaming && (
                <span className="inline-block ml-1 w-2 h-4 bg-amber-600 dark:bg-amber-400 animate-pulse" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
