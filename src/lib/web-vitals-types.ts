/**
 * Web Vitals Types and Interfaces
 *
 * Core Web Vitals metrics based on Google's Web Vitals initiative:
 * - LCP (Largest Contentful Paint) - Load performance
 * - INP (Interaction to Next Paint) - Interactivity (replaces FID)
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - FCP (First Contentful Paint) - Initial render
 * - TTFB (Time to First Byte) - Server response
 */

// ============================================================================
// Core Web Vitals Types
// ============================================================================

/**
 * Individual Web Vital metric names
 */
export type WebVitalName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

/**
 * Rating for a Web Vital metric
 * - good: Within acceptable thresholds
 * - needs-improvement: Moderate, could be better
 * - poor: Below acceptable thresholds
 */
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

/**
 * Device type for metric segmentation
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

/**
 * Single Web Vital measurement
 */
export interface WebVitalMetric {
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
  delta: number;
  id: string;
  navigationType: 'navigate' | 'reload' | 'back_forward' | 'prerender';
  entries: PerformanceEntry[];
}

/**
 * Page-level Web Vitals data
 */
export interface PageWebVitals {
  path: string;
  title?: string;
  lcp: WebVitalValue | null;
  inp: WebVitalValue | null;
  cls: WebVitalValue | null;
  fcp: WebVitalValue | null;
  ttfb: WebVitalValue | null;
  performanceScore: number;
  opportunity: number;
  pageLoads: number;
  lastUpdated: string;
}

/**
 * Single vital value with percentile data
 */
export interface WebVitalValue {
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  count: number;
  rating: WebVitalRating;
}

// ============================================================================
// Performance Score Types
// ============================================================================

/**
 * Individual metric score (0-100)
 */
export interface MetricScore {
  name: WebVitalName;
  score: number;
  weight: number;
  value: number;
  rating: WebVitalRating;
}

/**
 * Overall Performance Score breakdown
 */
export interface PerformanceScoreBreakdown {
  overall: number;
  metrics: MetricScore[];
  device: DeviceType;
  sampleCount: number;
}

// ============================================================================
// Thresholds and Scoring
// ============================================================================

/**
 * Threshold configuration for a single metric
 */
export interface MetricThreshold {
  good: number;
  needsImprovement: number;
}

/**
 * All metric thresholds by device type
 */
export interface WebVitalThresholds {
  desktop: Record<WebVitalName, MetricThreshold>;
  mobile: Record<WebVitalName, MetricThreshold>;
  tablet: Record<WebVitalName, MetricThreshold>;
}

/**
 * Default thresholds based on Google's recommendations
 * Values in milliseconds (except CLS which is unitless)
 */
