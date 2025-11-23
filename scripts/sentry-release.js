#!/usr/bin/env node

/**
 * Sentry Release Helper Script
 * Generates release information and environment variables for Sentry
 *
 * This script:
 * 1. Determines the release identifier (git commit SHA, env var, or package version)
 * 2. Outputs environment variables for the build process
 * 3. Can be used to create a release in Sentry after build
 *
 * Usage:
 *   node scripts/sentry-release.js          # Print release info
 *   node scripts/sentry-release.js create   # Create release in Sentry
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get release identifier
function getRelease() {
  // 1. Check for explicit SENTRY_RELEASE env var
  if (process.env.SENTRY_RELEASE) {
    return process.env.SENTRY_RELEASE;
  }

  // 2. Check for Vercel deployment git commit SHA
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }

  // 3. Check for custom git commit SHA env var
  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA;
  }

  // 4. Try to get from git
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    // Git not available
  }

  // 5. Fallback to package version
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
    );
    return `${packageJson.name}@${packageJson.version}`;
  } catch (e) {
    console.error('Failed to read package.json:', e.message);
  }

  return undefined;
}

// Get current branch name
function getBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (e) {
    return process.env.VERCEL_GIT_COMMIT_REF || 'unknown';
  }
}

// Get current commit message
function getCommitMessage() {
  try {
    return execSync('git log -1 --pretty=%B').toString().trim();
  } catch (e) {
    return '';
  }
}

// Print release information
function printReleaseInfo() {
  const release = getRelease();
  const branch = getBranch();
  const commitMessage = getCommitMessage();

  console.log('Sentry Release Information:');
  console.log('======================================');
  console.log(`Release ID:    ${release || 'N/A'}`);
  console.log(`Branch:        ${branch}`);
  console.log(`Commit:        ${process.env.VERCEL_GIT_COMMIT_SHA || 'N/A'}`);
  console.log(`Commit Msg:    ${commitMessage || 'N/A'}`);
  console.log('======================================');

  // Print environment variable exports
  console.log('\nEnvironment variables to set:');
  console.log(`export SENTRY_RELEASE="${release || ''}"`);
  console.log(`export NEXT_PUBLIC_SENTRY_RELEASE="${release || ''}"`);
}

// Create a release in Sentry
async function createRelease() {
  const release = getRelease();
  const branch = getBranch();
  const authToken = process.env.SENTRY_AUTH_TOKEN;

  if (!authToken) {
    console.error('Error: SENTRY_AUTH_TOKEN environment variable is not set');
    console.error('Please set your Sentry auth token to create releases');
    process.exit(1);
  }

  if (!release) {
    console.error('Error: Could not determine release identifier');
    process.exit(1);
  }

  const org = process.env.SENTRY_ORG || 'alpaca-network';
  const project = process.env.SENTRY_PROJECT || 'javascript-nextjs';

  console.log(`Creating release: ${release}`);
  console.log(`Organization: ${org}`);
  console.log(`Project: ${project}`);

  try {
    // Create release
    const createResponse = await fetch(
      `https://sentry.io/api/0/organizations/${org}/releases/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: release,
          projects: [project],
          refs: [
            {
              repository: process.env.GITHUB_REPOSITORY || 'unknown',
              commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
              previousCommit: process.env.GITHUB_PREVIOUS_SHA,
            },
          ],
        }),
      }
    );

    if (!createResponse.ok && createResponse.status !== 409) {
      const error = await createResponse.text();
      throw new Error(`Failed to create release: ${createResponse.status} - ${error}`);
    }

    console.log(`✓ Release created: ${release}`);

    // Set release as current/active (optional)
    if (branch === 'main' || branch === 'master' || branch === 'production') {
      console.log('This is a main branch release - marking as active');
    }

    return { success: true, release };
  } catch (error) {
    console.error(`✗ Error creating release: ${error.message}`);
    process.exit(1);
  }
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'create':
    createRelease().catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
    break;
  case 'info':
  case 'print':
  case undefined:
  default:
    printReleaseInfo();
    break;
}
