/**
 * Response Time Badge Component
 * Displays response time with color-coded classification
 */

import { getResponseTimeColor, formatResponseTime } from "@/lib/model-health-utils";

interface ResponseTimeBadgeProps {
  ms: number;
  className?: string;
}

export function ResponseTimeBadge({ ms, className = "" }: ResponseTimeBadgeProps) {
  const colorClass = getResponseTimeColor(ms);
  const formattedTime = formatResponseTime(ms);

  return (
    <span className={`font-mono text-sm ${colorClass} ${className}`}>
      {formattedTime}
    </span>
  );
}