export const WEB_VITAL_THRESHOLDS: WebVitalThresholds = {
  desktop: {
    LCP: { good: 2500, needsImprovement: 4000 },
    INP: { good: 200, needsImprovement: 500 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    FCP: { good: 1800, needsImprovement: 3000 },
    TTFB: { good: 800, needsImprovement: 1800 },
  },
  mobile: {
    LCP: { good: 2500, needsImprovement: 4000 },
    INP: { good: 200, needsImprovement: 500 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    FCP: { good: 1800, needsImprovement: 3000 },
    TTFB: { good: 800, needsImprovement: 1800 },
  },
  tablet: {
    LCP: { good: 2500, needsImprovement: 4000 },
    INP: { good: 200, needsImprovement: 500 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    FCP: { good: 1800, needsImprovement: 3000 },
    TTFB: { good: 800, needsImprovement: 1800 },
  },
};

/**
 * Performance score weights by metric (desktop)
 * Based on Lighthouse 10 scoring
 */
export const METRIC_WEIGHTS: Record<DeviceType, Record<WebVitalName, number>> = {
  desktop: {
    LCP: 0.25,
    INP: 0.30,
    CLS: 0.15,
    FCP: 0.10,
    TTFB: 0.20,
  },
  mobile: {
    LCP: 0.25,
    INP: 0.30,
    CLS: 0.15,
    FCP: 0.10,
    TTFB: 0.20,
  },
  tablet: {
    LCP: 0.25,
    INP: 0.30,
    CLS: 0.15,
    FCP: 0.10,
    TTFB: 0.20,
  },
};

// ============================================================================
// API Types
// ============================================================================

/**
 * Request body for recording Web Vitals
 */
export interface RecordWebVitalsRequest {
  sessionId: string;
  path: string;
  title?: string;
  device: DeviceType;
  userAgent?: string;
  connectionType?: string;
  metrics: {
    name: WebVitalName;
    value: number;
    rating: WebVitalRating;
    delta: number;
    navigationType?: string;
  }[];
  timestamp: number;
}

/**
 * Summary response for Web Vitals dashboard
 */
export interface WebVitalsSummary {
  performanceScore: PerformanceScoreBreakdown;
  pageCount: number;
  totalPageLoads: number;
  vitals: {
    lcp: AggregatedVital;
    inp: AggregatedVital;
    cls: AggregatedVital;
    fcp: AggregatedVital;
    ttfb: AggregatedVital;
  };
  distribution: {
    good: number;
    needsImprovement: number;
    poor: number;
  };
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * Aggregated vital with historical data
 */
export interface AggregatedVital {
  name: WebVitalName;
  p75: number;
  rating: WebVitalRating;
  count: number;
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;
  history: VitalHistoryPoint[];
}

/**
 * Single point in vital history
 */
export interface VitalHistoryPoint {
  timestamp: string;
  value: number;
  rating: WebVitalRating;
}

/**
 * Page performance data for table view
 */
export interface PagePerformanceData {
  pages: PageWebVitals[];
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get rating for a metric value
 */
export function getRating(
  name: WebVitalName,
  value: number,
  device: DeviceType = 'desktop'
): WebVitalRating {
  const thresholds = WEB_VITAL_THRESHOLDS[device][name];

  if (value <= thresholds.good) {
    return 'good';
  }
  if (value <= thresholds.needsImprovement) {
    return 'needs-improvement';
  }
  return 'poor';
}

/**
 * Calculate score for a single metric (0-100)
 * Uses log-normal distribution similar to Lighthouse
 */
export function calculateMetricScore(
  name: WebVitalName,
  value: number,
  device: DeviceType = 'desktop'
): number {
  const thresholds = WEB_VITAL_THRESHOLDS[device][name];

  // Perfect score for good values
  if (value <= thresholds.good) {
    return 100;
  }

  // Linear interpolation between good and needs-improvement
  if (value <= thresholds.needsImprovement) {
    const range = thresholds.needsImprovement - thresholds.good;
    const position = value - thresholds.good;
    return Math.round(100 - (position / range) * 50);
  }

  // Decay for poor values (0-50 range)
  const ratio = thresholds.needsImprovement / value;
  return Math.max(0, Math.round(ratio * 50));
}

/**
 * Calculate overall performance score from individual metrics
 */
export function calculatePerformanceScore(
  metrics: { name: WebVitalName; value: number }[],
  device: DeviceType = 'desktop'
): number {
  const weights = METRIC_WEIGHTS[device];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const metric of metrics) {
    const weight = weights[metric.name];
    const score = calculateMetricScore(metric.name, metric.value, device);
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Get color for rating
 */
export function getRatingColor(rating: WebVitalRating): string {
  switch (rating) {
    case 'good':
      return 'hsl(var(--chart-2))'; // Green
    case 'needs-improvement':
      return 'hsl(var(--chart-4))'; // Orange/Yellow
    case 'poor':
      return 'hsl(var(--chart-5))'; // Red
    default:
      return 'hsl(var(--muted-foreground))';
  }
}

/**
 * Format metric value for display
 */
export function formatMetricValue(name: WebVitalName, value: number): string {
  switch (name) {
    case 'CLS':
      return value.toFixed(3);
    case 'LCP':
    case 'FCP':
    case 'TTFB':
    case 'INP':
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}s`;
      }
      return `${Math.round(value)}ms`;
    default:
      return value.toFixed(2);
  }
}

/**
 * Get metric description
 */
export function getMetricDescription(name: WebVitalName): string {
  switch (name) {
    case 'LCP':
      return 'Largest Contentful Paint measures loading performance. To provide a good user experience, LCP should occur within 2.5 seconds.';
    case 'INP':
      return 'Interaction to Next Paint measures responsiveness. A good INP is 200ms or less.';
    case 'CLS':
      return 'Cumulative Layout Shift measures visual stability. A good CLS score is 0.1 or less.';
    case 'FCP':
      return 'First Contentful Paint marks when the first text or image is painted. Good FCP is under 1.8 seconds.';
    case 'TTFB':
      return 'Time to First Byte measures the time until the first byte of the page is received. Good TTFB is under 800ms.';
    default:
      return '';
  }
}

/**
 * Get metric unit
 */
export function getMetricUnit(name: WebVitalName): string {
  switch (name) {
    case 'CLS':
      return '';
    case 'LCP':
    case 'FCP':
    case 'TTFB':
    case 'INP':
      return 'ms';
    default:
      return '';
  }
}
