/**
 * Pica AI Tool Execution API
 *
 * POST /api/pica
 * Executes natural language instructions using Pica's AI-powered tools
 *
 * Request body:
 * {
 *   instruction: string;      // Natural language instruction
 *   model?: string;           // OpenAI model (default: "gpt-4.1")
 *   maxSteps?: number;        // Max tool execution steps (default: 10)
 *   connectors?: string[];    // Specific connectors to enable
 *   stream?: boolean;         // Enable streaming response
 * }
 *
 * Response (non-streaming):
 * {
 *   success: boolean;
 *   result: string;
 * }
 *
 * Response (streaming):
 * Server-sent events with text chunks
 */

import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText, streamText, stepCountIs } from "ai";
import { Pica } from "@picahq/toolkit";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60 seconds for complex tool chains

interface PicaRequestBody {
  instruction: string;
  model?: string;
  maxSteps?: number;
  connectors?: string[];
  actions?: string[];
  stream?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PicaRequestBody;

    // Validate required fields
    if (!body.instruction || typeof body.instruction !== "string") {
      return NextResponse.json(
        { success: false, error: "instruction is required and must be a string" },
        { status: 400 }
      );
    }

    // Check for API key
    const picaSecretKey = process.env.PICA_SECRET_KEY;
    if (!picaSecretKey) {
      return NextResponse.json(
        {
          success: false,
          error: "PICA_SECRET_KEY environment variable is not configured",
        },
        { status: 500 }
      );
    }

    // Check for OpenAI API key (required for AI SDK)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY environment variable is not configured",
        },
        { status: 500 }
      );
    }

    // Initialize Pica client
    const pica = new Pica(picaSecretKey, {
      connectors: body.connectors ?? ["*"],
      actions: body.actions ?? ["*"],
    });

    const model = body.model ?? "gpt-4.1";
    const maxSteps = body.maxSteps ?? 10;

    // Handle streaming response
    if (body.stream) {
      const result = streamText({
        model: openai(model),
        system: pica.systemPrompt,
        prompt: body.instruction,
        tools: { ...pica.tools() },
        stopWhen: stepCountIs(maxSteps),
      });

      // Return streaming response
      return result.toTextStreamResponse();
    }

    // Handle non-streaming response
    const { text, toolCalls, toolResults } = await generateText({
      model: openai(model),
      system: pica.systemPrompt,
      prompt: body.instruction,
      tools: { ...pica.tools() },
      stopWhen: stepCountIs(maxSteps),
    });

    return NextResponse.json({
      success: true,
      result: text,
      toolCalls: toolCalls?.map((call) => ({
        name: call.toolName,
        args: (call as { args?: unknown }).args,
      })),
      toolResults: toolResults?.map((res) => ({
        name: res.toolName,
        result: (res as { result?: unknown }).result,
      })),
    });
  } catch (error) {
    console.error("[Pica API] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// GET endpoint for health check and info
export async function GET() {
  const hasPicaKey = !!process.env.PICA_SECRET_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    service: "pica",
    status: hasPicaKey && hasOpenAIKey ? "ready" : "not_configured",
    configured: {
      pica: hasPicaKey,
      openai: hasOpenAIKey,
    },
    documentation: "https://docs.picaos.ai/",
    usage: {
      method: "POST",
      body: {
        instruction: "string (required) - Natural language instruction",
        model: "string (optional) - OpenAI model, default: gpt-4.1",
        maxSteps: "number (optional) - Max tool steps, default: 10",
        connectors: "string[] (optional) - Specific connectors to enable",
        stream: "boolean (optional) - Enable streaming response",
      },
    },
  });
}
