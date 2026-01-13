#!/usr/bin/env node
/**
 * Desktop build script for GatewayZ Tauri app.
 *
 * This script handles the static export build for the desktop app by:
 * 1. Temporarily moving the /api directory (API routes aren't needed in desktop)
 * 2. Running Next.js build with static export enabled
 * 3. Restoring the /api directory
 *
 * API routes use 'force-dynamic' which is incompatible with static export.
 * Since the desktop app communicates directly with the backend API,
 * these routes are not needed.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'src', 'app', 'api');
const API_BACKUP_DIR = path.join(__dirname, '..', '.api-backup');

function moveApiDir() {
  if (fs.existsSync(API_DIR)) {
    console.log('📦 Moving API directory for static export...');
    fs.renameSync(API_DIR, API_BACKUP_DIR);
  }
}

function restoreApiDir() {
  if (fs.existsSync(API_BACKUP_DIR)) {
    console.log('📦 Restoring API directory...');
    // Remove any partial api dir that might have been created
    if (fs.existsSync(API_DIR)) {
      fs.rmSync(API_DIR, { recursive: true, force: true });
    }
    fs.renameSync(API_BACKUP_DIR, API_DIR);
  }
}

async function main() {
  console.log('🖥️  Building GatewayZ Desktop App...\n');

  try {
    // Step 1: Move API directory (not needed for desktop static export)
    moveApiDir();

    // Step 2: Run Next.js build with static export
    console.log('🔨 Running Next.js static export build...\n');
    execSync('npx cross-env NEXT_STATIC_EXPORT=true next build', {
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_STATIC_EXPORT: 'true',
      },
    });

    console.log('\n✅ Desktop build completed successfully!');
    console.log('📁 Output directory: ./out\n');

  } catch (error) {
    console.error('\n❌ Desktop build failed:', error.message);
    process.exitCode = 1;
  } finally {
    // Always restore API directory
    restoreApiDir();
  }
}

// Handle process termination to ensure cleanup
process.on('SIGINT', () => {
  console.log('\n⚠️  Build interrupted, cleaning up...');
  restoreApiDir();
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Build terminated, cleaning up...');
  restoreApiDir();
  process.exit(1);
});

main();
