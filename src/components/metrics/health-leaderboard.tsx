/**
 * HealthLeaderboard Component
 *
 * Displays top and bottom models ranked by health score
 * with auto-refresh and filtering options
 */

'use client';

import { useState } from 'react';
import { useHealthLeaderboard } from '@/hooks/use-health-leaderboard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface HealthLeaderboardProps {
  limit?: number;
  pollingInterval?: number;
  className?: string;
}

export function HealthLeaderboard({
  limit = 10,
  pollingInterval = 10000,
  className,
}: HealthLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'top' | 'bottom'>('top');

  const {
    data: topData,
    loading: topLoading,
    error: topError,
  } = useHealthLeaderboard({
    order: 'desc',
    limit,
    pollingInterval,
    enabled: activeTab === 'top',
  });

  const {
    data: bottomData,
    loading: bottomLoading,
    error: bottomError,
  } = useHealthLeaderboard({
    order: 'asc',
    limit,
    pollingInterval,
    enabled: activeTab === 'bottom',
  });

  const data = activeTab === 'top' ? topData : bottomData;
  const loading = activeTab === 'top' ? topLoading : bottomLoading;
  const error = activeTab === 'top' ? topError : bottomError;

  const getHealthColor = (score: number) => {
    if (score >= 95) return 'text-green-600 dark:text-green-400';
    if (score >= 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthBadgeVariant = (score: number) => {
    if (score >= 95) return 'default' as const;
    if (score >= 80) return 'secondary' as const;
    return 'destructive' as const;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Model Health Leaderboard
        </CardTitle>
        <CardDescription>
          Real-time health scores based on success rates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'top' | 'bottom')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="top" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top Models
            </TabsTrigger>
            <TabsTrigger value="bottom" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Bottom Models
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading && data.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-10 w-10 text-destructive mb-2" />
                <p className="text-sm text-muted-foreground">{error.message}</p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No models with health data yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.map((model, index) => (
                  <div
                    key={model.model_id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Rank & Model Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{model.model_id}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{model.requests.toLocaleString()} requests</span>
                          {model.avg_ttft_ms !== null && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {model.avg_ttft_ms.toFixed(0)}ms TTFT
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Health Score */}
                    <Badge variant={getHealthBadgeVariant(model.health_score)}>
                      <span className={getHealthColor(model.health_score)}>
                        {model.health_score.toFixed(1)}%
                      </span>
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
