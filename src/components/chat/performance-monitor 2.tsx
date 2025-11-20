"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  X,
  Download,
  BarChart3,
  Zap,
  Clock,
  TrendingUp,
  Gauge
} from 'lucide-react';
import { chatPerformanceTracker, type PerformanceMetrics } from '@/lib/chat-performance-tracker';

interface PerformanceMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh metrics every second when open
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setMetrics(chatPerformanceTracker.getAllMetrics());
      setRefreshKey(prev => prev + 1);
    }, 1000);

    // Initial load
    setMetrics(chatPerformanceTracker.getAllMetrics());

    return () => clearInterval(interval);
  }, [isOpen]);

  const avgMetrics = chatPerformanceTracker.getAverageMetrics();
  const byModel = chatPerformanceTracker.getMetricsByModel();

  const formatMs = (ms?: number) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  const exportMetrics = () => {
    const data = chatPerformanceTracker.exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-performance-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[600px] max-w-[90vw] shadow-2xl">
      <Card className="border-2 border-blue-500/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Performance Monitor
            <Badge variant="outline" className="ml-2">
              {metrics.length} messages
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={exportMetrics}
              title="Export metrics as JSON"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="bymodel">By Model</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">Avg TTFT</span>
                      </div>
                      <span className="text-2xl font-bold text-yellow-500">
                        {formatMs(avgMetrics.avgTTFT)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Time to First Token
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Avg Total</span>
                      </div>
                      <span className="text-2xl font-bold text-blue-500">
                        {formatMs(avgMetrics.avgTotalTime)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total Response Time
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Throughput</span>
                      </div>
                      <span className="text-2xl font-bold text-green-500">
                        {avgMetrics.avgTokensPerSecond.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tokens per Second
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">Error Rate</span>
                      </div>
                      <span className="text-2xl font-bold text-red-500">
                        {(avgMetrics.errorRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Failed Requests
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Recent Messages Tab */}
            <TabsContent value="recent">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {metrics.slice().reverse().slice(0, 10).map((metric) => (
                    <Card key={metric.messageId} className={metric.hadError ? 'border-red-500' : ''}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm truncate">{metric.model}</div>
                            {metric.gateway && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {metric.gateway}
                              </Badge>
                            )}
                          </div>
                          {metric.hadError && (
                            <Badge variant="destructive" className="text-xs">
                              Error: {metric.errorType}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">TTFT:</span>{' '}
                            <span className="font-semibold">{formatMs(metric.timeToFirstToken)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>{' '}
                            <span className="font-semibold">{formatMs(metric.totalResponseTime)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Network:</span>{' '}
                            <span className="font-semibold">{formatMs(metric.networkLatency)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Backend:</span>{' '}
                            <span className="font-semibold">{formatMs(metric.backendProcessingTime)}</span>
                          </div>
                          {metric.tokensPerSecond && (
                            <>
                              <div>
                                <span className="text-muted-foreground">TPS:</span>{' '}
                                <span className="font-semibold">{metric.tokensPerSecond.toFixed(1)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Length:</span>{' '}
                                <span className="font-semibold">{metric.responseLength} chars</span>
                              </div>
                            </>
                          )}
                        </div>

                        {metric.retryCount > 0 && (
                          <div className="mt-2 text-xs text-orange-500">
                            Retries: {metric.retryCount}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {metrics.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No messages tracked yet</p>
                      <p className="text-xs mt-1">Send a message to start tracking</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* By Model Tab */}
            <TabsContent value="bymodel">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {Object.entries(byModel)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([model, stats]) => (
                      <Card key={model}>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="font-medium text-sm truncate">{model}</div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {stats.count} msgs
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Avg TTFT</div>
                              <div className="text-lg font-bold text-yellow-500">
                                {formatMs(stats.avgTTFT)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Avg Total</div>
                              <div className="text-lg font-bold text-blue-500">
                                {formatMs(stats.avgTotalTime)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                  {Object.keys(byModel).length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No model statistics yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground space-y-1">
              <div><strong>TTFT:</strong> Time to First Token - How long before the model starts responding</div>
              <div><strong>Total:</strong> Complete response time from send to finish</div>
              <div><strong>TPS:</strong> Tokens per second (higher is better)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Floating toggle button component
export const PerformanceMonitorToggle: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className="fixed bottom-4 right-4 z-40 shadow-lg bg-background hover:bg-accent"
      title="Toggle Performance Monitor"
    >
      <Activity className="h-4 w-4" />
    </Button>
  );
};
