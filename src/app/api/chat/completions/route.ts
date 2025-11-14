import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';
import { normalizeModelId } from '@/lib/utils';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

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

    let response: Response;
    const maxRetries = 3;
    let lastError: Error | null = null;

    // Retry logic for network errors
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(backendRequestBody),
        });
        break; // Success, exit retry loop
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));

        // Check if it's a network error
        const isNetworkError = fetchError instanceof TypeError ||
          (fetchError instanceof Error && (
            fetchError.message.includes('fetch') ||
            fetchError.message.includes('network') ||
            fetchError.message.includes('ECONNREFUSED') ||
            fetchError.message.includes('ECONNRESET') ||
            fetchError.message.includes('ETIMEDOUT')
          ));

        if (isNetworkError && attempt < maxRetries) {
          const waitTime = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
          console.log(`Chat completions API route - Network error, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Non-network error or max retries exceeded
        console.error('Chat completions API route - Fetch failed:', fetchError);
        return NextResponse.json(
          {
            error: isNetworkError
              ? `Network connection failed after ${maxRetries + 1} attempts. Please check your internet connection and try again.`
              : 'Failed to connect to backend API',
            details: lastError.message
          },
          { status: 503 }
        );
      }
    }

    console.log(`Chat completions API route - Response status:`, response!.status);

    if (!response!.ok) {
      const errorText = await response!.text();
      console.log(`Chat completions API route - Backend error:`, errorText);

      return NextResponse.json(
        { error: `Backend API error: ${response!.status}`, details: errorText },
        { status: response!.status }
      );
    }

    // For streaming responses, forward the stream directly
    if (body.stream) {
      console.log('Chat completions API route - Streaming response...');

      // Return the streaming response with proper headers for Edge runtime
      return new NextResponse(response!.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // For non-streaming responses, parse and return JSON
    const data = await response!.json();
    console.log('Chat completions API route - Success!');

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Completions API');
  }
}
