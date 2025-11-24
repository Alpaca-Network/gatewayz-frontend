/**
 * Model Health Dashboard Page
 * Comprehensive dashboard for monitoring model health metrics
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnhealthyModelsAlert } from "@/components/model-health/unhealthy-models-alert";
import { StatusIndicator } from "@/components/model-health/status-indicator";
import { HealthBadge } from "@/components/model-health/health-badge";
import { ResponseTimeBadge } from "@/components/model-health/response-time-badge";
import {
  useModelHealthStats,
  useModelHealthList,
  useModelHealthPolling,
} from "@/hooks/use-model-health";
import { calculateSuccessRate, formatTimeAgo } from "@/lib/model-health-utils";
import { Activity, TrendingUp, Zap, CheckCircle2, RefreshCw } from "lucide-react";

export default function ModelHealthDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { stats, loading: statsLoading, refetch: refetchStats } = useModelHealthStats();
  const {
    data,
    loading: listLoading,
    refetch: refetchList,
  } = useModelHealthList(pageSize, page * pageSize);

  // Set up polling for both stats and list
  useModelHealthPolling(() => {
    refetchStats();
    refetchList();
  }, 60000); // Poll every 60 seconds

  const handleRefresh = () => {
    refetchStats();
    refetchList();
  };

  const filteredModels = data?.models.filter(
    (model) =>
      model.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Model Health Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor performance and health metrics for all models
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Unhealthy Models Alert */}
      <UnhealthyModelsAlert />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Models */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total_models || 0}</div>
            )}
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats ? (stats.success_rate * 100).toFixed(1) : 0}%
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average Response Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats ? Math.round(stats.average_response_time) : 0}ms
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Calls */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.total_calls.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Models Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Model Health Status</CardTitle>
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {listLoading && !data ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead className="text-right">Success Rate</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead>Last Called</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredModels && filteredModels.length > 0 ? (
                      filteredModels.map((model) => {
                        const successRate = calculateSuccessRate(model);
                        return (
                          <TableRow key={`${model.provider}-${model.model}`}>
                            <TableCell>
                              <StatusIndicator status={model.last_status} />
                            </TableCell>
                            <TableCell className="font-medium">{model.provider}</TableCell>
                            <TableCell>{model.model}</TableCell>
                            <TableCell>
                              <HealthBadge successRate={successRate} />
                            </TableCell>
                            <TableCell>
                              <ResponseTimeBadge ms={model.average_response_time_ms} />
                            </TableCell>
                            <TableCell className="text-right">
                              {successRate.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {model.call_count.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatTimeAgo(model.last_called_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          {searchQuery
                            ? "No models match your search"
                            : "No health data available yet"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data && data.total > pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * pageSize + 1} to{" "}
                    {Math.min((page + 1) * pageSize, data.total)} of {data.total} models
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={(page + 1) * pageSize >= data.total}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
