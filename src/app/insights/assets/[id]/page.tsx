"use client";

import { useState, useEffect, use } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  HardDrive,
  Activity,
  Globe,
  Monitor,
  RefreshCw,
  ExternalLink,
  FileCode,
  FileImage,
  FileText,
  Type,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  AssetSummary,
  AssetType,
  formatBytes,
  formatDuration,
} from "@/lib/sentry-assets-types";

const ASSET_TYPE_ICONS: Record<AssetType, React.ReactNode> = {
  script: <FileCode className="h-5 w-5" />,
  css: <FileText className="h-5 w-5" />,
  image: <FileImage className="h-5 w-5" />,
  font: <Type className="h-5 w-5" />,
  other: <HardDrive className="h-5 w-5" />,
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AssetSummaryPage({ params }: PageProps) {
  const { id } = use(params);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        const response = await fetch(`/api/insights/assets/${encodeURIComponent(id)}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Asset not found');
          } else {
            setError('Failed to load asset data');
          }
          return;
        }

        const data = await response.json();
        setSummary(data.summary);
      } catch (err) {
        console.error('Failed to fetch asset summary:', err);
        setError('Failed to load asset data');
      } finally {
        setLoading(false);
      }
    }

    if (mounted && id) {
      fetchSummary();
    }
  }, [mounted, id]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-48 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/insights/assets" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assets
          </Link>
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">{error}</h2>
              <p className="text-muted-foreground">
                The requested asset could not be found or loaded.
              </p>
              <Button asChild className="mt-4">
                <Link href="/insights/assets">View All Assets</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading || !summary) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-muted rounded" />
              ))}
            </div>
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  const { asset, samples, durationTrend, sizeTrend, requestTrend } = summary;

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link href="/insights/assets" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assets
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-muted rounded-lg">
              {ASSET_TYPE_ICONS[asset.assetType]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-mono truncate">
                  {asset.resourceName}
                </h1>
                {asset.renderBlocking && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Render Blocking
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {asset.url}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="capitalize">{asset.assetType}</Badge>
                <span>First seen: {new Date(asset.firstSeen).toLocaleDateString()}</span>
                <span>Last seen: {new Date(asset.lastSeen).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Avg Duration</span>
              </div>
              <div className="text-2xl font-bold">{formatDuration(asset.duration)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                P50: {formatDuration(asset.p50Duration)} | P95: {formatDuration(asset.p95Duration)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <HardDrive className="h-4 w-4" />
                <span className="text-sm">Transfer Size</span>
              </div>
              <div className="text-2xl font-bold">{formatBytes(asset.transferSize)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Decoded: {formatBytes(asset.decodedSize)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm">Total Requests</span>
              </div>
              <div className="text-2xl font-bold">{asset.requestCount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Time Spent: {formatDuration(asset.timeSpent)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Globe className="h-4 w-4" />
                <span className="text-sm">Pages</span>
              </div>
              <div className="text-2xl font-bold">{asset.pageContexts.length}</div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {asset.pageContexts.slice(0, 2).join(', ')}
                {asset.pageContexts.length > 2 && ` +${asset.pageContexts.length - 2} more`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="samples">Sample Events</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
          </TabsList>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Duration Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Duration Trend</CardTitle>
                  <CardDescription>Average load time over the past 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={durationTrend}>
                        <defs>
                          <linearGradient id="durationGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })}
                          fontSize={12}
                        />
                        <YAxis tickFormatter={(v) => `${v}ms`} fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            borderColor: 'hsl(var(--border))',
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Duration']}
                          labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          fill="url(#durationGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Request Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Request Trend</CardTitle>
                  <CardDescription>Requests per day over the past 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={requestTrend}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })}
                          fontSize={12}
                        />
                        <YAxis fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            borderColor: 'hsl(var(--border))',
                          }}
                          formatter={(value: number) => [value.toFixed(0), 'Requests']}
                          labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Samples Tab */}
          <TabsContent value="samples">
            <Card>
              <CardHeader>
                <CardTitle>Sample Events</CardTitle>
                <CardDescription>
                  Recent instances of this asset loading, showing performance in context
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Size</TableHead>
                      <TableHead className="hidden md:table-cell">Browser</TableHead>
                      <TableHead className="hidden lg:table-cell">OS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {samples.map((sample) => (
                      <TableRow key={sample.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(sample.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-1 py-0.5 rounded">
                            {sample.page}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatDuration(sample.duration)}
                        </TableCell>
                        <TableCell className="text-right font-mono hidden sm:table-cell">
                          {formatBytes(sample.transferSize)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            {sample.browser}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {sample.os}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pages Tab */}
          <TabsContent value="pages">
            <Card>
              <CardHeader>
                <CardTitle>Pages Loading This Asset</CardTitle>
                <CardDescription>
                  All pages where this asset has been observed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {asset.pageContexts.map((page) => (
                    <Card key={page} className="bg-muted/50">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono">{page}</code>
                          <Link
                            href={page}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
