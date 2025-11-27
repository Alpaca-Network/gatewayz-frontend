/**
 * RealtimeMetricsCard Component
 *
 * Displays real-time metrics for a model, provider, or gateway
 * with auto-refresh and visual indicators
 */

'use client';

import { useRealtimeMetrics } from '@/hooks/use-realtime-metrics';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface RealtimeMetricsCardProps {
  type: 'model' | 'provider' | 'gateway';
  id: string;
  title?: string;
  description?: string;
  pollingInterval?: number;
  className?: string;
}

export function RealtimeMetricsCard({
  type,
  id,
  title,
  description,
  pollingInterval = 5000,
  className,
}: RealtimeMetricsCardProps) {
  const { data, loading, error } = useRealtimeMetrics({
    type,
    id,
    pollingInterval,
  });

  if (loading && !data) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>No Data Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No metrics found for this {type}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const healthColor =
    data.success_rate >= 95
      ? 'text-green-600 dark:text-green-400'
      : data.success_rate >= 80
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

  const healthBadgeVariant =
    data.success_rate >= 95
      ? 'default'
      : data.success_rate >= 80
        ? 'secondary'
        : 'destructive';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {title || id}
            </CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
          <Badge variant={healthBadgeVariant}>
            {data.success_rate.toFixed(1)}% Healthy
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Requests */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Requests</p>
            <p className="text-2xl font-bold">{data.requests.toLocaleString()}</p>
          </div>

          {/* Success Rate */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className={`text-2xl font-bold ${healthColor}`}>
              {data.success_rate.toFixed(1)}%
            </p>
          </div>

          {/* Average TTFT */}
          {data.avg_ttft_ms !== null && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg TTFT</p>
              <p className="text-2xl font-bold">
                {data.avg_ttft_ms.toFixed(0)}ms
              </p>
            </div>
          )}

          {/* Average Total Time */}
          {data.avg_total_time_ms !== null && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg Response</p>
              <p className="text-2xl font-bold">
                {data.avg_total_time_ms.toFixed(0)}ms
              </p>
            </div>
          )}
        </div>

        {/* Success/Error Breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Request Breakdown</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600 dark:text-green-400">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  Success
                </span>
                <span className="font-medium">{data.success_count}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 dark:bg-green-400"
                  style={{
                    width: `${data.success_rate}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {data.error_count > 0 && (
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-600 dark:text-red-400">
                  <TrendingDown className="inline h-3 w-3 mr-1" />
                  Errors
                </span>
                <span className="font-medium">{data.error_count}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 dark:bg-red-400"
                  style={{
                    width: `${100 - data.success_rate}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Breakdown */}
        {data.error_count > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Error Distribution</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {data.error_breakdown.timeout > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timeout:</span>
                  <span className="font-medium">
                    {data.error_breakdown.timeout}
                  </span>
                </div>
              )}
              {data.error_breakdown.rate_limit > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate Limit:</span>
                  <span className="font-medium">
                    {data.error_breakdown.rate_limit}
                  </span>
                </div>
              )}
              {data.error_breakdown.network > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network:</span>
                  <span className="font-medium">
                    {data.error_breakdown.network}
                  </span>
                </div>
              )}
              {data.error_breakdown.other > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other:</span>
                  <span className="font-medium">
                    {data.error_breakdown.other}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Time Bucket Info */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Data for hour: {data.time_bucket}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
