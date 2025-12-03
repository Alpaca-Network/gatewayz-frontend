/**
 * Pica Toolkit Integration Service
 *
 * Provides AI-powered tool execution using Pica's unified connector system.
 * Integrates with 100+ third-party services through natural language instructions.
 *
 * @see https://docs.picaos.ai/
 */

import { openai } from "@ai-sdk/openai";
import { generateText, streamText, stepCountIs } from "ai";
import { Pica } from "@picahq/toolkit";

// Re-export Pica for direct usage if needed
export { Pica } from "@picahq/toolkit";

export interface PicaConfig {
  secretKey: string;
  connectors?: string[]; // Specific connectors to enable, or ["*"] for all
  actions?: string[]; // Specific actions to enable, or ["*"] for all
}

export interface PicaExecuteOptions {
  model?: string; // OpenAI model to use (default: "gpt-4.1")
  maxSteps?: number; // Maximum tool execution steps (default: 10)
  temperature?: number;
  maxTokens?: number;
}

export interface PicaStreamOptions extends PicaExecuteOptions {
  onToolCall?: (tool: string, args: unknown) => void;
  onToolResult?: (tool: string, result: unknown) => void;
}

/**
 * Creates a Pica client instance
 */
export function createPicaClient(config: PicaConfig): Pica {
  return new Pica(config.secretKey, {
    connectors: config.connectors ?? ["*"],
    actions: config.actions ?? ["*"],
  });
}

/**
 * Gets the default Pica client using environment variable
 * @throws Error if PICA_SECRET_KEY is not set
 */
export function getDefaultPicaClient(): Pica {
  const secretKey = process.env.PICA_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "PICA_SECRET_KEY environment variable is not set. " +
        "Get your key from https://app.picaos.ai/settings/api-keys"
    );
  }

  return createPicaClient({
    secretKey,
    connectors: ["*"],
    actions: ["*"],
  });
}

/**
 * Executes a natural language instruction using Pica tools
 *
 * @example
 * ```ts
 * const result = await executePicaInstruction(
 *   "Star the repo picahq/pica using github"
 * );
 * console.log(result);
 * ```
 */
export async function executePicaInstruction(
  instruction: string,
  options: PicaExecuteOptions = {}
): Promise<string> {
  const pica = getDefaultPicaClient();
  const { model = "gpt-4.1", maxSteps = 10, temperature, maxTokens } = options;

  const { text } = await generateText({
    model: openai(model),
    system: pica.systemPrompt,
    prompt: instruction,
    tools: { ...pica.tools() },
    stopWhen: stepCountIs(maxSteps),
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { maxTokens }),
  });

  return text;
}

/**
 * Executes a Pica instruction with streaming response
 *
 * @example
 * ```ts
 * const stream = await streamPicaInstruction(
 *   "Create a new issue on github for picahq/pica",
 *   {
 *     onToolCall: (tool, args) => console.log(`Calling ${tool}...`),
 *     onToolResult: (tool, result) => console.log(`${tool} result:`, result),
 *   }
 * );
 *
 * for await (const chunk of stream.textStream) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function streamPicaInstruction(
  instruction: string,
  options: PicaStreamOptions = {}
) {
  const pica = getDefaultPicaClient();
  const {
    model = "gpt-4.1",
    maxSteps = 10,
    temperature,
    maxTokens,
    onToolCall,
    onToolResult,
  } = options;

  const result = streamText({
    model: openai(model),
    system: pica.systemPrompt,
    prompt: instruction,
    tools: { ...pica.tools() },
    stopWhen: stepCountIs(maxSteps),
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { maxTokens }),
    onStepFinish: (step) => {
      // Handle tool calls if callback provided
      if (step.toolCalls && onToolCall) {
        for (const call of step.toolCalls) {
          onToolCall(call.toolName, (call as { args?: unknown }).args);
        }
      }
      if (step.toolResults && onToolResult) {
        for (const res of step.toolResults) {
          onToolResult(res.toolName, (res as { result?: unknown }).result);
        }
      }
    },
  });

  return result;
}

/**
 * Creates a custom Pica executor with specific configuration
 * Useful for scoped connector access or custom model settings
 *
 * @example
 * ```ts
 * const githubExecutor = createPicaExecutor({
 *   secretKey: process.env.PICA_SECRET_KEY!,
 *   connectors: ["github"], // Only enable GitHub connector
 *   actions: ["*"],
 * });
 *
 * const result = await githubExecutor.execute("Star repo picahq/pica");
 * ```
 */
export function createPicaExecutor(config: PicaConfig) {
  const pica = createPicaClient(config);

  return {
    pica,
    systemPrompt: pica.systemPrompt,
    tools: pica.tools(),

    async execute(
      instruction: string,
      options: PicaExecuteOptions = {}
    ): Promise<string> {
      const {
        model = "gpt-4.1",
        maxSteps = 10,
        temperature,
        maxTokens,
      } = options;

      const { text } = await generateText({
        model: openai(model),
        system: pica.systemPrompt,
        prompt: instruction,
        tools: { ...pica.tools() },
        stopWhen: stepCountIs(maxSteps),
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { maxTokens }),
      });

      return text;
    },

    stream(instruction: string, options: PicaStreamOptions = {}) {
      const {
        model = "gpt-4.1",
        maxSteps = 10,
        temperature,
        maxTokens,
        onToolCall,
        onToolResult,
      } = options;

      return streamText({
        model: openai(model),
        system: pica.systemPrompt,
        prompt: instruction,
        tools: { ...pica.tools() },
        stopWhen: stepCountIs(maxSteps),
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { maxTokens }),
        onStepFinish: (step) => {
          if (step.toolCalls && onToolCall) {
            for (const call of step.toolCalls) {
              onToolCall(call.toolName, (call as { args?: unknown }).args);
            }
          }
          if (step.toolResults && onToolResult) {
            for (const res of step.toolResults) {
              onToolResult(res.toolName, (res as { result?: unknown }).result);
            }
          }
        },
      });
    },
  };
}

/**
 * Available Pica connectors
 * Reference: https://docs.picaos.ai/connectors
 */
export const PICA_CONNECTORS = {
  // Productivity & Communication
  SLACK: "slack",
  DISCORD: "discord",
  GMAIL: "gmail",
  NOTION: "notion",

  // Development & Code
  GITHUB: "github",
  GITLAB: "gitlab",
  JIRA: "jira",
  LINEAR: "linear",

  // CRM & Sales
  SALESFORCE: "salesforce",
  HUBSPOT: "hubspot",
  PIPEDRIVE: "pipedrive",

  // Storage & Files
  GOOGLE_DRIVE: "google-drive",
  DROPBOX: "dropbox",
  BOX: "box",

  // Calendar & Scheduling
  GOOGLE_CALENDAR: "google-calendar",
  CALENDLY: "calendly",

  // Database & Analytics
  AIRTABLE: "airtable",
  GOOGLE_SHEETS: "google-sheets",

  // Social Media
  TWITTER: "twitter",
  LINKEDIN: "linkedin",

  // Payments
  STRIPE: "stripe",

  // All connectors
  ALL: "*",
} as const;

export type PicaConnector = (typeof PICA_CONNECTORS)[keyof typeof PICA_CONNECTORS];
