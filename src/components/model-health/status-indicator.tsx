/**
 * Status Indicator Component
 * Displays a status icon based on the model's last status
 */

import { ModelStatus } from "@/types/model-health";
import { getStatusIcon } from "@/lib/model-health-utils";

interface StatusIndicatorProps {
  status: ModelStatus;
  className?: string;
}

export function StatusIndicator({ status, className = "" }: StatusIndicatorProps) {
  return (
    <span className={`text-lg ${className}`} title={status}>
      {getStatusIcon(status)}
    </span>
  );
}
