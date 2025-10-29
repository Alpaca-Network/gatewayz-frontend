import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/ranking/apps - Proxy to backend ranking apps endpoint
export async function GET() {
  try {
    const url = `${API_BASE_URL}/ranking/apps`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch ranking apps', data: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching ranking apps:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ranking apps', data: [] },
      { status: 500 }
    );
  }
}
