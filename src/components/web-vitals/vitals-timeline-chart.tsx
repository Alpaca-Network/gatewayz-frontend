"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import type { AggregatedVital, WebVitalName } from "@/lib/web-vitals-types";
import {
  formatMetricValue,
  WEB_VITAL_THRESHOLDS,
} from "@/lib/web-vitals-types";

interface VitalsTimelineChartProps {
  vitals: {
    lcp: AggregatedVital;
    inp: AggregatedVital;
    cls: AggregatedVital;
    fcp: AggregatedVital;
    ttfb: AggregatedVital;
  };
  loading?: boolean;
}

export function VitalsTimelineChart({ vitals, loading = false }: VitalsTimelineChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<WebVitalName>("LCP");

  const chartData = useMemo(() => {
    const vital = vitals[selectedMetric.toLowerCase() as keyof typeof vitals];
    if (!vital?.history?.length) {
      // Generate demo data if no history
      const now = Date.now();
      return Array.from({ length: 24 }, (_, i) => {
        const timestamp = new Date(now - (23 - i) * 60 * 60 * 1000).toISOString();
        const baseValue = getBaseValue(selectedMetric);
        const variance = baseValue * 0.2;
        const value = baseValue + (Math.random() - 0.5) * variance;
        return {
          timestamp,
          value: Math.max(0, value),
          rating: getRatingFromValue(selectedMetric, value),
        };
      });
    }
    return vital.history;
  }, [vitals, selectedMetric]);

  const thresholds = useMemo(() => {
    return WEB_VITAL_THRESHOLDS.desktop[selectedMetric];
  }, [selectedMetric]);

  const yAxisDomain = useMemo(() => {
    const values = chartData.map((d) => d.value);
    const max = Math.max(...values, thresholds.needsImprovement * 1.2);
    return [0, max];
  }, [chartData, thresholds]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 bg-muted rounded animate-pulse" />
            <div className="h-9 w-32 bg-muted rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Web Vitals Over Time
          </CardTitle>
          <Select
            value={selectedMetric}
            onValueChange={(v) => setSelectedMetric(v as WebVitalName)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LCP">LCP - Load</SelectItem>
              <SelectItem value="INP">INP - Interactivity</SelectItem>
              <SelectItem value="CLS">CLS - Stability</SelectItem>
              <SelectItem value="FCP">FCP - First Paint</SelectItem>
              <SelectItem value="TTFB">TTFB - Server</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => format(new Date(value), "HH:mm")}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                domain={yAxisDomain}
                tickFormatter={(value) =>
                  selectedMetric === "CLS" ? value.toFixed(2) : `${value}ms`
                }
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelFormatter={(value) => format(new Date(value), "PPp")}
                formatter={(value: number) => [
                  formatMetricValue(selectedMetric, value),
                  selectedMetric,
                ]}
              />
              {/* Good threshold line */}
              <ReferenceLine
                y={thresholds.good}
                stroke="hsl(142, 76%, 36%)"
                strokeDasharray="5 5"
                label={{
                  value: "Good",
                  position: "right",
                  fill: "hsl(142, 76%, 36%)",
                  fontSize: 11,
                }}
              />
              {/* Needs Improvement threshold line */}
              <ReferenceLine
                y={thresholds.needsImprovement}
                stroke="hsl(38, 92%, 50%)"
                strokeDasharray="5 5"
                label={{
                  value: "Poor",
                  position: "right",
                  fill: "hsl(38, 92%, 50%)",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-500" />
            <span className="text-muted-foreground">
              Good ({formatThresholdValue(selectedMetric, thresholds.good)})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-orange-500" />
            <span className="text-muted-foreground">
              Poor ({formatThresholdValue(selectedMetric, thresholds.needsImprovement)})
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getBaseValue(metric: WebVitalName): number {
  switch (metric) {
    case "LCP":
      return 2000;
    case "INP":
      return 150;
    case "CLS":
      return 0.08;
    case "FCP":
      return 1200;
    case "TTFB":
      return 400;
    default:
      return 1000;
  }
}

function getRatingFromValue(
  metric: WebVitalName,
  value: number
): "good" | "needs-improvement" | "poor" {
  const thresholds = WEB_VITAL_THRESHOLDS.desktop[metric];
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.needsImprovement) return "needs-improvement";
  return "poor";
}

function formatThresholdValue(metric: WebVitalName, value: number): string {
  if (metric === "CLS") {
    return value.toString();
  }
  return `${value}ms`;
}
