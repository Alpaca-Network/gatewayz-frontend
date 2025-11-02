'use server';

import { headers } from 'next/headers';

export type ChatInput = {
  modelName: string;
  prompt: string;
  apiKey?: string;
};

/**
 * Chat function - sends message via API route to backend
 */
export async function chat(input: ChatInput): Promise<string> {
  try {
    const payload = {
      model: input.modelName,
      message: input.prompt,
      apiKey: input.apiKey,
    };

    // Get the host from headers to ensure we use the correct port
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const apiUrl = `${protocol}://${host}/api/chat`;

    console.log('Server action - Sending chat request:', { url: apiUrl, model: payload.model, hasApiKey: !!payload.apiKey });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    console.log('Server action - API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.log('Server action - API error:', errorData);
      throw new Error(errorData.error || errorData.details || errorData.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Server action - API success');

    return data.response || data.message || data.content || 'No response from AI';
  } catch (error) {
    console.log('Server action - Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get response from AI');
  }
}
