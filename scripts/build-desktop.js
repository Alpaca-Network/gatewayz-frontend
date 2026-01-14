#!/usr/bin/env node
/**
 * Desktop build script for GatewayZ Tauri app.
 *
 * This script handles the static export build for the desktop app by:
 * 1. Temporarily moving incompatible directories (API routes, dynamic pages)
 * 2. Running Next.js build with static export enabled
 * 3. Restoring all directories
 *
 * API routes use 'force-dynamic' which is incompatible with static export.
 * Dynamic pages without generateStaticParams() also can't be statically exported.
 * Since the desktop app communicates directly with the backend API,
 * these routes are not needed.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'src', 'app');
const BACKUP_BASE = path.join(__dirname, '..', '.desktop-build-backup');

// Directories to exclude from static export
// These contain either API routes with 'force-dynamic' or dynamic pages without generateStaticParams
const DIRS_TO_EXCLUDE = [
  'api',                    // All API routes (use force-dynamic)
  'insights/assets/[id]',   // Dynamic insight assets page
  'models',                 // Models page has force-dynamic + dynamic [name] subpages
  'organizations/[name]',   // Dynamic organization pages
  'sandbox/[sandboxId]',    // Dynamic sandbox pages
  'share/[token]',          // Dynamic share pages
];

function moveExcludedDirs() {
  console.log('📦 Moving directories incompatible with static export...');

  // Clean up any existing backup from previous failed builds (race condition fix)
  if (fs.existsSync(BACKUP_BASE)) {
    console.log('⚠️  Found existing backup directory from previous build, cleaning up first...');
    // First try to restore any existing backups before creating new ones
    restoreExcludedDirs();
  }

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_BASE)) {
    fs.mkdirSync(BACKUP_BASE, { recursive: true });
  }

  for (const dir of DIRS_TO_EXCLUDE) {
    const srcPath = path.join(APP_DIR, dir);
    const backupPath = path.join(BACKUP_BASE, dir);

    if (fs.existsSync(srcPath)) {
      // Create parent directories in backup if needed
      const backupParent = path.dirname(backupPath);
      if (!fs.existsSync(backupParent)) {
        fs.mkdirSync(backupParent, { recursive: true });
      }

      console.log(`  Moving: ${dir}`);
      fs.renameSync(srcPath, backupPath);
    }
  }
}

function restoreExcludedDirs() {
  console.log('📦 Restoring directories...');

  if (!fs.existsSync(BACKUP_BASE)) {
    return;
  }

  for (const dir of DIRS_TO_EXCLUDE) {
    const srcPath = path.join(APP_DIR, dir);
    const backupPath = path.join(BACKUP_BASE, dir);

    if (fs.existsSync(backupPath)) {
      // Remove any partial directory that might have been created
      if (fs.existsSync(srcPath)) {
        fs.rmSync(srcPath, { recursive: true, force: true });
      }

      // Ensure parent directory exists
      const srcParent = path.dirname(srcPath);
      if (!fs.existsSync(srcParent)) {
        fs.mkdirSync(srcParent, { recursive: true });
      }

      console.log(`  Restoring: ${dir}`);
      fs.renameSync(backupPath, srcPath);
    }
  }

  // Clean up backup directory
  if (fs.existsSync(BACKUP_BASE)) {
    fs.rmSync(BACKUP_BASE, { recursive: true, force: true });
  }
}

async function main() {
  console.log('🖥️  Building GatewayZ Desktop App...\n');

  try {
    // Step 1: Move incompatible directories (API routes, dynamic pages)
    moveExcludedDirs();

    // Step 2: Run Next.js build with static export
    // Note: Using env option to set NEXT_STATIC_EXPORT instead of cross-env
    // This avoids needing cross-env as a dependency
    console.log('\n🔨 Running Next.js static export build...\n');
    execSync('npx next build', {
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
    // Always restore directories
    restoreExcludedDirs();
  }
}

// Handle process termination to ensure cleanup
process.on('SIGINT', () => {
  console.log('\n⚠️  Build interrupted, cleaning up...');
  restoreExcludedDirs();
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Build terminated, cleaning up...');
  restoreExcludedDirs();
  process.exit(1);
});

main();
