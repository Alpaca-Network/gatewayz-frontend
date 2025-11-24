/**
 * Model Health Card Component
 * Displays comprehensive health information for a single model
 */

import { ModelHealth } from "@/types/model-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusIndicator } from "./status-indicator";
import { HealthBadge } from "./health-badge";
import { ResponseTimeBadge } from "./response-time-badge";
import { calculateSuccessRate, formatTimeAgo } from "@/lib/model-health-utils";

interface ModelHealthCardProps {
  health: ModelHealth;
  className?: string;
}

export function ModelHealthCard({ health, className = "" }: ModelHealthCardProps) {
  const successRate = calculateSuccessRate(health);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIndicator status={health.last_status} />
            <span className="text-lg font-semibold">
              {health.provider}/{health.model}
            </span>
          </div>
          <HealthBadge successRate={successRate} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Response Time</p>
            <ResponseTimeBadge ms={health.average_response_time_ms} className="text-base" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className="text-base font-semibold">{successRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Calls</p>
            <p className="text-base font-semibold">{health.call_count.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Last Called</p>
            <p className="text-base">{formatTimeAgo(health.last_called_at)}</p>
          </div>
        </div>
        {health.last_error_message && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">Last Error:</p>
            <p className="mt-1 text-xs">{health.last_error_message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
