#!/usr/bin/env node
/**
 * Simple Tool Calling Test
 *
 * A minimal example demonstrating tool calling with a FREE model
 * Usage: GATEWAYZ_API_KEY="your_key" pnpm tsx test-tool-calling-simple.ts
 */

const API_KEY = process.env.GATEWAYZ_API_KEY;
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

if (!API_KEY) {
  console.error('❌ Error: GATEWAYZ_API_KEY environment variable is required');
  console.log('\nUsage:');
  console.log('  GATEWAYZ_API_KEY="your_key" pnpm tsx test-tool-calling-simple.ts\n');
  process.exit(1);
}

// Simple weather tool definition
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather in a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name, e.g., "San Francisco"',
          },
        },
        required: ['location'],
      },
    },
  },
];

async function testToolCalling() {
  console.log('🧪 Testing Tool Calling with Qwen2 72B (FREE model)\n');
  console.log('Prompt: "What\'s the weather like in Tokyo?"\n');

  try {
    const response = await fetch(`${API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'Qwen: Qwen2 72B A16B 2507',
        messages: [
          {
            role: 'user',
            content: "What's the weather like in Tokyo?",
          },
        ],
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API Error:', error);
      process.exit(1);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    console.log('📋 Response:\n');
    console.log(JSON.stringify(data, null, 2));

    if (message?.tool_calls && message.tool_calls.length > 0) {
      console.log('\n✅ SUCCESS! Model called a tool:\n');
      const toolCall = message.tool_calls[0];
      console.log(`Tool: ${toolCall.function.name}`);
      console.log(`Arguments: ${toolCall.function.arguments}`);
      console.log('\n🎉 Tool calling is working!');
    } else {
      console.log('\n⚠️  Model did not call a tool');
      console.log('Response content:', message?.content);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testToolCalling();
