import { NextRequest } from 'next/server';

/**
 * API Proxy for Chat Completions
 * This proxies requests to the Gatewayz API to bypass CORS issues in development
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = request.headers.get('authorization');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
    const url = `${apiUrl}/v1/chat/completions`;

    console.log('[API Proxy] Forwarding request to:', url);
    console.log('[API Proxy] Model:', body.model);
    console.log('[API Proxy] Stream:', body.stream);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(body),
    });

    console.log('[API Proxy] Response status:', response.status);

    // If not streaming, return JSON
    if (!body.stream) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For streaming responses, forward the stream
    if (!response.body) {
      return new Response(
        JSON.stringify({ error: 'No response body' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Forward the streaming response
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[API Proxy] Error:', error);

    // Extract more detailed error information
    const errorDetails = error instanceof Error ? {
      message: error.message,
      cause: (error as any).cause,
      stack: error.stack
    } : { message: 'Unknown error' };

    return new Response(
      JSON.stringify({
        error: errorDetails.message,
        details: 'Failed to proxy request to chat completions API',
        cause: errorDetails.cause,
        suggestion: 'The backend API may be experiencing issues. Try again in a moment or use a different model.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
