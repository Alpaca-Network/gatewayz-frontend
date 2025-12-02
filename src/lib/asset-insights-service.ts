/**
 * Asset Insights Service
 * Provides aggregation and analysis of browser asset performance data
 * for the Sentry-style Assets Insights feature.
 */

import {
  AssetData,
  AssetMetrics,
  AssetTypeMetrics,
  AssetFilters,
  AssetListResponse,
  AssetSummary,
  AssetSampleEvent,
  TrendDataPoint,
  AssetType,
} from './sentry-assets-types';

// Demo data for when no real data is available
const DEMO_ASSETS: AssetData[] = [
  {
    id: 'script:/_next/static/chunks/main-*.js',
    url: 'https://beta.gatewayz.ai/_next/static/chunks/main-abc123.js',
    resourceName: '/_next/static/chunks/main-*.js',
    assetType: 'script',
    initiatorType: 'script',
    duration: 145,
    transferSize: 98304,
    encodedSize: 95000,
    decodedSize: 312000,
    requestCount: 1250,
    renderBlocking: false,
    p50Duration: 120,
    p75Duration: 180,
    p95Duration: 350,
    timeSpent: 181250,
    lastSeen: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    pageContexts: ['/', '/chat', '/models'],
  },
  {
    id: 'script:/_next/static/chunks/pages/_app-*.js',
    url: 'https://beta.gatewayz.ai/_next/static/chunks/pages/_app-def456.js',
    resourceName: '/_next/static/chunks/pages/_app-*.js',
    assetType: 'script',
    initiatorType: 'script',
    duration: 89,
    transferSize: 45056,
    encodedSize: 43000,
    decodedSize: 156000,
    requestCount: 1250,
    renderBlocking: true,
    p50Duration: 75,
    p75Duration: 110,
    p95Duration: 220,
    timeSpent: 111250,
    lastSeen: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    pageContexts: ['/', '/chat', '/models', '/settings'],
  },
  {
    id: 'css:/_next/static/css/app-*.css',
    url: 'https://beta.gatewayz.ai/_next/static/css/app-789ghi.css',
    resourceName: '/_next/static/css/app-*.css',
    assetType: 'css',
    initiatorType: 'link',
    duration: 65,
    transferSize: 28672,
    encodedSize: 27000,
    decodedSize: 89000,
    requestCount: 1250,
    renderBlocking: true,
    p50Duration: 55,
    p75Duration: 80,
    p95Duration: 150,
    timeSpent: 81250,
    lastSeen: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    pageContexts: ['/', '/chat', '/models'],
  },
  {
    id: 'image:/logo_black.svg',
    url: 'https://beta.gatewayz.ai/logo_black.svg',
    resourceName: '/logo_black.svg',
    assetType: 'image',
    initiatorType: 'img',
    duration: 25,
    transferSize: 2048,
    encodedSize: 2000,
    decodedSize: 2000,
    requestCount: 3500,
    renderBlocking: false,
    p50Duration: 20,
    p75Duration: 30,
    p95Duration: 60,
    timeSpent: 87500,
    lastSeen: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    pageContexts: ['/', '/chat', '/models', '/settings', '/rankings'],
  },
  {
    id: 'font:/fonts/inter-*.woff2',
    url: 'https://beta.gatewayz.ai/fonts/inter-regular.woff2',
    resourceName: '/fonts/inter-*.woff2',
    assetType: 'font',
    initiatorType: 'css',
    duration: 42,
    transferSize: 24576,
    encodedSize: 24000,
    decodedSize: 24000,
    requestCount: 1250,
    renderBlocking: false,
    p50Duration: 35,
    p75Duration: 50,
    p95Duration: 95,
    timeSpent: 52500,
    lastSeen: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    pageContexts: ['/', '/chat', '/models'],
  },
  {
    id: 'script:/vendor/chart-*.js',
    url: 'https://beta.gatewayz.ai/vendor/chart-2.9.4.js',
    resourceName: '/vendor/chart-*.js',
    assetType: 'script',
    initiatorType: 'script',
    duration: 210,
    transferSize: 184320,
    encodedSize: 180000,
    decodedSize: 520000,
    requestCount: 450,
    renderBlocking: false,
    p50Duration: 180,
    p75Duration: 250,
    p95Duration: 480,
    timeSpent: 94500,
    lastSeen: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    pageContexts: ['/rankings', '/settings/activity'],
  },
  {
    id: 'image:/providers/*.png',
    url: 'https://beta.gatewayz.ai/providers/openai.png',
    resourceName: '/providers/*.png',
    assetType: 'image',
    initiatorType: 'img',
    duration: 35,
    transferSize: 8192,
    encodedSize: 8000,
    decodedSize: 32000,
    requestCount: 2800,
    renderBlocking: false,
    p50Duration: 28,
    p75Duration: 45,
    p95Duration: 90,
    timeSpent: 98000,
    lastSeen: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    pageContexts: ['/models', '/chat'],
  },
  {
    id: 'script:/_next/static/chunks/webpack-*.js',
    url: 'https://beta.gatewayz.ai/_next/static/chunks/webpack-hash.js',
    resourceName: '/_next/static/chunks/webpack-*.js',
    assetType: 'script',
    initiatorType: 'script',
    duration: 12,
    transferSize: 4096,
    encodedSize: 4000,
    decodedSize: 12000,
    requestCount: 1250,
    renderBlocking: true,
    p50Duration: 10,
    p75Duration: 15,
    p95Duration: 30,
    timeSpent: 15000,
    lastSeen: new Date().toISOString(),
    firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    pageContexts: ['/', '/chat', '/models', '/settings'],
  },
];

