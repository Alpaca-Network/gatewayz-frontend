/**
 * Health Badge Component
 * Displays a colored badge indicating model health status
 */

import { Badge } from "@/components/ui/badge";
import { getHealthStatus, getStatusBgColor } from "@/lib/model-health-utils";

interface HealthBadgeProps {
  successRate: number;
  className?: string;
}

export function HealthBadge({ successRate, className = "" }: HealthBadgeProps) {
  const status = getHealthStatus(successRate);
  const bgColorClass = getStatusBgColor(successRate);

  const labels = {
    healthy: "Healthy",
    degraded: "Degraded",
    unhealthy: "Unhealthy",
  };

  return (
    <Badge className={`${bgColorClass} ${className}`} variant="outline">
      {labels[status]}
    </Badge>
  );
}
