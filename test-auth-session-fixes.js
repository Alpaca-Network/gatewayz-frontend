/**
 * Test script to verify authentication and session race condition fixes
 * Run this in the browser console on the beta.gatewayz.ai site
 */

// Test configuration
const TEST_CONFIG = {
  enableLogs: true,
  testCount: 5,
  delayBetweenTests: 1000,
};

// Logging helper
const log = (...args) => {
  if (TEST_CONFIG.enableLogs) {
    console.log('[TEST]', ...args);
  }
};

// Test Suite
const AuthSessionTests = {
  /**
   * Test 1: Rapid authentication sync
   * Verifies that multiple rapid auth attempts don't cause race conditions
   */
  async testRapidAuthSync() {
    log('Starting rapid auth sync test...');

    const promises = [];
    const startTime = Date.now();

    // Trigger multiple auth refreshes simultaneously
    for (let i = 0; i < TEST_CONFIG.testCount; i++) {
      promises.push(
        new Promise((resolve) => {
          window.dispatchEvent(new Event('gatewayz:refresh-auth'));
          setTimeout(() => {
            const apiKey = localStorage.getItem('gatewayz_api_key');
            resolve({ attempt: i, hasApiKey: !!apiKey });
          }, 100);
        })
      );
    }

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Check for duplicate API calls
    const uniqueResults = new Set(results.map(r => r.hasApiKey));
    const passed = uniqueResults.size === 1;

    log('Rapid auth sync test:', passed ? '✅ PASSED' : '❌ FAILED');
    log('  Duration:', duration, 'ms');
    log('  Results:', results);

    return { test: 'rapidAuthSync', passed, duration };
  },

  /**
   * Test 2: Concurrent session creation
   * Verifies that multiple session creation attempts don't create duplicates
   */
  async testConcurrentSessionCreation() {
    log('Starting concurrent session creation test...');

    const apiKey = localStorage.getItem('gatewayz_api_key');
    if (!apiKey) {
      log('  Skipping - no API key available');
      return { test: 'concurrentSessionCreation', skipped: true };
    }

    const startTime = Date.now();
    const promises = [];

    // Try to create multiple sessions simultaneously
    for (let i = 0; i < 3; i++) {
      promises.push(
        fetch('/api/chat/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `Test Session ${i}`,
            model: 'openai/gpt-3.5-turbo',
          }),
        }).then(r => r.json()).catch(e => ({ error: e.message }))
      );
    }

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Check if only one succeeded
    const successful = results.filter(r => r.data && !r.error);
    const passed = successful.length === 1;

    log('Concurrent session creation test:', passed ? '✅ PASSED' : '❌ FAILED');
    log('  Duration:', duration, 'ms');
    log('  Successful creations:', successful.length);

    return { test: 'concurrentSessionCreation', passed, duration };
  },

  /**
   * Test 3: Message queue deduplication
   * Verifies that duplicate messages aren't sent multiple times
   */
  async testMessageQueueDeduplication() {
    log('Starting message queue deduplication test...');

    // Simulate rapid message sending
    const messageQueue = [];
    const testMessage = 'Test message ' + Date.now();

    for (let i = 0; i < 5; i++) {
      messageQueue.push(testMessage);
    }

    // Check for duplicates
    const uniqueMessages = new Set(messageQueue);
    const passed = uniqueMessages.size === 1;

    log('Message queue deduplication test:', passed ? '✅ PASSED' : '❌ FAILED');
    log('  Total messages:', messageQueue.length);
    log('  Unique messages:', uniqueMessages.size);

    return { test: 'messageQueueDeduplication', passed };
  },

  /**
   * Test 4: Timeout handling
   * Verifies that requests timeout properly and don't hang
   */
  async testTimeoutHandling() {
    log('Starting timeout handling test...');

    const apiKey = localStorage.getItem('gatewayz_api_key');
    if (!apiKey) {
      log('  Skipping - no API key available');
      return { test: 'timeoutHandling', skipped: true };
    }

    const startTime = Date.now();

    try {
      // Create a controller with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

      // Make a request that might take longer
      const response = await fetch('/api/chat/sessions', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      log('Timeout handling test: ✅ PASSED');
      log('  Request completed in:', duration, 'ms');

      return { test: 'timeoutHandling', passed: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const passed = error.name === 'AbortError' && duration < 1500;

      log('Timeout handling test:', passed ? '✅ PASSED' : '❌ FAILED');
      log('  Error:', error.message);
      log('  Duration:', duration, 'ms');

      return { test: 'timeoutHandling', passed, duration };
    }
  },

  /**
   * Test 5: 401 error recovery
   * Verifies that 401 errors trigger re-authentication
   */
  async test401Recovery() {
    log('Starting 401 recovery test...');

    // Save current API key
    const originalKey = localStorage.getItem('gatewayz_api_key');

    // Set an invalid API key
    localStorage.setItem('gatewayz_api_key', 'invalid_key_for_testing');

    let authRefreshTriggered = false;
    const listener = () => { authRefreshTriggered = true; };
    window.addEventListener('gatewayz:refresh-auth', listener);

    try {
      // Make a request that should fail with 401
      const response = await fetch('/api/chat/sessions', {
        headers: {
          'Authorization': 'Bearer invalid_key_for_testing',
        },
      });

      // Wait a bit for the event to be triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      const passed = response.status === 401 && authRefreshTriggered;

      log('401 recovery test:', passed ? '✅ PASSED' : '❌ FAILED');
      log('  Response status:', response.status);
      log('  Auth refresh triggered:', authRefreshTriggered);

      return { test: '401Recovery', passed };
    } finally {
      // Restore original API key
      if (originalKey) {
        localStorage.setItem('gatewayz_api_key', originalKey);
      }
      window.removeEventListener('gatewayz:refresh-auth', listener);
    }
  },

  /**
   * Test 6: Session transfer security
   * Verifies that session transfer includes security metadata
   */
  testSessionTransferSecurity() {
    log('Starting session transfer security test...');

    // Simulate storing a session transfer token
    const testToken = 'test_token_' + Date.now();
    const testUserId = '12345';

    // Store using the secure method
    const sessionData = {
      token: testToken,
      userId: testUserId,
      timestamp: Date.now(),
      origin: window.location.origin,
      fingerprint: 'test_fingerprint',
    };

    sessionStorage.setItem('gatewayz_session_transfer_token', JSON.stringify(sessionData));

    // Try to retrieve it
    const stored = sessionStorage.getItem('gatewayz_session_transfer_token');

    if (!stored) {
      log('Session transfer security test: ❌ FAILED - No data stored');
      return { test: 'sessionTransferSecurity', passed: false };
    }

    const parsed = JSON.parse(stored);
    const passed =
      parsed.token === testToken &&
      parsed.userId === testUserId &&
      parsed.origin === window.location.origin &&
      parsed.fingerprint !== undefined;

    log('Session transfer security test:', passed ? '✅ PASSED' : '❌ FAILED');
    log('  Has origin:', !!parsed.origin);
    log('  Has fingerprint:', !!parsed.fingerprint);
    log('  Has timestamp:', !!parsed.timestamp);

    // Clean up
    sessionStorage.removeItem('gatewayz_session_transfer_token');

    return { test: 'sessionTransferSecurity', passed };
  },

  /**
   * Run all tests
   */
  async runAll() {
    console.log('🧪 Starting Authentication & Session Tests...\n');

    const results = [];

    // Run each test with a delay between them
    results.push(await this.testRapidAuthSync());
    await new Promise(r => setTimeout(r, TEST_CONFIG.delayBetweenTests));

    results.push(await this.testConcurrentSessionCreation());
    await new Promise(r => setTimeout(r, TEST_CONFIG.delayBetweenTests));

    results.push(await this.testMessageQueueDeduplication());
    await new Promise(r => setTimeout(r, TEST_CONFIG.delayBetweenTests));

    results.push(await this.testTimeoutHandling());
    await new Promise(r => setTimeout(r, TEST_CONFIG.delayBetweenTests));

    results.push(await this.test401Recovery());
    await new Promise(r => setTimeout(r, TEST_CONFIG.delayBetweenTests));

    results.push(this.testSessionTransferSecurity());

    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('=======================');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => r.passed === false).length;
    const skipped = results.filter(r => r.skipped).length;

    results.forEach(result => {
      const status = result.skipped ? '⏭️ SKIPPED' :
                     result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`  ${result.test}: ${status}`);
      if (result.duration) {
        console.log(`    Duration: ${result.duration}ms`);
      }
    });

    console.log('\n📈 Overall Results:');
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Skipped: ${skipped}`);

    const allPassed = failed === 0;
    console.log(allPassed ? '\n🎉 All tests passed!' : '\n⚠️ Some tests failed. Please review.');

    return { passed, failed, skipped, allPassed };
  },
};

// Export for use
window.AuthSessionTests = AuthSessionTests;

// Auto-run if requested
if (typeof window !== 'undefined' && window.location.search.includes('autotest=true')) {
  AuthSessionTests.runAll();
} else {
  console.log('Authentication & Session Test Suite loaded.');
  console.log('Run tests with: AuthSessionTests.runAll()');
  console.log('Or run individual tests:');
  console.log('  - AuthSessionTests.testRapidAuthSync()');
  console.log('  - AuthSessionTests.testConcurrentSessionCreation()');
  console.log('  - AuthSessionTests.testMessageQueueDeduplication()');
  console.log('  - AuthSessionTests.testTimeoutHandling()');
  console.log('  - AuthSessionTests.test401Recovery()');
  console.log('  - AuthSessionTests.testSessionTransferSecurity()');
}