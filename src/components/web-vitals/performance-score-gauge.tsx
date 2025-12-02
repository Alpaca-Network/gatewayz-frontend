"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { PerformanceScoreBreakdown, MetricScore } from "@/lib/web-vitals-types";
import { formatMetricValue, getMetricDescription } from "@/lib/web-vitals-types";

interface PerformanceScoreGaugeProps {
  score: number;
  breakdown?: PerformanceScoreBreakdown;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PerformanceScoreGauge({
  score,
  breakdown,
  loading = false,
  size = "md",
}: PerformanceScoreGaugeProps) {
  const dimensions = useMemo(() => {
    switch (size) {
      case "sm":
        return { size: 120, strokeWidth: 8, fontSize: "text-2xl" };
      case "lg":
        return { size: 200, strokeWidth: 12, fontSize: "text-5xl" };
      case "md":
      default:
        return { size: 160, strokeWidth: 10, fontSize: "text-4xl" };
    }
  }, [size]);

  const { size: circleSize, strokeWidth, fontSize } = dimensions;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const scoreColor = useMemo(() => {
    if (score >= 90) return "hsl(142, 76%, 36%)"; // Green
    if (score >= 50) return "hsl(38, 92%, 50%)"; // Orange
    return "hsl(0, 84%, 60%)"; // Red
  }, [score]);

  const scoreLabel = useMemo(() => {
    if (score >= 90) return "Good";
    if (score >= 50) return "Needs Improvement";
    return "Poor";
  }, [score]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Performance Score
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-4">
          <div
            className="relative animate-pulse bg-muted rounded-full"
            style={{ width: circleSize, height: circleSize }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Performance Score
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  The Performance Score summarizes the perceived performance based on Core Web
                  Vitals. Scores of 90+ are considered good.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-4">
        {/* SVG Gauge */}
        <div className="relative" style={{ width: circleSize, height: circleSize }}>
          <svg
            width={circleSize}
            height={circleSize}
            viewBox={`0 0 ${circleSize} ${circleSize}`}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              stroke="hsl(var(--muted))"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              stroke={scoreColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          {/* Score text in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-bold ${fontSize}`} style={{ color: scoreColor }}>
              {score}
            </span>
            <span className="text-xs text-muted-foreground">{scoreLabel}</span>
          </div>
        </div>

        {/* Metric Breakdown */}
        {breakdown && breakdown.metrics.length > 0 && (
          <div className="mt-4 w-full space-y-2">
            <p className="text-xs text-muted-foreground text-center mb-2">
              Based on {breakdown.sampleCount.toLocaleString()} samples ({breakdown.device})
            </p>
            <div className="grid grid-cols-5 gap-1">
              {breakdown.metrics.map((metric) => (
                <MetricPill key={metric.name} metric={metric} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricPill({ metric }: { metric: MetricScore }) {
  const pillColor = useMemo(() => {
    switch (metric.rating) {
      case "good":
        return "bg-green-500/20 text-green-600 dark:text-green-400";
      case "needs-improvement":
        return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
      case "poor":
        return "bg-red-500/20 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  }, [metric.rating]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex flex-col items-center p-1.5 rounded-md cursor-help ${pillColor}`}
          >
            <span className="text-[10px] font-medium">{metric.name}</span>
            <span className="text-xs font-bold">
              {formatMetricValue(metric.name, metric.value)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium mb-1">{metric.name}</p>
          <p className="text-xs text-muted-foreground">
            {getMetricDescription(metric.name)}
          </p>
          <p className="text-xs mt-1">
            Weight: {Math.round(metric.weight * 100)}%
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
