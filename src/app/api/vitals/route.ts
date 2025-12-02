/**
 * Web Vitals API Route
 *
 * Endpoints for recording and retrieving Web Vitals metrics.
 * POST: Record new Web Vitals metrics
 * GET: Retrieve aggregated Web Vitals summary
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  RecordWebVitalsRequest,
  WebVitalsSummary,
  WebVitalName,
  DeviceType,
  WebVitalRating,
  AggregatedVital,
} from '@/lib/web-vitals-types';
import {
  getRating,
  calculatePerformanceScore,
  METRIC_WEIGHTS,
} from '@/lib/web-vitals-types';

// ============================================================================
// In-Memory Storage (Replace with Redis/DB in production)
// ============================================================================

interface StoredMetric {
  sessionId: string;
  path: string;
  title?: string;
  device: DeviceType;
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
  delta: number;
  navigationType?: string;
  timestamp: number;
}

// Simple in-memory store for demo (use Redis in production)
const metricsStore: StoredMetric[] = [];
const MAX_STORED_METRICS = 10000;
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// POST: Record Web Vitals
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as RecordWebVitalsRequest;

    // Validate required fields
    if (!body.sessionId || !body.path || !body.metrics?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, path, or metrics' },
        { status: 400 }
      );
    }

    // Store each metric
    const now = Date.now();
    for (const metric of body.metrics) {
      // Validate metric
      if (!metric.name || typeof metric.value !== 'number') {
        continue;
      }

      const storedMetric: StoredMetric = {
        sessionId: body.sessionId,
        path: body.path,
        title: body.title,
        device: body.device || 'desktop',
        name: metric.name,
        value: metric.value,
        rating: metric.rating || getRating(metric.name, metric.value, body.device || 'desktop'),
        delta: metric.delta || metric.value,
        navigationType: metric.navigationType,
        timestamp: body.timestamp || now,
      };

      metricsStore.push(storedMetric);
    }

    // Cleanup old metrics
    cleanupOldMetrics();

    return NextResponse.json({ success: true, recorded: body.metrics.length });
  } catch (error) {
    console.error('[WebVitals API] Error recording metrics:', error);
    return NextResponse.json(
      { error: 'Failed to record metrics' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Retrieve Web Vitals Summary
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const device = (searchParams.get('device') || 'all') as DeviceType | 'all';
    const path = searchParams.get('path');

    // Calculate time range
    const now = Date.now();
    const startTime = now - hours * 60 * 60 * 1000;

    // Filter metrics
    let filteredMetrics = metricsStore.filter((m) => m.timestamp >= startTime);

    if (device !== 'all') {
      filteredMetrics = filteredMetrics.filter((m) => m.device === device);
    }

    if (path) {
      filteredMetrics = filteredMetrics.filter((m) => m.path === path);
    }

    // Calculate summary
    const summary = calculateSummary(filteredMetrics, device === 'all' ? 'desktop' : device, startTime, now);

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('[WebVitals API] Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Web Vitals summary' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function cleanupOldMetrics(): void {
  const cutoff = Date.now() - RETENTION_MS;

  // Remove metrics older than retention period
  while (metricsStore.length > 0 && metricsStore[0].timestamp < cutoff) {
    metricsStore.shift();
  }

  // Also limit total size
  while (metricsStore.length > MAX_STORED_METRICS) {
    metricsStore.shift();
  }
}

function calculateSummary(
  metrics: StoredMetric[],
  device: DeviceType,
  startTime: number,
  endTime: number
): WebVitalsSummary {
  // Group metrics by type
  const byType: Record<WebVitalName, StoredMetric[]> = {
    LCP: [],
    INP: [],
    CLS: [],
    FCP: [],
    TTFB: [],
  };

  for (const metric of metrics) {
    if (byType[metric.name]) {
      byType[metric.name].push(metric);
    }
  }

  // Calculate aggregated vitals
  const vitals = {
    lcp: calculateAggregatedVital('LCP', byType.LCP, device),
    inp: calculateAggregatedVital('INP', byType.INP, device),
    cls: calculateAggregatedVital('CLS', byType.CLS, device),
    fcp: calculateAggregatedVital('FCP', byType.FCP, device),
    ttfb: calculateAggregatedVital('TTFB', byType.TTFB, device),
  };

  // Calculate overall performance score
  const metricsForScore: { name: WebVitalName; value: number }[] = [];
  if (vitals.lcp.count > 0) metricsForScore.push({ name: 'LCP', value: vitals.lcp.p75 });
  if (vitals.inp.count > 0) metricsForScore.push({ name: 'INP', value: vitals.inp.p75 });
  if (vitals.cls.count > 0) metricsForScore.push({ name: 'CLS', value: vitals.cls.p75 });
  if (vitals.fcp.count > 0) metricsForScore.push({ name: 'FCP', value: vitals.fcp.p75 });
  if (vitals.ttfb.count > 0) metricsForScore.push({ name: 'TTFB', value: vitals.ttfb.p75 });

  const overallScore = calculatePerformanceScore(metricsForScore, device);

  // Calculate distribution
  const distribution = calculateDistribution(metrics);

  // Count unique pages
  const uniquePaths = new Set(metrics.map((m) => m.path));
  const uniqueSessions = new Set(metrics.map((m) => m.sessionId));

  return {
    performanceScore: {
      overall: overallScore,
      metrics: metricsForScore.map((m) => ({
        name: m.name,
        score: Math.round(100 * (1 - m.value / 5000)), // Simple score
        weight: METRIC_WEIGHTS[device][m.name],
        value: m.value,
        rating: getRating(m.name, m.value, device),
      })),
      device,
      sampleCount: metrics.length,
    },
    pageCount: uniquePaths.size,
    totalPageLoads: uniqueSessions.size,
    vitals,
    distribution,
    timeRange: {
      start: new Date(startTime).toISOString(),
      end: new Date(endTime).toISOString(),
    },
  };
}

function calculateAggregatedVital(
  name: WebVitalName,
  metrics: StoredMetric[],
  device: DeviceType
): AggregatedVital {
  if (metrics.length === 0) {
    return {
      name,
      p75: 0,
      rating: 'good',
      count: 0,
      trend: 'stable',
      trendPercentage: 0,
      history: [],
    };
  }

  // Sort values for percentile calculation
  const values = metrics.map((m) => m.value).sort((a, b) => a - b);

  const p75Index = Math.floor(values.length * 0.75);
  const p75 = values[p75Index] || 0;

  // Calculate rating based on p75
  const rating = getRating(name, p75, device);

  // Calculate trend (compare first half vs second half)
  const midpoint = Math.floor(metrics.length / 2);
  const firstHalf = metrics.slice(0, midpoint);
  const secondHalf = metrics.slice(midpoint);

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  let trendPercentage = 0;

  if (firstHalf.length > 0 && secondHalf.length > 0) {
    const firstAvg = firstHalf.reduce((s, m) => s + m.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, m) => s + m.value, 0) / secondHalf.length;

    if (firstAvg > 0) {
      trendPercentage = ((secondAvg - firstAvg) / firstAvg) * 100;

      if (trendPercentage < -5) {
        trend = 'improving'; // Lower is better for all metrics
      } else if (trendPercentage > 5) {
        trend = 'declining';
      }
    }
  }

  // Generate history points (group by hour)
  const history = generateHistory(metrics, device);

  return {
    name,
    p75,
    rating,
    count: metrics.length,
    trend,
    trendPercentage: Math.round(trendPercentage * 10) / 10,
    history,
  };
}

function generateHistory(
  metrics: StoredMetric[],
  device: DeviceType
): { timestamp: string; value: number; rating: WebVitalRating }[] {
  if (metrics.length === 0) return [];

  // Group by hour
  const byHour: Record<string, StoredMetric[]> = {};

  for (const metric of metrics) {
    const hour = new Date(metric.timestamp);
    hour.setMinutes(0, 0, 0);
    const key = hour.toISOString();

    if (!byHour[key]) {
      byHour[key] = [];
    }
    byHour[key].push(metric);
  }

  // Calculate p75 for each hour
  return Object.entries(byHour)
    .map(([timestamp, hourMetrics]) => {
      const values = hourMetrics.map((m) => m.value).sort((a, b) => a - b);
      const p75Index = Math.floor(values.length * 0.75);
      const value = values[p75Index] || 0;
      const name = metrics[0].name;

      return {
        timestamp,
        value,
        rating: getRating(name, value, device),
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function calculateDistribution(metrics: StoredMetric[]): {
  good: number;
  needsImprovement: number;
  poor: number;
} {
  const distribution = {
    good: 0,
    needsImprovement: 0,
    poor: 0,
  };

  for (const metric of metrics) {
    if (metric.rating === 'good') {
      distribution.good++;
    } else if (metric.rating === 'needs-improvement') {
      distribution.needsImprovement++;
    } else {
      distribution.poor++;
    }
  }

  // Convert to percentages
  const total = metrics.length || 1;
  return {
    good: Math.round((distribution.good / total) * 100),
    needsImprovement: Math.round((distribution.needsImprovement / total) * 100),
    poor: Math.round((distribution.poor / total) * 100),
  };
}
