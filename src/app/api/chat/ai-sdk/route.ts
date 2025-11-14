import { NextRequest, NextResponse } from 'next/server';
import {
  callAISDKCompletion,
  parseAISDKStream,
  AISDKMessage,
} from '@/lib/ai-sdk-gateway';
import { normalizeModelId } from '@/lib/utils';

/**
 * AI SDK Chat Completions Endpoint
 *
 * Handles chat completions using Vercel AI SDK with chain-of-thought support
 * Stream-compatible endpoint for real-time reasoning display
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      messages,
      model,
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty,
      enable_thinking,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: 'model is required' },
        { status: 400 }
      );
    }

    // Normalize @provider format model IDs (e.g., @google/models/gemini-pro → google/gemini-pro)
    const originalModel = model;
    const normalizedModel = normalizeModelId(model);
    if (originalModel !== normalizedModel) {
      console.log('[AI SDK Route] Normalized model ID from', originalModel, 'to', normalizedModel);
    }

    // Convert to AI SDK message format
    const aiSdkMessages: AISDKMessage[] = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      reasoning: m.reasoning,
    }));

    // Get the stream from AI SDK
    const stream = await callAISDKCompletion(
      aiSdkMessages,
      normalizedModel,
      {
        temperature: temperature ?? 0.7,
        maxTokens: max_tokens ?? 4096,
        topP: top_p ?? 1,
        frequencyPenalty: frequency_penalty ?? 0,
        presencePenalty: presence_penalty ?? 0,
        useThinking: enable_thinking ?? false,
      }
    );

    // Create a transform stream to convert AI SDK format to our format
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        // Parse and reformat chunks as they arrive
        const decoder = new TextDecoder();
        const text = decoder.decode(chunk);

        // Pass through the stream data
        controller.enqueue(chunk);
      },
    });

    // Pipe the stream through our transform
    const pipeStream = stream.pipeThrough(transformStream);

    // Return the streaming response
    return new NextResponse(pipeStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[AI SDK API] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
