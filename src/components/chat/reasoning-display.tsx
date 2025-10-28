"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "./chain-of-thought";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  BrainCircuit,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";

interface ReasoningStep {
  id: string;
  title: string;
  content: string;
  status: "in_progress" | "completed";
}

interface ReasoningDisplayProps {
  reasoning: string;
  className?: string;
  isStreaming?: boolean;
  steps?: ReasoningStep[];
  source?: "gatewayz" | "ai-sdk";
}

export function ReasoningDisplay({
  reasoning,
  className,
  isStreaming = false,
  steps,
  source = "gatewayz",
}: ReasoningDisplayProps) {
  const trimmedReasoning = reasoning?.trim() ?? "";
  const hasPlainReasoning = trimmedReasoning.length > 0;
  const hasStructuredSteps = Boolean(steps && steps.length > 0);
  const [isExpanded, setIsExpanded] = useState(() => isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (hasPlainReasoning) {
      console.log("[ReasoningDisplay] Rendering reasoning:", {
        length: trimmedReasoning.length,
        isStreaming,
        isExpanded,
        source,
        hasSteps: hasStructuredSteps,
        preview: trimmedReasoning.substring(0, 120),
      });
    }
  }, [
    trimmedReasoning,
    hasPlainReasoning,
    isStreaming,
    isExpanded,
    source,
    hasStructuredSteps,
  ]);

  if (!hasPlainReasoning && !hasStructuredSteps) {
    return null;
  }

  const headerLabel = isStreaming ? "Thinking…" : "Chain of Thought";

  const sourceBadge =
    source === "ai-sdk"
      ? (
        <Badge
          variant="secondary"
          className="bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
        >
          AI SDK
        </Badge>
      )
      : source === "gatewayz"
        ? (
          <Badge
            variant="secondary"
            className="bg-amber-200/60 text-amber-900/90 dark:bg-amber-900/60 dark:text-amber-100/90"
          >
            Gateway
          </Badge>
        )
        : null;

  const headerBadge =
    isStreaming || sourceBadge ? (
      <span className="flex items-center gap-2">
        {isStreaming && (
          <Loader2 className="size-3 animate-spin text-amber-500 dark:text-amber-200" />
        )}
        {sourceBadge}
      </span>
    ) : undefined;

  const structuredSteps = useMemo(() => {
    if (!hasStructuredSteps || !steps) return null;

    return steps.map((step, index) => (
      <ChainOfThoughtStep
        key={step.id ?? `step-${index}`}
        icon={step.status === "completed" ? Check : Sparkles}
        status={step.status === "completed" ? "complete" : "active"}
        label={step.title || `Step ${index + 1}`}
      >
        {step.content && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-amber-900 dark:text-amber-50">
            {step.content}
          </p>
        )}
      </ChainOfThoughtStep>
    ));
  }, [hasStructuredSteps, steps]);

  return (
    <div
      className={cn(
        "mb-3 overflow-hidden rounded-xl border border-amber-200/60 bg-amber-50/70 text-amber-950 shadow-sm backdrop-blur-md dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100",
        className
      )}
    >
      <ChainOfThought
        open={isExpanded}
        defaultOpen={isStreaming}
        onOpenChange={setIsExpanded}
        className="space-y-0"
      >
        <ChainOfThoughtHeader
          className="bg-amber-100/60 text-amber-900 dark:bg-amber-900/30 dark:text-amber-50"
          badge={headerBadge}
        >
          {headerLabel}
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent className="bg-transparent">
          {hasStructuredSteps ? (
            structuredSteps
          ) : (
            <ChainOfThoughtStep
              icon={BrainCircuit}
              status={isStreaming ? "active" : "complete"}
              label={isStreaming ? "Reasoning in progress" : "Reasoning trace"}
            >
              <p className="whitespace-pre-wrap text-sm leading-6 text-amber-900 dark:text-amber-50">
                {trimmedReasoning}
                {isStreaming && (
                  <span className="ml-1 inline-flex h-3 w-2 animate-pulse rounded-sm bg-amber-500/70 dark:bg-amber-200/80" />
                )}
              </p>
            </ChainOfThoughtStep>
          )}
        </ChainOfThoughtContent>
      </ChainOfThought>
    </div>
  );
}
