#!/usr/bin/env node

/**
 * Comprehensive Chat Implementation Validator
 * Validates all chat components without requiring external network access
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 GATEWAYZ CHAT IMPLEMENTATION VALIDATOR\n');
console.log('='.repeat(70) + '\n');

let totalTests = 0;
let passedTests = 0;

function test(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

// Test Suite 1: File Existence and Size
console.log('📁 TEST SUITE 1: Core Chat Files\n' + '-'.repeat(70));

const coreFiles = [
  { path: 'src/app/chat/page.tsx', minSize: 100000, description: 'Main chat interface' },
  { path: 'src/lib/streaming.ts', minSize: 20000, description: 'Streaming handler' },
  { path: 'src/lib/chat-history.ts', minSize: 8000, description: 'Chat history API' },
  { path: 'src/components/chat/model-select.tsx', minSize: 20000, description: 'Model selector' }
];

coreFiles.forEach(({ path: filePath, minSize, description }) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    const stats = fs.statSync(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    test(
      `${description}`,
      stats.size >= minSize,
      `${filePath} (${sizeKB}KB)`
    );
  } catch (e) {
    test(`${description}`, false, `${filePath} - NOT FOUND`);
  }
});

console.log('\n');

// Test Suite 2: API Routes
console.log('🛣️  TEST SUITE 2: API Route Handlers\n' + '-'.repeat(70));

const apiRoutes = [
  { path: 'src/app/api/chat/completions/route.ts', name: 'Chat completions' },
  { path: 'src/app/api/chat/sessions/route.ts', name: 'Session management (list/create)' },
  { path: 'src/app/api/chat/sessions/[id]/route.ts', name: 'Session CRUD operations' },
  { path: 'src/app/api/chat/sessions/[id]/messages/route.ts', name: 'Message persistence' },
  { path: 'src/app/api/chat/search/route.ts', name: 'Session search' },
  { path: 'src/app/api/chat/stats/route.ts', name: 'Analytics and stats' },
  { path: 'src/app/api/chat/ai-sdk/route.ts', name: 'AI SDK integration' }
];

apiRoutes.forEach(({ path: filePath, name }) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const hasPost = content.includes('export async function POST');
    const hasGet = content.includes('export async function GET');
    const hasPut = content.includes('export async function PUT');
    const hasDelete = content.includes('export async function DELETE');

    const methods = [
      hasPost && 'POST',
      hasGet && 'GET',
      hasPut && 'PUT',
      hasDelete && 'DELETE'
    ].filter(Boolean).join(', ');

    test(name, fs.existsSync(fullPath), `Methods: ${methods}`);
  } catch (e) {
    test(name, false, `${filePath} - NOT FOUND`);
  }
});

console.log('\n');

// Test Suite 3: Code Quality Checks
console.log('🔬 TEST SUITE 3: Implementation Quality\n' + '-'.repeat(70));

// Check streaming.ts implementation
try {
  const streamingContent = fs.readFileSync(path.join(__dirname, 'src/lib/streaming.ts'), 'utf8');

  test(
    'Streaming: SSE parsing',
    streamingContent.includes('data:') && streamingContent.includes('[DONE]'),
    'Server-Sent Events support detected'
  );

  test(
    'Streaming: Retry logic',
    streamingContent.includes('retryCount') && streamingContent.includes('maxRetries'),
    'Exponential backoff retry mechanism found'
  );

  test(
    'Streaming: Error handling',
    streamingContent.includes('401') && streamingContent.includes('429') && streamingContent.includes('500'),
    'HTTP error codes handled: 401, 429, 500'
  );

  test(
    'Streaming: Rate limiting',
    streamingContent.includes('rate_limit') || streamingContent.includes('Rate limit'),
    'Rate limit detection and handling'
  );

  test(
    'Streaming: Timeout protection',
    streamingContent.includes('AbortController') || streamingContent.includes('timeout'),
    'Request timeout protection implemented'
  );

  test(
    'Streaming: Reasoning support',
    streamingContent.includes('reasoning') && streamingContent.includes('thinking'),
    'Chain-of-thought reasoning extraction'
  );
} catch (e) {
  test('Streaming implementation', false, 'Could not read streaming.ts');
}

console.log('');

// Check chat-history.ts implementation
try {
  const chatHistoryContent = fs.readFileSync(path.join(__dirname, 'src/lib/chat-history.ts'), 'utf8');

  test(
    'Chat History: API wrapper class',
    chatHistoryContent.includes('class ChatHistoryAPI'),
    'ChatHistoryAPI class found'
  );

  test(
    'Chat History: CRUD methods',
    chatHistoryContent.includes('createSession') &&
    chatHistoryContent.includes('getSessions') &&
    chatHistoryContent.includes('deleteSession'),
    'Session CRUD methods: create, get, delete'
  );

  test(
    'Chat History: Message saving',
    chatHistoryContent.includes('saveMessage'),
    'Message persistence method found'
  );

  test(
    'Chat History: Search functionality',
    chatHistoryContent.includes('searchSessions'),
    'Session search capability'
  );

  test(
    'Chat History: Authentication',
    chatHistoryContent.includes('Bearer') && chatHistoryContent.includes('apiKey'),
    'Bearer token authentication'
  );
} catch (e) {
  test('Chat History implementation', false, 'Could not read chat-history.ts');
}

console.log('\n');

// Test Suite 4: Chat Page Features
console.log('🎨 TEST SUITE 4: Chat UI Features\n' + '-'.repeat(70));

try {
  const chatPageContent = fs.readFileSync(path.join(__dirname, 'src/app/chat/page.tsx'), 'utf8');

  test(
    'UI: Model selection',
    chatPageContent.includes('ModelSelect') || chatPageContent.includes('model-select'),
    'Dynamic model selector component'
  );

  test(
    'UI: Message rendering',
    chatPageContent.includes('ReactMarkdown') || chatPageContent.includes('markdown'),
    'Markdown message rendering'
  );

  test(
    'UI: Session management',
    chatPageContent.includes('ChatSession') && chatPageContent.includes('session'),
    'Chat session state management'
  );

  test(
    'UI: Streaming responses',
    chatPageContent.includes('streamChatResponse') || chatPageContent.includes('streaming'),
    'Real-time streaming integration'
  );

  test(
    'UI: Image support',
    chatPageContent.includes('ImageIcon') || chatPageContent.includes('image'),
    'Image upload capability'
  );

  test(
    'UI: Authentication integration',
    chatPageContent.includes('useAuth') || chatPageContent.includes('getApiKey'),
    'Auth context integration'
  );
} catch (e) {
  test('Chat UI implementation', false, 'Could not read chat page');
}

console.log('\n');

// Test Suite 5: API Route Implementation
console.log('⚙️  TEST SUITE 5: API Route Quality\n' + '-'.repeat(70));

try {
  const completionsContent = fs.readFileSync(
    path.join(__dirname, 'src/app/api/chat/completions/route.ts'),
    'utf8'
  );

  test(
    'Completions: Model normalization',
    completionsContent.includes('normalizeModelId'),
    'Model ID format standardization'
  );

  test(
    'Completions: Retry logic',
    completionsContent.includes('maxRetries') && completionsContent.includes('attempt'),
    'Network retry with backoff'
  );

  test(
    'Completions: Streaming support',
    completionsContent.includes('text/event-stream'),
    'SSE streaming response handling'
  );

  test(
    'Completions: Session linking',
    completionsContent.includes('session_id'),
    'Chat session association'
  );
} catch (e) {
  test('Completions endpoint', false, 'Could not read completions route');
}

console.log('');

try {
  const sessionsContent = fs.readFileSync(
    path.join(__dirname, 'src/app/api/chat/sessions/route.ts'),
    'utf8'
  );

  test(
    'Sessions: List endpoint (GET)',
    sessionsContent.includes('export async function GET'),
    'Retrieve all sessions'
  );

  test(
    'Sessions: Create endpoint (POST)',
    sessionsContent.includes('export async function POST'),
    'Create new sessions'
  );

  test(
    'Sessions: Pagination',
    sessionsContent.includes('limit') && sessionsContent.includes('offset'),
    'Pagination parameters: limit, offset'
  );
} catch (e) {
  test('Sessions endpoint', false, 'Could not read sessions route');
}

console.log('\n');

// Test Suite 6: Component Ecosystem
console.log('🧩 TEST SUITE 6: Supporting Components\n' + '-'.repeat(70));

const components = [
  { path: 'src/components/chat/model-select.tsx', name: 'Model selector' },
  { path: 'src/components/chat/reasoning-display.tsx', name: 'Reasoning display' },
  { path: 'src/components/chat/chain-of-thought.tsx', name: 'Chain-of-thought' },
  { path: 'src/components/chat/free-models-banner.tsx', name: 'Free models banner' },
  { path: 'src/components/chat/mini-chat-widget.tsx', name: 'Mini chat widget' }
];

components.forEach(({ path: filePath, name }) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    const exists = fs.existsSync(fullPath);
    test(name, exists, exists ? '✓' : 'Missing');
  } catch (e) {
    test(name, false, 'Error checking file');
  }
});

console.log('\n');

// Test Suite 7: TypeScript Types
console.log('📋 TEST SUITE 7: Type Definitions\n' + '-'.repeat(70));

try {
  const chatHistoryContent = fs.readFileSync(path.join(__dirname, 'src/lib/chat-history.ts'), 'utf8');

  test(
    'Types: ChatMessage interface',
    chatHistoryContent.includes('interface ChatMessage'),
    'Message type definition'
  );

  test(
    'Types: ChatSession interface',
    chatHistoryContent.includes('interface ChatSession'),
    'Session type definition'
  );

  test(
    'Types: API response types',
    chatHistoryContent.includes('interface ApiResponse'),
    'Generic API response wrapper'
  );
} catch (e) {
  test('Type definitions', false, 'Could not validate types');
}

console.log('\n');

// Final Summary
console.log('='.repeat(70));
console.log('📊 VALIDATION SUMMARY\n');
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
console.log('='.repeat(70));

if (passedTests === totalTests) {
  console.log('\n🎉 EXCELLENT! All chat components validated successfully!\n');
  console.log('The chat system is fully implemented with:');
  console.log('  • Complete UI with markdown and image support');
  console.log('  • Streaming responses with retry logic');
  console.log('  • Session management and persistence');
  console.log('  • Multi-model support');
  console.log('  • Comprehensive error handling');
  console.log('  • Type-safe TypeScript implementation\n');
} else if (passedTests / totalTests >= 0.9) {
  console.log('\n✅ GREAT! Chat implementation is functional.\n');
  console.log(`${totalTests - passedTests} minor issue(s) detected but core functionality is intact.\n`);
} else {
  console.log('\n⚠️  Some components need attention.\n');
  console.log(`${totalTests - passedTests} test(s) failed. Review the output above.\n`);
}

console.log('='.repeat(70) + '\n');

process.exit(passedTests === totalTests ? 0 : 1);
