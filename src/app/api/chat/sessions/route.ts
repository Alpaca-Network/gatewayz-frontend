import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { CHAT_HISTORY_API_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/chat/sessions - List all chat sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    const url = `${CHAT_HISTORY_API_URL}/v1/chat/sessions?limit=${limit}&offset=${offset}`;
    console.log(`Chat sessions API - Calling: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Chat sessions API - Response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to fetch sessions' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Sessions API - GET');
  }
}

// POST /api/chat/sessions - Create a new chat session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, model } = body;

    const { key: apiKey, error } = await validateApiKey(request);
    if (error) return error;

    const url = `${CHAT_HISTORY_API_URL}/v1/chat/sessions`;
    console.log(`Chat sessions API - Creating session at: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title || `Chat ${new Date().toLocaleString()}`,
        model: model || 'openai/gpt-3.5-turbo'
      })
    });
    
    console.log(`Chat sessions API - Create response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to create session' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Sessions API - POST');
  }
}
