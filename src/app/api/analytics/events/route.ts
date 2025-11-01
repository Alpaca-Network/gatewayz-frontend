import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

/**
 * POST /api/analytics/events - Log analytics event to backend
 * Proxies analytics events to backend Statsig integration
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event_name, value, metadata } = body;

    if (!event_name) {
      return NextResponse.json(
        { error: 'event_name is required' },
        { status: 400 }
      );
    }

    console.log(`[Analytics] Logging event: ${event_name}`);

    const response = await fetch(`${API_BASE_URL}/v1/analytics/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_name,
        value,
        metadata
      })
    });

    console.log(`[Analytics] Backend response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[Analytics] Backend error:`, error);
      return NextResponse.json(
        { error: error.detail || 'Failed to log analytics event' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Analytics] Error logging event:', error);
    return NextResponse.json(
      { error: 'Failed to log analytics event' },
      { status: 500 }
    );
  }
}
