"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RefreshCw, Monitor, Smartphone, Tablet, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebVitalsSummary } from "@/hooks/use-web-vitals";
import {
  PerformanceScoreGauge,
  VitalsSummaryGrid,
  VitalsTimelineChart,
  PagePerformanceTable,
  DistributionChart,
} from "@/components/web-vitals";
import type { DeviceType } from "@/lib/web-vitals-types";

export default function WebVitalsPage() {
  const [timeRange, setTimeRange] = useState<string>("24");
  const [deviceFilter, setDeviceFilter] = useState<DeviceType | "all">("all");
  const [activeTab, setActiveTab] = useState<string>("overview");

  const hours = parseInt(timeRange, 10);

  const { data, loading, refetch } = useWebVitalsSummary({
    hours,
    device: deviceFilter,
    pollingInterval: 60000, // Refresh every minute
  });

  // Demo data for initial render
  const summaryData = useMemo(() => {
    if (data) return data;

    // Return demo data when API hasn't responded yet
    return {
      performanceScore: {
        overall: 78,
        metrics: [
          { name: "LCP" as const, score: 75, weight: 0.25, value: 2100, rating: "good" as const },
          { name: "INP" as const, score: 80, weight: 0.30, value: 180, rating: "good" as const },
          { name: "CLS" as const, score: 85, weight: 0.15, value: 0.08, rating: "good" as const },
          { name: "FCP" as const, score: 70, weight: 0.10, value: 1500, rating: "good" as const },
          { name: "TTFB" as const, score: 65, weight: 0.20, value: 600, rating: "good" as const },
        ],
        device: deviceFilter === "all" ? "desktop" as const : deviceFilter,
        sampleCount: 3470,
      },
      pageCount: 12,
      totalPageLoads: 3470,
      vitals: {
        lcp: {
          name: "LCP" as const,
          p75: 2100,
          rating: "good" as const,
          count: 3200,
          trend: "improving" as const,
          trendPercentage: -5.2,
          history: [],
        },
        inp: {
          name: "INP" as const,
          p75: 180,
          rating: "good" as const,
          count: 2800,
          trend: "stable" as const,
          trendPercentage: 0.8,
          history: [],
        },
        cls: {
          name: "CLS" as const,
          p75: 0.08,
          rating: "good" as const,
          count: 3200,
          trend: "improving" as const,
          trendPercentage: -12.5,
          history: [],
        },
        fcp: {
          name: "FCP" as const,
          p75: 1500,
          rating: "good" as const,
          count: 3200,
          trend: "declining" as const,
          trendPercentage: 3.1,
          history: [],
        },
        ttfb: {
          name: "TTFB" as const,
          p75: 600,
          rating: "good" as const,
          count: 3200,
          trend: "stable" as const,
          trendPercentage: -0.5,
          history: [],
        },
      },
      distribution: {
        good: 72,
        needsImprovement: 20,
        poor: 8,
      },
      timeRange: {
        start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    };
  }, [data, hours, deviceFilter]);

  const deviceIcon = useMemo(() => {
    switch (deviceFilter) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      case "desktop":
        return <Monitor className="h-4 w-4" />;
      default:
        return null;
    }
  }, [deviceFilter]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Web Vitals</h1>
            <Badge variant="secondary">Insights</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Monitor your application&apos;s Core Web Vitals performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Device Filter */}
          <Select
            value={deviceFilter}
            onValueChange={(v) => setDeviceFilter(v as DeviceType | "all")}
          >
            <SelectTrigger className="w-[130px]">
              {deviceIcon}
              <SelectValue placeholder="All devices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              <SelectItem value="desktop">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Desktop
                </div>
              </SelectItem>
              <SelectItem value="mobile">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Mobile
                </div>
              </SelectItem>
              <SelectItem value="tablet">
                <div className="flex items-center gap-2">
                  <Tablet className="h-4 w-4" />
                  Tablet
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Time Range */}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last hour</SelectItem>
              <SelectItem value="6">Last 6 hours</SelectItem>
              <SelectItem value="12">Last 12 hours</SelectItem>
              <SelectItem value="24">Last 24 hours</SelectItem>
              <SelectItem value="168">Last 7 days</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Top Section: Score + Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Performance Score Gauge */}
            <div className="lg:col-span-1">
              <PerformanceScoreGauge
                score={summaryData.performanceScore.overall}
                breakdown={summaryData.performanceScore}
                loading={loading && !data}
              />
            </div>

            {/* Distribution Chart */}
            <div className="lg:col-span-1">
              <DistributionChart
                distribution={summaryData.distribution}
                loading={loading && !data}
              />
            </div>

            {/* Summary Stats */}
            <div className="lg:col-span-2 flex flex-col justify-center space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Page Loads</p>
                  <p className="text-2xl font-bold">
                    {summaryData.totalPageLoads.toLocaleString()}
                  </p>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Pages Tracked</p>
                  <p className="text-2xl font-bold">{summaryData.pageCount}</p>
                </div>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">What are Web Vitals?</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Core Web Vitals are a set of metrics that measure real-world user
                      experience for loading performance, interactivity, and visual stability.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vitals Summary Grid */}
          <VitalsSummaryGrid vitals={summaryData.vitals} loading={loading && !data} />

          {/* Timeline Chart */}
          <VitalsTimelineChart vitals={summaryData.vitals} loading={loading && !data} />
        </TabsContent>

        {/* Pages Tab */}
        <TabsContent value="pages" className="space-y-6">
          <div className="bg-card border rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Page Performance Breakdown</p>
                <p className="text-xs text-muted-foreground mt-1">
                  The &quot;Opportunity&quot; column shows the maximum possible increase to your
                  application&apos;s overall Performance Score if you were to raise that page&apos;s
                  score to 100, weighted by traffic volume.
                </p>
              </div>
            </div>
          </div>
          <PagePerformanceTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
