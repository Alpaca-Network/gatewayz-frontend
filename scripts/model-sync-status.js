#!/usr/bin/env node

/**
 * Model Sync Status Script
 * Check the status of model synchronization
 */

const https = require('https');
const http = require('http');

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

async function getSyncStatus() {
  console.log('Checking model sync status...');
  
  const options = {
    hostname: new URL(API_BASE_URL).hostname,
    port: new URL(API_BASE_URL).port || (new URL(API_BASE_URL).protocol === 'https:' ? 443 : 80),
    path: '/api/sync/status',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
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
          resolve(result);
        } catch (error) {
          console.error('Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Command line interface
getSyncStatus()
  .then((status) => {
    console.log('📊 Model Sync Status:');
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to get sync status:', error);
    process.exit(1);
  });