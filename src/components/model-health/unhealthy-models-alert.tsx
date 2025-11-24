/**
 * Unhealthy Models Alert Component
 * Displays a warning banner for models experiencing issues
 * Automatically polls for updates every 5 minutes
 */

"use client";

import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUnhealthyModels, useModelHealthPolling } from "@/hooks/use-model-health";
import { AlertTriangle } from "lucide-react";

interface UnhealthyModelsAlertProps {
  errorThreshold?: number;
  pollInterval?: number; // in milliseconds, default 5 minutes
  className?: string;
}

export function UnhealthyModelsAlert({
  errorThreshold = 0.2,
  pollInterval = 300000, // 5 minutes
  className = "",
}: UnhealthyModelsAlertProps) {
  const { data, loading, refetch } = useUnhealthyModels(errorThreshold);

  // Set up polling
  useModelHealthPolling(refetch, pollInterval);

  if (loading && !data) {
    return null; // Don't show anything while initial load
  }

  if (!data || data.models.length === 0) {
    return null; // No unhealthy models, don't show alert
  }

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {data.models.length} model{data.models.length > 1 ? "s" : ""} experiencing issues
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1 text-sm">
          {data.models.slice(0, 5).map((model) => (
            <li key={`${model.provider}-${model.model}`}>
              <span className="font-semibold">
                {model.provider}/{model.model}
              </span>
              : {(model.error_rate * 100).toFixed(1)}% error rate
            </li>
          ))}
          {data.models.length > 5 && (
            <li className="text-muted-foreground">
              ...and {data.models.length - 5} more
            </li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
