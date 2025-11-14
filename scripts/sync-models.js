#!/usr/bin/env node

/**
 * Manual Model Sync Script
 * Run this to manually trigger model synchronization
 */

const https = require('https');
const http = require('http');

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

async function triggerSync(gateway = 'all') {
  console.log(`Triggering model sync for: ${gateway}`);
  
  const data = JSON.stringify({ gateway });
  
  const options = {
    hostname: new URL(API_BASE_URL).hostname,
    port: new URL(API_BASE_URL).port || (new URL(API_BASE_URL).protocol === 'https:' ? 443 : 80),
    path: '/api/sync/models',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const protocol = new URL(API_BASE_URL).protocol === 'https:' ? https : http;
  
  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          console.log('Sync result:', result);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Command line interface
const args = process.argv.slice(2);
const gateway = args[0] || 'all';

triggerSync(gateway)
  .then(() => {
    console.log('✅ Model sync completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Model sync failed:', error);
    process.exit(1);
  });