/**
 * Calculate metrics for a specific asset type
 */
function calculateTypeMetrics(assets: AssetData[], type: AssetType): AssetTypeMetrics {
  const typeAssets = assets.filter(a => a.assetType === type);

  if (typeAssets.length === 0) {
    return {
      count: 0,
      requests: 0,
      avgDuration: 0,
      totalSize: 0,
      timeSpent: 0,
    };
  }

  const totalRequests = typeAssets.reduce((sum, a) => sum + a.requestCount, 0);
  const totalDuration = typeAssets.reduce((sum, a) => sum + (a.duration * a.requestCount), 0);
  const totalSize = typeAssets.reduce((sum, a) => sum + a.transferSize, 0);
  const totalTimeSpent = typeAssets.reduce((sum, a) => sum + a.timeSpent, 0);

  return {
    count: typeAssets.length,
    requests: totalRequests,
    avgDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
    totalSize,
    timeSpent: totalTimeSpent,
  };
}

/**
 * Calculate overall metrics from asset data
 */
export function calculateAssetMetrics(assets: AssetData[]): AssetMetrics {
  const totalRequests = assets.reduce((sum, a) => sum + a.requestCount, 0);
  const totalDuration = assets.reduce((sum, a) => sum + (a.duration * a.requestCount), 0);
  const totalTransferSize = assets.reduce((sum, a) => sum + a.transferSize, 0);
  const totalTimeSpent = assets.reduce((sum, a) => sum + a.timeSpent, 0);
  const renderBlockingCount = assets.filter(a => a.renderBlocking).length;

  return {
    totalAssets: assets.length,
    totalRequests,
    avgDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
    totalTransferSize,
    renderBlockingCount,
    timeSpentTotal: totalTimeSpent,
    byType: {
      script: calculateTypeMetrics(assets, 'script'),
      css: calculateTypeMetrics(assets, 'css'),
      image: calculateTypeMetrics(assets, 'image'),
      font: calculateTypeMetrics(assets, 'font'),
      other: calculateTypeMetrics(assets, 'other'),
    },
  };
}

/**
 * Filter and sort assets based on filters
 */
