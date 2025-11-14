#!/usr/bin/env node

// Test script to debug chat functionality using LOCAL Next.js API routes
// This script tests the actual Next.js API endpoints

const LOCAL_API_URL = 'http://localhost:3000';

// Mock API key - this would normally be from localStorage after authentication
const TEST_API_KEY = process.env.TEST_API_KEY || 'test-api-key-fallback';

async function testLocalChatCompletions() {
    console.log('🧪 Testing LOCAL Chat Completions API');
    console.log('📍 Local API URL:', LOCAL_API_URL);
    console.log('🔗 Local API Route: /api/chat/completions');
    console.log('🔑 API Key:', TEST_API_KEY.substring(0, 10) + '...');
    
    const url = `${LOCAL_API_URL}/api/chat/completions`;
    console.log('🌐 Full Request URL:', url);
    
    const testMessage = 'Hello, testing chat functionality!';
    
    const requestBody = {
        model: 'qwen/qwen3-32b',  // This will be normalized by the backend
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
        console.log('⏳ Making request to LOCAL API...');
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
                console.log('   - LOCAL endpoint not found - check Next.js config');
            } else if (response.status === 500) {
                console.log('   - Server error - check Next.js server logs above');
            } else if (response.status === 400) {
                console.log('   - Bad request - check request parameters');
            } else if (response.status === 504) {
                console.log('   - Gateway timeout - backend unreachable');
            }
            
            console.log('\n💡 Next Steps:');
            console.log('1. Check above Next.js server logs for detailed errors');
            console.log('2. Verify the Next.js dev server is running on port 3000');
            console.log('3. Check if API_BASE_URL environment variable is set correctly');
            
            return false;
        }
        
        const responseData = await response.json();
        console.log('✅ Success! Local API Response:', JSON.stringify(responseData, null, 2));
        
        return true;
        
    } catch (error) {
        console.log('❌ Request failed with error:', error);
        console.log('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n🔍 Connection refused - is Next.js dev server running on port 3000?');
            console.log('💡 Run "pnpm dev" in another terminal and try again.');
        } else if (error.code === 'ENOTFOUND') {
            console.log('\n🔍 Localhost not found - check network configuration');
        }
        
        return false;
    }
}

async function testBackendConnection() {
    console.log('\n🧪 Testing Backend Connection');
    console.log('📍 Backend URL:', process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai');
    
    try {
        // Just test basic connectivity
        const backendUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai') + '/health';
        console.log('🔗 Testing backend health at:', backendUrl);
        
        const response = await fetch(backendUrl, {
            method: 'GET',
            timeout: 5000 // 5 second timeout
        });
        
        console.log('📥 Backend health check response:', response.status);
        if (response.ok) {
            const healthData = await response.json();
            console.log('✅ Backend is reachable! Health:', healthData);
            return true;
        } else {
            console.log('⚠️  Backend reachable but health check failed:', response.status);
            return false;
        }
        
    } catch (error) {
        console.log('❌ Backend connection failed:', error.message);
        console.log('This likely means the ChatHistoryAPI service is unreachable.');
        return false;
    }
}

async function main() {
    console.log('🔍 Gatewayz Local Chat Debug Script');
    console.log('====================================');
    console.log('This script tests the LOCAL Next.js API endpoints that the frontend uses.');
    console.log('The issue is likely that frontend API calls are failing locally.');
    console.log('');
    
    // Check environment
    console.log('🔧 Environment Check:');
    console.log('   - NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai');
    console.log('   - LOCAL_API_URL:', LOCAL_API_URL);
    console.log('   - TEST_API_KEY:', TEST_API_KEY.substring(0, 10) + '...');
    console.log('');
    
    console.log('📋 Chat Flow Analysis:');
    console.log('1. User types message in frontend');
    console.log('2. Frontend calls /api/chat/completions (LOCAL Next.js API)');
    console.log('3. Next.js API forwards request to backend at api.gatewayz.ai');
    console.log('4. Backend processes chat and returns response');
    console.log('5. Next.js API returns response to frontend');
    console.log('6. Frontend displays the streaming response');
    console.log('');
    
    console.log('🔍 This script tests step 2 - LOCAL API endpoints');
    console.log('');
    
    // Test backend connectivity first
    const backendReachable = await testBackendConnection();
    
    // Test local API
    const localApiWorking = await testLocalChatCompletions();
    
    console.log('\n📊 Test Results Summary:');
    console.log('==========================');
    console.log('Backend Reachable:', backendReachable ? '✅ YES' : '❌ NO');
    console.log('Local API Working:', localApiWorking ? '✅ YES' : '❌ NO');
    
    if (!localApiWorking) {
        console.log('\n🔧 Common Issues & Solutions:');
        console.log('❌ Local API not working -> Check Next.js logs above for errors');
        console.log('❌ Backend unreachable -> ChatHistoryAPI service may be down');
        console.log('❌ Authentication issues -> Check API key validation in middleware');
        console.log('');
        console.log('💡 Debugging Steps:');
        console.log('1. Keep Next.js dev server running');
        console.log('2. Check Next.js terminal logs for detailed errors');
        console.log('3. Verify backend health by visiting:', process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai', '/health');
        console.log('4. Test authentication flow separately');
    }
    
    if (backendReachable && !localApiWorking) {
        console.log('\n🎯 Likely Issue: Local Next.js API is failing to proxy to backend');
        console.log('Check the local API route implementation in /src/app/api/chat/completions/route.ts');
        console.log('The issue is probably in the proxyFetch call to the backend.');
    }
    
    if (!backendReachable) {
        console.log('\n🎯 Primary Issue: Backend service is unreachable');
        console.log('The ChatHistoryAPI service at api.gatewayz.ai is not responding.');
        console.log('This explains why chat isn\'t working - the backend is down!');
    }
}

// Run the tests
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testLocalChatCompletions, testBackendConnection };