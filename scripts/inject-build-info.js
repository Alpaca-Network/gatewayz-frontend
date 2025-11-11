#!/usr/bin/env node
/**
 * Inject Build Information
 *
 * Generates build-time metadata including:
 * - Git commit SHA
 * - Git branch
 * - Build timestamp
 * - Package version
 *
 * This info is used for:
 * - Error tracking and debugging
 * - Source map association
 * - Release correlation
 * - Deployment verification
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitSha() {
  try {
    // Try Vercel env var first (available in Vercel builds)
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      return process.env.VERCEL_GIT_COMMIT_SHA;
    }

    // Try to get from git command
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    return sha;
  } catch (error) {
    console.warn('Warning: Could not determine git SHA, using "unknown"');
    return 'unknown';
  }
}

function getGitShortSha() {
  try {
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      return process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7);
    }
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return sha;
  } catch (error) {
    return 'unknown';
  }
}

function getGitBranch() {
  try {
    // Try Vercel env var first
    if (process.env.VERCEL_GIT_COMMIT_REF) {
      return process.env.VERCEL_GIT_COMMIT_REF;
    }

    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    return branch;
  } catch (error) {
    return 'unknown';
  }
}

function getPackageVersion() {
  try {
    const packageJson = require('../package.json');
    return packageJson.version || '0.0.0';
  } catch (error) {
    return '0.0.0';
  }
}

function getEnvironment() {
  // Vercel provides VERCEL_ENV
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV; // production, preview, or development
  }

  // Check NODE_ENV
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  return 'development';
}

function main() {
  console.log('🔍 Collecting build information...');

  const buildInfo = {
    sha: getGitSha(),
    shortSha: getGitShortSha(),
    branch: getGitBranch(),
    version: getPackageVersion(),
    timestamp: new Date().toISOString(),
    environment: getEnvironment(),
  };

  console.log('📦 Build Information:');
  console.log(`   SHA:         ${buildInfo.sha}`);
  console.log(`   Short SHA:   ${buildInfo.shortSha}`);
  console.log(`   Branch:      ${buildInfo.branch}`);
  console.log(`   Version:     ${buildInfo.version}`);
  console.log(`   Environment: ${buildInfo.environment}`);
  console.log(`   Timestamp:   ${buildInfo.timestamp}`);

  // Generate .env.local with build info (will be loaded by Next.js)
  const envContent = `# Auto-generated build information - DO NOT EDIT
# Generated at: ${buildInfo.timestamp}

NEXT_PUBLIC_RELEASE_SHA=${buildInfo.sha}
NEXT_PUBLIC_RELEASE_SHORT_SHA=${buildInfo.shortSha}
NEXT_PUBLIC_RELEASE_BRANCH=${buildInfo.branch}
NEXT_PUBLIC_RELEASE_VERSION=${buildInfo.version}
NEXT_PUBLIC_RELEASE_TIMESTAMP=${buildInfo.timestamp}
NEXT_PUBLIC_ENVIRONMENT=${buildInfo.environment}
NEXT_PUBLIC_SERVICE_NAME=gatewayz-beta
`;

  const envPath = path.join(__dirname, '..', '.env.local');

  // Preserve existing .env.local vars if they exist
  let existingEnv = '';
  try {
    if (fs.existsSync(envPath)) {
      existingEnv = fs.readFileSync(envPath, 'utf8');
      // Remove old build info section if it exists
      existingEnv = existingEnv.replace(/# Auto-generated build information.*?(?=\n\n|\n[A-Z]|$)/s, '').trim();
    }
  } catch (error) {
    // File doesn't exist or can't be read, that's fine
  }

  // Combine build info with existing vars
  const finalContent = existingEnv
    ? `${envContent}\n\n# User-defined variables\n${existingEnv}\n`
    : envContent;

  fs.writeFileSync(envPath, finalContent);
  console.log('✅ Build information written to .env.local');

  // Also generate a JSON file for reference
  const buildInfoPath = path.join(__dirname, '..', 'public', 'build-info.json');
  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
  console.log('✅ Build information written to public/build-info.json');

  // Generate a TypeScript file for type-safe access
  const tsContent = `// Auto-generated build information - DO NOT EDIT
// Generated at: ${buildInfo.timestamp}

export const buildInfo = {
  sha: '${buildInfo.sha}',
  shortSha: '${buildInfo.shortSha}',
  branch: '${buildInfo.branch}',
  version: '${buildInfo.version}',
  timestamp: '${buildInfo.timestamp}',
  environment: '${buildInfo.environment}',
  serviceName: 'gatewayz-beta',
} as const;

export type BuildInfo = typeof buildInfo;
`;

  const tsPath = path.join(__dirname, '..', 'src', 'lib', 'build-info.ts');
  fs.writeFileSync(tsPath, tsContent);
  console.log('✅ Build information written to src/lib/build-info.ts');

  console.log('🎉 Build information injection complete!');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { getGitSha, getGitShortSha, getGitBranch, getPackageVersion };
