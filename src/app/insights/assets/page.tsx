"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCode,
  FileImage,
  FileText,
  Filter,
  RefreshCw,
  Search,
  ArrowUpDown,
  AlertTriangle,
  Clock,
  HardDrive,
  Activity,
  Type,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  AssetData,
  AssetFilters,
  AssetListResponse,
  AssetType,
  formatBytes,
  formatDuration,
} from "@/lib/sentry-assets-types";
import { useAssetTracking, getStoredAssetData } from "@/hooks/use-asset-tracking";

const ASSET_TYPE_ICONS: Record<AssetType, React.ReactNode> = {
  script: <FileCode className="h-4 w-4" />,
  css: <FileText className="h-4 w-4" />,
  image: <FileImage className="h-4 w-4" />,
  font: <Type className="h-4 w-4" />,
  other: <HardDrive className="h-4 w-4" />,
};

const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  script: 'hsl(217, 91%, 60%)', // Blue
  css: 'hsl(142, 76%, 36%)', // Green
  image: 'hsl(280, 87%, 65%)', // Purple
  font: 'hsl(45, 93%, 47%)', // Yellow
  other: 'hsl(0, 0%, 63%)', // Gray
};

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      {trend && (
        <p className={cn(
          "text-xs mt-1",
          trend.value > 0 ? "text-red-500" : "text-green-500"
        )}>
          {trend.value > 0 ? "+" : ""}{trend.value}% {trend.label}
        </p>
      )}
    </CardContent>
  </Card>
);

export default function AssetsInsightsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AssetListResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<AssetFilters>({
    assetType: 'all',
    renderBlocking: 'all',
    sortBy: 'timeSpent',
    sortOrder: 'desc',
  });

  // Initialize asset tracking
  const { getAssets, isEnabled } = useAssetTracking({ enabled: true });

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);

      // Get client-side tracked assets
      const clientAssets = getStoredAssetData();

      const response = await fetch('/api/insights/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: clientAssets,
          filters: {
            ...filters,
            search: searchQuery,
          },
          page: currentPage,
          pageSize: 20,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, currentPage, getAssets]);

  useEffect(() => {
    if (mounted) {
      fetchAssets();
    }
  }, [mounted, fetchAssets]);

  // Prepare chart data
  const typeDistributionData = data?.metrics ? [
    { name: 'Scripts', value: data.metrics.byType.script.count, color: ASSET_TYPE_COLORS.script },
    { name: 'CSS', value: data.metrics.byType.css.count, color: ASSET_TYPE_COLORS.css },
    { name: 'Images', value: data.metrics.byType.image.count, color: ASSET_TYPE_COLORS.image },
    { name: 'Fonts', value: data.metrics.byType.font.count, color: ASSET_TYPE_COLORS.font },
    { name: 'Other', value: data.metrics.byType.other.count, color: ASSET_TYPE_COLORS.other },
  ].filter(d => d.value > 0) : [];

  const durationByTypeData = data?.metrics ? [
    { name: 'Scripts', duration: data.metrics.byType.script.avgDuration, color: ASSET_TYPE_COLORS.script },
    { name: 'CSS', duration: data.metrics.byType.css.avgDuration, color: ASSET_TYPE_COLORS.css },
    { name: 'Images', duration: data.metrics.byType.image.avgDuration, color: ASSET_TYPE_COLORS.image },
    { name: 'Fonts', duration: data.metrics.byType.font.avgDuration, color: ASSET_TYPE_COLORS.font },
    { name: 'Other', duration: data.metrics.byType.other.avgDuration, color: ASSET_TYPE_COLORS.other },
  ].filter(d => d.duration > 0) : [];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Assets</h1>
              <p className="text-muted-foreground mt-1">
                Monitor JavaScript, CSS, images, and font performance across your application
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchAssets}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Assets"
            value={data?.metrics?.totalAssets.toLocaleString() || '0'}
            subtitle={`${data?.metrics?.totalRequests.toLocaleString() || '0'} total requests`}
            icon={<HardDrive className="h-4 w-4 text-muted-foreground" />}
          />
          <MetricCard
            title="Avg Duration"
            value={formatDuration(data?.metrics?.avgDuration || 0)}
            subtitle="Time to load assets"
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          />
          <MetricCard
            title="Total Size"
            value={formatBytes(data?.metrics?.totalTransferSize || 0)}
            subtitle="Transfer size"
            icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          />
          <MetricCard
            title="Render Blocking"
            value={data?.metrics?.renderBlockingCount.toString() || '0'}
            subtitle="Assets blocking render"
            icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Asset Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asset Distribution</CardTitle>
              <CardDescription>Assets by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {typeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Duration by Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Average Duration by Type</CardTitle>
              <CardDescription>Load time in milliseconds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationByTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis type="number" tickFormatter={(v) => `${v}ms`} />
                    <YAxis type="category" dataKey="name" width={70} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Duration']}
                    />
                    <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                      {durationByTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Type: {filters.assetType === 'all' ? 'All' : filters.assetType}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Asset Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, assetType: 'all' }))}>
                  All Types
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, assetType: 'script' }))}>
                  <FileCode className="h-4 w-4 mr-2" /> Scripts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, assetType: 'css' }))}>
                  <FileText className="h-4 w-4 mr-2" /> CSS
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, assetType: 'image' }))}>
                  <FileImage className="h-4 w-4 mr-2" /> Images
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, assetType: 'font' }))}>
                  <Type className="h-4 w-4 mr-2" /> Fonts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort: {filters.sortBy}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, sortBy: 'timeSpent' }))}>
                  Time Spent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, sortBy: 'duration' }))}>
                  Duration
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, sortBy: 'requests' }))}>
                  Requests
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(f => ({ ...f, sortBy: 'size' }))}>
                  Size
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setFilters(f => ({
                ...f,
                sortOrder: f.sortOrder === 'desc' ? 'asc' : 'desc'
              }))}
            >
              {filters.sortOrder === 'desc' ? '↓' : '↑'}
            </Button>
          </div>
        </div>

        {/* Assets Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Size</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Requests</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Time Spent</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">Loading assets...</p>
                    </TableCell>
                  </TableRow>
                ) : !data?.assets || data.assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">No assets found.</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Asset data is collected as you browse the application.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.assets.map((asset) => (
                    <TableRow key={asset.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Link
                          href={`/insights/assets/${encodeURIComponent(asset.id)}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <span className="text-muted-foreground">
                            {ASSET_TYPE_ICONS[asset.assetType]}
                          </span>
                          <span className="font-mono text-sm truncate max-w-[300px]">
                            {asset.resourceName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="capitalize">
                          {asset.assetType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatDuration(asset.duration)}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden sm:table-cell">
                        {formatBytes(asset.transferSize)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        {asset.requestCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden lg:table-cell">
                        {formatDuration(asset.timeSpent)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {asset.renderBlocking && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Blocking
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && data.pagination.total > data.pagination.pageSize && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {Math.ceil(data.pagination.total / data.pagination.pageSize)}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={!data.pagination.hasMore || loading}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Info Banner */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">About Asset Monitoring</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This page shows performance metrics for JavaScript, CSS, images, and fonts loaded by your application.
                  Data is collected using the browser's Resource Timing API and grouped by resource path for easier analysis.
                  Render-blocking assets can significantly impact your page's initial load time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
