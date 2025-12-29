/**
 * Web Vitals Pages API Route
 *
 * Endpoints for retrieving per-page Web Vitals performance data.
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  PageWebVitals,
  PagePerformanceData,
  WebVitalName,
  DeviceType,
  WebVitalValue,
  WebVitalRating,
} from '@/lib/web-vitals-types';
import {
  getRating,
  calculatePerformanceScore,
} from '@/lib/web-vitals-types';

// ============================================================================
// In-Memory Storage (shared with main route in production, use Redis)
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

// Demo data for development - in production, share storage with main route
const demoPages: PageWebVitals[] = [
  {
    path: '/',
    title: 'Home',
    lcp: { p50: 1200, p75: 1800, p90: 2500, p99: 4000, count: 1250, rating: 'good' },
    inp: { p50: 80, p75: 120, p90: 200, p99: 350, count: 890, rating: 'good' },
    cls: { p50: 0.02, p75: 0.05, p90: 0.1, p99: 0.2, count: 1250, rating: 'good' },
    fcp: { p50: 800, p75: 1200, p90: 1800, p99: 2800, count: 1250, rating: 'good' },
    ttfb: { p50: 200, p75: 400, p90: 700, p99: 1200, count: 1250, rating: 'good' },
    performanceScore: 92,
    opportunity: 8,
    pageLoads: 1250,
    lastUpdated: new Date().toISOString(),
  },
  {
    path: '/chat',
    title: 'Chat',
    lcp: { p50: 1800, p75: 2600, p90: 3500, p99: 5000, count: 850, rating: 'needs-improvement' },
    inp: { p50: 150, p75: 220, p90: 380, p99: 550, count: 720, rating: 'needs-improvement' },
    cls: { p50: 0.03, p75: 0.08, p90: 0.15, p99: 0.25, count: 850, rating: 'good' },
    fcp: { p50: 900, p75: 1400, p90: 2100, p99: 3200, count: 850, rating: 'good' },
    ttfb: { p50: 250, p75: 500, p90: 850, p99: 1500, count: 850, rating: 'good' },
    performanceScore: 74,
    opportunity: 18,
    pageLoads: 850,
    lastUpdated: new Date().toISOString(),
  },
  {
    path: '/models',
    title: 'Models',
    lcp: { p50: 2200, p75: 3100, p90: 4200, p99: 6000, count: 620, rating: 'needs-improvement' },
    inp: { p50: 100, p75: 180, p90: 300, p99: 480, count: 480, rating: 'good' },
    cls: { p50: 0.05, p75: 0.12, p90: 0.22, p99: 0.35, count: 620, rating: 'needs-improvement' },
    fcp: { p50: 1100, p75: 1700, p90: 2500, p99: 3800, count: 620, rating: 'good' },
    ttfb: { p50: 300, p75: 600, p90: 950, p99: 1600, count: 620, rating: 'good' },
    performanceScore: 68,
    opportunity: 24,
    pageLoads: 620,
    lastUpdated: new Date().toISOString(),
  },
  {
    path: '/rankings',
    title: 'Rankings',
    lcp: { p50: 1500, p75: 2200, p90: 3000, p99: 4500, count: 380, rating: 'good' },
    inp: { p50: 90, p75: 140, p90: 240, p99: 400, count: 290, rating: 'good' },
    cls: { p50: 0.01, p75: 0.03, p90: 0.08, p99: 0.15, count: 380, rating: 'good' },
    fcp: { p50: 750, p75: 1100, p90: 1600, p99: 2500, count: 380, rating: 'good' },
    ttfb: { p50: 180, p75: 350, p90: 600, p99: 1000, count: 380, rating: 'good' },
    performanceScore: 88,
    opportunity: 12,
    pageLoads: 380,
    lastUpdated: new Date().toISOString(),
  },
  {
    path: '/settings/account',
    title: 'Account Settings',
    lcp: { p50: 1000, p75: 1500, p90: 2100, p99: 3200, count: 220, rating: 'good' },
    inp: { p50: 60, p75: 100, p90: 170, p99: 280, count: 180, rating: 'good' },
    cls: { p50: 0.005, p75: 0.02, p90: 0.05, p99: 0.1, count: 220, rating: 'good' },
    fcp: { p50: 600, p75: 900, p90: 1400, p99: 2200, count: 220, rating: 'good' },
    ttfb: { p50: 150, p75: 300, p90: 500, p99: 850, count: 220, rating: 'good' },
    performanceScore: 95,
    opportunity: 5,
    pageLoads: 220,
    lastUpdated: new Date().toISOString(),
  },
  {
    path: '/developers',
    title: 'Developers',
    lcp: { p50: 2800, p75: 4200, p90: 5500, p99: 7500, count: 150, rating: 'poor' },
    inp: { p50: 200, p75: 350, p90: 500, p99: 700, count: 100, rating: 'needs-improvement' },
    cls: { p50: 0.15, p75: 0.25, p90: 0.4, p99: 0.6, count: 150, rating: 'poor' },
    fcp: { p50: 1800, p75: 2800, p90: 4000, p99: 5500, count: 150, rating: 'needs-improvement' },
    ttfb: { p50: 500, p75: 900, p90: 1400, p99: 2200, count: 150, rating: 'needs-improvement' },
    performanceScore: 45,
    opportunity: 42,
    pageLoads: 150,
    lastUpdated: new Date().toISOString(),
  },
];

// ============================================================================
// GET: Retrieve Page Performance Data
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'pageLoads';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search') || '';

    // Filter by search term
    let filteredPages = demoPages;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPages = demoPages.filter(
        (p) =>
          p.path.toLowerCase().includes(searchLower) ||
          p.title?.toLowerCase().includes(searchLower)
      );
    }

    // Sort pages
    const sortedPages = [...filteredPages].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortBy) {
        case 'performanceScore':
          aVal = a.performanceScore;
          bVal = b.performanceScore;
          break;
        case 'opportunity':
          aVal = a.opportunity;
          bVal = b.opportunity;
          break;
        case 'lcp':
          aVal = a.lcp?.p75 || 0;
          bVal = b.lcp?.p75 || 0;
          break;
        case 'inp':
          aVal = a.inp?.p75 || 0;
          bVal = b.inp?.p75 || 0;
          break;
        case 'cls':
          aVal = a.cls?.p75 || 0;
          bVal = b.cls?.p75 || 0;
          break;
        case 'fcp':
          aVal = a.fcp?.p75 || 0;
          bVal = b.fcp?.p75 || 0;
          break;
        case 'ttfb':
          aVal = a.ttfb?.p75 || 0;
          bVal = b.ttfb?.p75 || 0;
          break;
        case 'pageLoads':
        default:
          aVal = a.pageLoads;
          bVal = b.pageLoads;
          break;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Paginate
    const paginatedPages = sortedPages.slice(offset, offset + limit);

    const response: PagePerformanceData = {
      pages: paginatedPages,
      totalPages: filteredPages.length,
      hasMore: offset + limit < filteredPages.length,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('[WebVitals Pages API] Error fetching pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page performance data' },
      { status: 500 }
    );
  }
}
