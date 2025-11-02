import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, message, apiKey } = body;

    console.log('Chat API route - Request:', { model, hasMessage: !!message, hasApiKey: !!apiKey });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const url = `${API_BASE_URL}/v1/chat/completions`;
    console.log(`Chat API route - Calling: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model === 'gpt-4o mini' ? 'deepseek/deepseek-chat' : model,
        messages: [{ role: 'user', content: message }],
      }),
    });

    console.log(`Chat API route - Response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Chat API route - Backend error:`, errorText);

      return NextResponse.json(
        { error: `Backend API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Chat API route - Success!');

    // Extract message from OpenAI format
    const content = data.choices?.[0]?.message?.content ||
                   data.response ||
                   data.message ||
                   data.content ||
                   'No response';

    return NextResponse.json({ response: content });
  } catch (error) {
    return handleApiError(error, 'Chat API');
  }
}
