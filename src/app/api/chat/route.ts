import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, HttpError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';
import { normalizeModelId } from '@/lib/utils';
import * as Sentry from '@sentry/nextjs';

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

    // Normalize @provider format model IDs (e.g., @google/models/gemini-pro → google/gemini-pro)
    let normalizedModel = model === 'gpt-4o mini' ? 'deepseek/deepseek-chat' : model;
    const originalModel = normalizedModel;
    normalizedModel = normalizeModelId(normalizedModel);
    if (originalModel !== normalizedModel) {
      console.log('[Chat API] Normalized model ID from', originalModel, 'to', normalizedModel);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: normalizedModel,
        messages: [{ role: 'user', content: message }],
      }),
    });

    console.log(`Chat API route - Response status:`, response.status);

    if (!response.ok) {
      let errorText = '';
      let errorData: any = null;

      try {
        errorText = await response.text();
        // Try to parse as JSON for structured error data
        if (errorText) {
          try {
            errorData = JSON.parse(errorText);
          } catch {
            // Not JSON, use text as-is
          }
        }
      } catch (parseError) {
        console.error('[Chat API] Failed to parse error response:', parseError);
        errorText = 'Failed to parse error response';
      }

      // Enhanced error logging with context
      const errorContext = {
        status: response.status,
        statusText: response.statusText,
        url,
        model: normalizedModel,
        originalModel,
        errorData,
        errorText,
      };

      console.error(`[Chat API] Backend error (${response.status}):`, errorContext);

      // Handle specific error cases
      if (response.status === 404) {
        // 404 errors - endpoint not found or model not available
        const message = errorData?.detail || errorData?.error || errorText || 'Endpoint or model not found';

        Sentry.captureException(new HttpError(message, 404, errorContext), {
          tags: {
            error_type: 'chat_api_not_found',
            model: normalizedModel,
            endpoint: url,
          },
          contexts: {
            chat_request: {
              model: normalizedModel,
              original_model: originalModel,
              has_message: !!message,
            },
            backend_response: errorContext,
          },
          level: 'warning',
        });

        return NextResponse.json(
          {
            error: 'Model or endpoint not available',
            message,
            details: errorData || { raw: errorText },
            suggestions: [
              'Check if the model name is correct',
              'Verify the backend API is running',
              'Try a different model',
            ]
          },
          { status: 404 }
        );
      }

      if (response.status === 401 || response.status === 403) {
        // Authentication/Authorization errors
        const message = errorData?.detail || errorData?.error || 'Authentication failed';

        Sentry.captureException(new HttpError(message, response.status, errorContext), {
          tags: {
            error_type: 'chat_api_auth_error',
            status_code: response.status,
          },
          level: 'warning',
        });

        return NextResponse.json(
          {
            error: 'Authentication failed',
            message,
            details: errorData || { raw: errorText }
          },
          { status: response.status }
        );
      }

      if (response.status >= 500) {
        // Server errors - higher priority for Sentry
        const message = errorData?.detail || errorData?.error || 'Backend server error';

        Sentry.captureException(new HttpError(message, response.status, errorContext), {
          tags: {
            error_type: 'chat_api_server_error',
            status_code: response.status,
            model: normalizedModel,
          },
          contexts: {
            backend_response: errorContext,
          },
          level: 'error',
        });
      }

      // Generic error response
      return NextResponse.json(
        {
          error: `Backend API error: ${response.status}`,
          message: errorData?.detail || errorData?.error || errorData?.message || errorText,
          details: errorData || { raw: errorText }
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Chat API] Success - received response');

    // Extract message from OpenAI format
    const content = data.choices?.[0]?.message?.content ||
                   data.response ||
                   data.message ||
                   data.content ||
                   'No response';

    return NextResponse.json({ response: content });
  } catch (error) {
    // Add additional context to unexpected errors
    if (error instanceof Error) {
      Sentry.addBreadcrumb({
        category: 'chat_api',
        message: 'Unexpected error in chat API route',
        level: 'error',
        data: {
          error_message: error.message,
          error_stack: error.stack,
        },
      });
    }

    return handleApiError(error, 'Chat API');
  }
}