export function filterAssets(assets: AssetData[], filters: AssetFilters): AssetData[] {
  let result = [...assets];

  // Filter by asset type
  if (filters.assetType && filters.assetType !== 'all') {
    result = result.filter(a => a.assetType === filters.assetType);
  }

  // Filter by render blocking
  if (filters.renderBlocking !== undefined && filters.renderBlocking !== 'all') {
    result = result.filter(a => a.renderBlocking === filters.renderBlocking);
  }

  // Filter by page
  if (filters.page) {
    result = result.filter(a => a.pageContexts.includes(filters.page!));
  }

  // Filter by search term
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(a =>
      a.resourceName.toLowerCase().includes(searchLower) ||
      a.url.toLowerCase().includes(searchLower)
    );
  }

  // Sort
  const sortBy = filters.sortBy || 'timeSpent';
  const sortOrder = filters.sortOrder || 'desc';

  result.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'duration':
        comparison = a.duration - b.duration;
        break;
      case 'requests':
        comparison = a.requestCount - b.requestCount;
        break;
      case 'size':
        comparison = a.transferSize - b.transferSize;
        break;
      case 'timeSpent':
      default:
        comparison = a.timeSpent - b.timeSpent;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return result;
}

/**
 * Get asset list with pagination
 */
export function getAssetList(
  assets: AssetData[],
  filters: AssetFilters,
  page: number = 1,
  pageSize: number = 20
): AssetListResponse {
  const filteredAssets = filterAssets(assets, filters);
  const metrics = calculateAssetMetrics(filteredAssets);

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedAssets = filteredAssets.slice(startIndex, endIndex);

  return {
    assets: paginatedAssets,
    metrics,
    pagination: {
      page,
      pageSize,
      total: filteredAssets.length,
      hasMore: endIndex < filteredAssets.length,
    },
  };
}

/**
 * Generate sample events for an asset (demo data)
 */
function generateSampleEvents(asset: AssetData): AssetSampleEvent[] {
  const samples: AssetSampleEvent[] = [];
  const browsers = ['Chrome 120', 'Firefox 121', 'Safari 17', 'Edge 120'];
  const oses = ['Windows 11', 'macOS 14', 'iOS 17', 'Android 14'];

  for (let i = 0; i < 10; i++) {
    const durationVariance = asset.duration * (0.5 + Math.random());
    const sizeVariance = asset.transferSize * (0.8 + Math.random() * 0.4);

    samples.push({
      id: `sample-${asset.id}-${i}`,
      transactionId: `txn-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      page: asset.pageContexts[Math.floor(Math.random() * asset.pageContexts.length)],
      duration: durationVariance,
      transferSize: sizeVariance,
      renderBlocking: asset.renderBlocking,
      browser: browsers[Math.floor(Math.random() * browsers.length)],
      os: oses[Math.floor(Math.random() * oses.length)],
    });
  }

  return samples.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Generate trend data for an asset (demo data)
 */
function generateTrendData(asset: AssetData, days: number = 7): TrendDataPoint[] {
  const points: TrendDataPoint[] = [];
  const now = Date.now();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const variance = 0.8 + Math.random() * 0.4;

    points.push({
      timestamp: date.toISOString().split('T')[0],
      value: asset.duration * variance,
    });
  }

  return points;
}

/**
 * Get asset summary with detailed information
 */
export function getAssetSummary(asset: AssetData): AssetSummary {
  return {
    asset,
    samples: generateSampleEvents(asset),
    durationTrend: generateTrendData(asset),
    sizeTrend: generateTrendData({ ...asset, duration: asset.transferSize }),
    requestTrend: generateTrendData({ ...asset, duration: asset.requestCount / 7 }),
  };
}

/**
 * Get demo assets for testing/preview
 */
export function getDemoAssets(): AssetData[] {
  return DEMO_ASSETS;
}

/**
 * Merge real and demo assets, preferring real data
 */
export function mergeWithDemoAssets(realAssets: AssetData[]): AssetData[] {
  if (realAssets.length >= 5) {
    return realAssets;
  }

  // Add demo assets to fill in gaps
  const demoToAdd = DEMO_ASSETS.filter(
    demo => !realAssets.some(real => real.resourceName === demo.resourceName)
  );

  return [...realAssets, ...demoToAdd.slice(0, 8 - realAssets.length)];
}
