#!/usr/bin/env node
/**
 * Tool Calling Test Script for Gatewayz Models
 *
 * This script tests tool calling capabilities across various models that support it.
 * It sends requests with tool definitions and validates that models can properly:
 * 1. Understand tool definitions
 * 2. Call tools with correct arguments
 * 3. Use tool results to generate responses
 *
 * Usage:
 *   pnpm tsx test-tool-calling.ts [model-name]
 *
 * Examples:
 *   pnpm tsx test-tool-calling.ts "GPT-4o mini"
 *   pnpm tsx test-tool-calling.ts --all
 *   pnpm tsx test-tool-calling.ts --list
 */

import * as readline from 'readline';

// Models that support tool calling based on the filter
const TOOL_CALLING_MODELS = [
  'GPT-4o mini',
  'Qwen: Qwen2 72B A16B 2507',
  'Qwen: Qwen2 57B A14B 2507',
  'DeepSeek: DeepSeek V3.5',
  'DeepSeek: DeepSeek V3 Reasoner',
  'Google: Gemini 2.1 Pro',
  'Google: Gemini 2.0 Flash Thinking Experimental',
  'Anthropic: Claude 3.7 Sonnet',
  'Meta: Llama 3.3 70B',
];

// Example tools for testing
const EXAMPLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_current_weather',
      description: 'Get the current weather in a given location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'The temperature unit to use',
          },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate, e.g. "2 + 2" or "sqrt(16)"',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          num_results: {
            type: 'number',
            description: 'Number of results to return (default: 5)',
          },
        },
        required: ['query'],
      },
    },
  },
];

// Test prompts that should trigger tool calls
const TEST_PROMPTS = [
  {
    name: 'Weather Query',
    prompt: "What's the weather like in San Francisco?",
    expectedTool: 'get_current_weather',
  },
  {
    name: 'Math Calculation',
    prompt: 'What is 47 * 89 + 234?',
    expectedTool: 'calculate',
  },
  {
    name: 'Web Search',
    prompt: 'Search for the latest news about artificial intelligence',
    expectedTool: 'search_web',
  },
  {
    name: 'Multi-step Task',
    prompt: 'What is the square root of 144, and what is the weather in New York?',
    expectedTool: null, // May trigger multiple tools
  },
];

interface TestResult {
  model: string;
  prompt: string;
  success: boolean;
  toolCalled?: string;
  toolArguments?: any;
  response?: string;
  error?: string;
  latency?: number;
}

/**
 * Get API key from environment or user input
 */
