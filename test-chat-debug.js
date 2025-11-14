#!/usr/bin/env node

// Test script to debug chat functionality
// This script simulates the chat API calls step by step

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// Mock API key - this would normally be from localStorage after authentication
const TEST_API_KEY = process.env.TEST_API_KEY || 'test-api-key';

async function testChatCompletions() {
    console.log('🧪 Testing Chat Completions API');
    console.log('📍 API Base URL:', API_BASE_URL);
    console.log('🔑 API Key:', TEST_API_KEY.substring(0, 10) + '...');
    
    const url = `${API_BASE_URL}/api/chat/completions`;
    console.log('🔗 Request URL:', url);
    
    const testMessage = 'Hello, testing chat functionality!';
    
    const requestBody = {
        model: 'qwen/qwen3-32b',
        messages: [
            {
                role: 'user',
                content: testMessage
            }
        ],
        stream: false, // Set to false first to test basic functionality
        max_tokens: 100
    };
    
    console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));
    
    try {
        console.log('⏳ Making request...');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Response Status:', response.status);
        console.log('📥 Response Status Text:', response.statusText);
        console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Error Response Body:', errorText);
            
            try {
                const errorJson = JSON.parse(errorText);
                console.log('❌ Error JSON:', JSON.stringify(errorJson, null, 2));
            } catch (error) {
                console.log('❌ Error is not JSON format');
            }
            
            console.log('\n🔍 Error Analysis:');
            if (response.status === 401) {
                console.log('   - Authentication failed - check API key');
            } else if (response.status === 403) {
                console.log('   - Authorization failed - insufficient permissions');
            } else if (response.status === 404) {
                console.log('   - Endpoint not found - check API URL');
            } else if (response.status === 500) {
                console.log('   - Server error - check backend logs');
            } else if (response.status === 400) {
                console.log('   - Bad request - check request parameters');
            }
            
            return false;
        }
        
        const responseData = await response.json();
        console.log('✅ Success! Response:', JSON.stringify(responseData, null, 2));
        
        return true;
        
    } catch (error) {
        console.log('❌ Request failed with error:', error);
        console.log('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return false;
    }
}

async function testChatSessions() {
    console.log('\n🧪 Testing Chat Sessions API');
    console.log('📍 API Base URL:', API_BASE_URL);
    console.log('🔑 API Key:', TEST_API_KEY.substring(0, 10) + '...');
    
    const url = `${API_BASE_URL}/api/chat/sessions`;
    console.log('🔗 Request URL:', url);
    
    try {
        console.log('⏳ Making request...');
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TEST_API_KEY}`
            }
        });
        
        console.log('📥 Response Status:', response.status);
        console.log('📥 Response Status Text:', response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Error Response Body:', errorText);
            return false;
        }
        
        const responseData = await response.json();
        console.log('✅ Success! Sessions:', responseData);
        
        return true;
        
    } catch (error) {
        console.log('❌ Request failed with error:', error);
        return false;
    }
}

async function testStreamingChat() {
    console.log('\n🧪 Testing Streaming Chat (this will simulate the frontend approach)');
    console.log('📍 API Base URL:', API_BASE_URL);
    console.log('🔑 API Key:', TEST_API_KEY.substring(0, 10) + '...');
    
    const url = `${API_BASE_URL}/api/chat/completions`;
    
    const requestBody = {
        model: 'qwen/qwen3-32b',
        messages: [
            {
                role: 'user',
                content: 'Tell me a very short joke!'
            }
        ],
        stream: true,
        max_tokens: 100
    };
    
    console.log('📤 Streaming Request Body:', JSON.stringify(requestBody, null, 2));
    
    try {
        console.log('⏳ Making streaming request...');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_API_KEY}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Response Status:', response.status);
        console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Streaming Error Response Body:', errorText);
            
            console.log('\n🔍 Streaming Error Analysis:');
            if (response.status === 401) {
                console.log('   - Authentication failed during streaming');
            } else if (response.status === 500) {
                console.log('   - Server error during streaming');
            }
            
            return false;
        }
        
        console.log('✅ Streaming response received!');
        console.log('📡 Content-Type:', response.headers.get('content-type'));
        console.log('📡 Has readable body:', !!response.body);
        
        // Read a few chunks to test streaming
        if (response.body && response.headers.get('content-type')?.includes('event-stream')) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            console.log('📖 Reading streaming chunks (first 5):');
            let chunks = 0;
            let totalContent = '';
            
            while (chunks < 5) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('🏁 Stream ended');
                    break;
                }
                
                const chunk = decoder.decode(value);
                console.log(`📝 Chunk ${chunks + 1}:`, chunk.substring(0, 100) + '...');
                totalContent += chunk;
                chunks++;
            }
            
            reader.releaseLock();
            console.log('📊 Total received content length:', totalContent.length);
        } else {
            console.log('⚠️ Response is not event-stream, reading as regular JSON');
            const responseData = await response.json();
            console.log('📦 Non-streaming response:', JSON.stringify(responseData, null, 2));
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Streaming request failed with error:', error);
        console.log('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return false;
    }
}

async function main() {
    console.log('🔍 Gatewayz Chat Debug Script');
    console.log('================================');
    console.log('This script will test various chat API endpoints to identify issues.');
    console.log('');
    
    // Check environment
    console.log('🔧 Environment Check:');
    console.log('   - NODE_ENV:', process.env.NODE_ENV);
    console.log('   - NEXT_PUBLIC_API_BASE_URL:', API_BASE_URL);
    console.log('   - TEST_API_KEY provided:', !!process.env.TEST_API_KEY);
    console.log('');
    
    if (!process.env.TEST_API_KEY) {
        console.log('⚠️  Warning: No TEST_API_KEY provided. Using test-api-key as fallback.');
        console.log('   To test with a real API key, set TEST_API_KEY environment variable.');
        console.log('');
    }
    
    const results = {
        chatCompletions: await testChatCompletions(),
        chatSessions: await testChatSessions(),
        streamingChat: await testStreamingChat()
    };
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log('✅ Chat Completions:', results.chatCompletions ? 'PASSED' : 'FAILED');
    console.log('✅ Chat Sessions:', results.chatSessions ? 'PASSED' : 'FAILED');
    console.log('✅ Streaming Chat:', results.streamingChat ? 'PASSED' : 'FAILED');
    
    const allPassed = Object.values(results).every(result => result);
    console.log('');
    console.log(allPassed ? '🎉 All tests passed!' : '❌ Some tests failed');
    
    if (!allPassed) {
        console.log('\n🔧 Troubleshooting Steps:');
        console.log('1. Check if API key is valid and active');
        console.log('2. Verify API base URL is correct');
        console.log('3. Check backend server logs for errors');
        console.log('4. Ensure authentication is properly configured');
        console.log('5. Verify ChatHistoryAPI service is running');
    }
}

// Run the tests
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testChatCompletions, testChatSessions, testStreamingChat };