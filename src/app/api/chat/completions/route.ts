import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';
import { normalizeModelId } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || request.headers.get('authorization')?.replace('Bearer ', '');

    // Normalize @provider format model IDs (e.g., @google/models/gemini-pro → google/gemini-pro)
    const originalModel = body.model;
    const normalizedModel = normalizeModelId(body.model);
    if (originalModel !== normalizedModel) {
      console.log('[API Completions] Normalized model ID from', originalModel, 'to', normalizedModel);
    }
    body.model = normalizedModel;

    console.log('Chat completions API route - Request:', {
      model: body.model,
      hasMessages: !!body.messages,
      messageCount: body.messages?.length || 0,
      stream: body.stream,
      hasApiKey: !!apiKey,
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    // Extract session_id from query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    // Build the backend URL with session_id if provided
    let url = `${API_BASE_URL}/v1/chat/completions`;
    if (sessionId) {
      url += `?session_id=${sessionId}`;
    }

    console.log(`Chat completions API route - Calling: ${url}`);
    console.log(`Chat completions API route - Stream mode: ${body.stream}`);

    // Forward the request to the backend
    const backendRequestBody: any = {
      model: body.model,
      messages: body.messages,
      stream: body.stream,
    };

    // Add optional parameters
    if (body.max_tokens) {
      backendRequestBody.max_tokens = body.max_tokens;
    }
    if (body.temperature !== undefined) {
      backendRequestBody.temperature = body.temperature;
    }
    if (body.top_p !== undefined) {
      backendRequestBody.top_p = body.top_p;
    }
    if (body.frequency_penalty !== undefined) {
      backendRequestBody.frequency_penalty = body.frequency_penalty;
    }
    if (body.presence_penalty !== undefined) {
      backendRequestBody.presence_penalty = body.presence_penalty;
    }
    if (body.gateway) {
      backendRequestBody.gateway = body.gateway;
    }
    if (body.portkey_provider) {
      backendRequestBody.portkey_provider = body.portkey_provider;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(backendRequestBody),
    });

    console.log(`Chat completions API route - Response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Chat completions API route - Backend error:`, errorText);

      return NextResponse.json(
        { error: `Backend API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    // For streaming responses, forward the stream directly
    if (body.stream) {
      console.log('Chat completions API route - Streaming response...');

      // Return the streaming response with proper headers
      return new NextResponse(response.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // For non-streaming responses, parse and return JSON
    const data = await response.json();
    console.log('Chat completions API route - Success!');

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Completions API');
  }
}