async function getApiKey(): Promise<string> {
  const envKey = process.env.GATEWAYZ_API_KEY;
  if (envKey) {
    return envKey;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter your Gatewayz API key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Make a chat completion request with tools
 */
async function testToolCalling(
  apiKey: string,
  model: string,
  prompt: string,
  tools: any[]
): Promise<TestResult> {
  const startTime = Date.now();
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

  try {
    const response = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Check if the model called a tool
    const choice = data.choices?.[0];
    const message = choice?.message;
    const toolCalls = message?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      return {
        model,
        prompt,
        success: true,
        toolCalled: toolCall.function.name,
        toolArguments: JSON.parse(toolCall.function.arguments),
        response: message.content || 'Tool call made',
        latency,
      };
    }

    // No tool call made
    return {
      model,
      prompt,
      success: false,
      response: message?.content || 'No response',
      error: 'Model did not call any tools',
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      model,
      prompt,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      latency,
    };
  }
}

/**
 * Mock tool execution (for demonstration)
 */
function executeTool(toolName: string, args: any): string {
  switch (toolName) {
    case 'get_current_weather':
      return JSON.stringify({
        location: args.location,
        temperature: 72,
        unit: args.unit || 'fahrenheit',
        conditions: 'Sunny',
        humidity: 65,
      });
    case 'calculate':
      try {
        // Simple eval for demo (never use in production!)
        const result = Function(`'use strict'; return (${args.expression})`)();
        return JSON.stringify({ result });
      } catch {
        return JSON.stringify({ error: 'Invalid expression' });
      }
    case 'search_web':
      return JSON.stringify({
        query: args.query,
        results: [
          { title: 'Example Result 1', url: 'https://example.com/1' },
          { title: 'Example Result 2', url: 'https://example.com/2' },
        ],
      });
    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

/**
 * Test a model with a follow-up message using tool results
 */
async function testWithToolExecution(
  apiKey: string,
  model: string,
  prompt: string,
  tools: any[]
): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${model}`);
  console.log(`Prompt: ${prompt}`);
  console.log(`${'='.repeat(80)}\n`);

  // First request - should trigger tool call
  const result = await testToolCalling(apiKey, model, prompt, tools);

  if (!result.success) {
    console.log('❌ FAILED');
    console.log(`Error: ${result.error}`);
    console.log(`Latency: ${result.latency}ms`);
    return;
  }

  console.log('✅ Tool call successful!');
  console.log(`Tool called: ${result.toolCalled}`);
  console.log(`Arguments: ${JSON.stringify(result.toolArguments, null, 2)}`);
  console.log(`Latency: ${result.latency}ms\n`);

  // Execute the tool
  const toolResult = executeTool(result.toolCalled!, result.toolArguments);
  console.log(`Tool result: ${toolResult}\n`);

  // Second request - with tool result
  console.log('Sending follow-up with tool result...\n');

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
    const response = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_' + Math.random().toString(36).substr(2, 9),
                type: 'function',
                function: {
                  name: result.toolCalled,
                  arguments: JSON.stringify(result.toolArguments),
                },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: 'call_' + Math.random().toString(36).substr(2, 9),
            name: result.toolCalled!,
            content: toolResult,
          },
        ],
        tools: tools,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    const finalResponse = data.choices?.[0]?.message?.content;

    console.log('Final response:');
    console.log(finalResponse || 'No response received');
  } catch (error) {
    console.log('❌ Follow-up request failed:');
    console.log(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Tool Calling Test Script
========================

Usage:
  pnpm tsx test-tool-calling.ts [options] [model-name]

Options:
  --list              List all models that support tool calling
  --all               Test all models with tool calling support
  --help              Show this help message

Examples:
  pnpm tsx test-tool-calling.ts "GPT-4o mini"
  pnpm tsx test-tool-calling.ts --all
  pnpm tsx test-tool-calling.ts --list

Environment Variables:
  GATEWAYZ_API_KEY    Your Gatewayz API key (required)
  NEXT_PUBLIC_API_BASE_URL    API base URL (default: https://api.gatewayz.ai)
`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  if (args.includes('--list') || args.includes('-l')) {
    console.log('\nModels with tool calling support:\n');
    TOOL_CALLING_MODELS.forEach((model, i) => {
      console.log(`${i + 1}. ${model}`);
    });
    console.log();
    return;
  }

  // Get API key
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('Error: API key is required');
    process.exit(1);
  }

  // Determine which models to test
  let modelsToTest: string[];
  if (args.includes('--all')) {
    modelsToTest = TOOL_CALLING_MODELS;
  } else if (args.length > 0) {
    // Filter out flags
    const modelName = args.filter(arg => !arg.startsWith('--')).join(' ');
    modelsToTest = [modelName];
  } else {
    // Default to first available model
    modelsToTest = [TOOL_CALLING_MODELS[0]];
    console.log(`No model specified, using: ${modelsToTest[0]}\n`);
  }

  // Run tests
  for (const model of modelsToTest) {
    // Test with first prompt (weather query)
    await testWithToolExecution(apiKey, model, TEST_PROMPTS[0].prompt, EXAMPLE_TOOLS);

    // Add delay between tests to avoid rate limits
    if (modelsToTest.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n✨ Testing complete!\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { testToolCalling, executeTool, EXAMPLE_TOOLS, TEST_PROMPTS, TOOL_CALLING_MODELS };
