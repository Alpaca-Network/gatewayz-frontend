/**
 * Sentry Assets Insights Types
 * Based on Sentry's Assets feature for monitoring browser asset performance
 * @see https://docs.sentry.io/product/insights/frontend/assets/
 */

// Asset types supported by Sentry's asset monitoring
export type AssetType = 'script' | 'css' | 'image' | 'font' | 'other';

// Initiator type - what triggered the asset load
export type AssetInitiator = 'link' | 'script' | 'css' | 'img' | 'fetch' | 'xmlhttprequest' | 'other';

/**
 * Raw asset entry from browser's PerformanceResourceTiming API
 */
export interface RawAssetEntry {
  name: string; // Full URL of the asset
  entryType: 'resource';
  startTime: number;
  duration: number;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  renderBlockingStatus?: 'blocking' | 'non-blocking' | '';
  nextHopProtocol?: string;
  responseStart: number;
  responseEnd: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  requestStart: number;
}

/**
 * Processed asset data for display and analysis
 */
export interface AssetData {
  id: string;
  url: string;
  resourceName: string; // Parameterized/grouped resource name
  assetType: AssetType;
  initiatorType: AssetInitiator;
  duration: number; // Average duration in ms
  transferSize: number; // Bytes
  encodedSize: number; // Bytes
  decodedSize: number; // Bytes
  requestCount: number; // Number of times this asset was loaded
  renderBlocking: boolean;
  p50Duration: number;
  p75Duration: number;
  p95Duration: number;
  timeSpent: number; // duration * requestCount per minute
  lastSeen: string; // ISO timestamp
  firstSeen: string; // ISO timestamp
  pageContexts: string[]; // Pages where this asset loads
}

/**
 * Aggregated asset metrics for the overview page
 */
export interface AssetMetrics {
  totalAssets: number;
  totalRequests: number;
  avgDuration: number;
  totalTransferSize: number;
  renderBlockingCount: number;
  timeSpentTotal: number;
  byType: {
    script: AssetTypeMetrics;
    css: AssetTypeMetrics;
    image: AssetTypeMetrics;
    font: AssetTypeMetrics;
    other: AssetTypeMetrics;
  };
}

export interface AssetTypeMetrics {
  count: number;
  requests: number;
  avgDuration: number;
  totalSize: number;
  timeSpent: number;
}

/**
 * Asset summary for individual asset drill-down
 */
export interface AssetSummary {
  asset: AssetData;
  samples: AssetSampleEvent[];
  durationTrend: TrendDataPoint[];
  sizeTrend: TrendDataPoint[];
  requestTrend: TrendDataPoint[];
}

/**
 * Sample event showing asset performance in context
 */
export interface AssetSampleEvent {
  id: string;
  transactionId: string;
  timestamp: string;
  page: string;
  duration: number;
  transferSize: number;
  renderBlocking: boolean;
  browser: string;
  os: string;
}

/**
 * Trend data point for charts
 */
export interface TrendDataPoint {
  timestamp: string;
  value: number;
}

/**
 * Filter options for asset queries
 */
export interface AssetFilters {
  assetType?: AssetType | 'all';
  renderBlocking?: boolean | 'all';
  page?: string;
  search?: string;
  sortBy?: 'duration' | 'requests' | 'size' | 'timeSpent';
  sortOrder?: 'asc' | 'desc';
  dateRange?: {
    from: string;
    to: string;
  };
}

/**
 * API response for asset list
 */
export interface AssetListResponse {
  assets: AssetData[];
  metrics: AssetMetrics;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * API response for asset summary
 */
export interface AssetSummaryResponse {
  summary: AssetSummary;
}

/**
 * Parameterization patterns for grouping similar assets
 * Replaces dynamic elements with wildcards for better aggregation
 */
export const ASSET_PARAMETERIZATION_PATTERNS = [
  // Version strings like v1.2.3, @1.2.3, -1.2.3
  { pattern: /[@\-v]?\d+\.\d+(\.\d+)?/g, replacement: '*' },
  // Hexadecimal hashes (common in bundler output)
  { pattern: /[a-f0-9]{8,}/gi, replacement: '*' },
  // UUIDs
  { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '*' },
  // Integer IDs in paths
  { pattern: /\/\d+\//g, replacement: '/*/' },
  // Query string cache busters
  { pattern: /\?.*$/g, replacement: '' },
];

/**
 * Utility to determine asset type from resource entry
 */
export function getAssetType(entry: RawAssetEntry): AssetType {
  const url = entry.name.toLowerCase();
  const initiator = entry.initiatorType.toLowerCase();

  // Check by file extension
  if (url.match(/\.js($|\?)/)) return 'script';
  if (url.match(/\.css($|\?)/)) return 'css';
  if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|avif|ico)($|\?)/)) return 'image';
  if (url.match(/\.(woff2?|ttf|otf|eot)($|\?)/)) return 'font';

  // Check by initiator type
  if (initiator === 'script') return 'script';
  if (initiator === 'link' || initiator === 'css') {
    // Could be CSS or font loaded via link/CSS
    if (url.match(/font/i)) return 'font';
    return 'css';
  }
  if (initiator === 'img') return 'image';

  return 'other';
}

/**
 * Utility to parameterize an asset URL for grouping
 */
export function parameterizeAssetUrl(url: string): string {
  let result = url;

  try {
    const urlObj = new URL(url);
    // Keep only the pathname for grouping, remove origin for privacy
    result = urlObj.pathname;
  } catch {
    // If URL parsing fails, use as-is
  }

  // Apply parameterization patterns
  for (const { pattern, replacement } of ASSET_PARAMETERIZATION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Utility to format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Utility to format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
