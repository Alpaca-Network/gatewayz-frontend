"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import type { AggregatedVital, WebVitalName } from "@/lib/web-vitals-types";
import {
  formatMetricValue,
  getMetricDescription,
  getMetricUnit,
} from "@/lib/web-vitals-types";

interface VitalSummaryCardProps {
  vital: AggregatedVital;
  loading?: boolean;
}

export function VitalSummaryCard({ vital, loading = false }: VitalSummaryCardProps) {
  const ratingColor = useMemo(() => {
    switch (vital.rating) {
      case "good":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "needs-improvement":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
      case "poor":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  }, [vital.rating]);

  const trendIcon = useMemo(() => {
    switch (vital.trend) {
      case "improving":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  }, [vital.trend]);

  const trendColor = useMemo(() => {
    switch (vital.trend) {
      case "improving":
        return "text-green-500";
      case "declining":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  }, [vital.trend]);

  const metricLabel = useMemo(() => {
    switch (vital.name) {
      case "LCP":
        return "Largest Contentful Paint";
      case "INP":
        return "Interaction to Next Paint";
      case "CLS":
        return "Cumulative Layout Shift";
      case "FCP":
        return "First Contentful Paint";
      case "TTFB":
        return "Time to First Byte";
      default:
        return vital.name;
    }
  }, [vital.name]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            {vital.name}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium mb-1">{metricLabel}</p>
                  <p className="text-xs">{getMetricDescription(vital.name)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
          <Badge variant="outline" className={ratingColor}>
            {vital.rating === "needs-improvement" ? "Meh" : vital.rating}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {formatMetricValue(vital.name, vital.p75)}
          </span>
          <span className="text-xs text-muted-foreground">p75</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {trendIcon}
          <span className={`text-sm ${trendColor}`}>
            {vital.trend === "stable"
              ? "Stable"
              : `${vital.trendPercentage > 0 ? "+" : ""}${vital.trendPercentage}%`}
          </span>
          <span className="text-xs text-muted-foreground">
            ({vital.count.toLocaleString()} samples)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

interface VitalsSummaryGridProps {
  vitals: {
    lcp: AggregatedVital;
    inp: AggregatedVital;
    cls: AggregatedVital;
    fcp: AggregatedVital;
    ttfb: AggregatedVital;
  };
  loading?: boolean;
}

export function VitalsSummaryGrid({ vitals, loading = false }: VitalsSummaryGridProps) {
  const vitalsList = [vitals.lcp, vitals.inp, vitals.cls, vitals.fcp, vitals.ttfb];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {vitalsList.map((vital) => (
        <VitalSummaryCard key={vital.name} vital={vital} loading={loading} />
      ))}
    </div>
  );
}
