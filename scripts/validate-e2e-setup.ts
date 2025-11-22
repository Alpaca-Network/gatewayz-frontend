#!/usr/bin/env tsx

/**
 * E2E Test Setup Validation Script
 *
 * This script validates that all E2E testing infrastructure is properly configured
 * and ready for running tests with real Privy authentication.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

const results: ValidationResult[] = [];

function check(name: string, condition: boolean, failMessage: string, warnMessage?: string) {
  if (condition) {
    results.push({ name, status: 'pass', message: '✓ OK' });
  } else if (warnMessage && !failMessage) {
    results.push({ name, status: 'warn', message: `⚠ ${warnMessage}` });
  } else {
    results.push({ name, status: 'fail', message: `✗ ${failMessage}` });
  }
}

function fileExists(filePath: string, description: string) {
  const fullPath = path.join(process.cwd(), filePath);
  check(
    description,
    fs.existsSync(fullPath),
    `File not found: ${filePath}`,
    undefined
  );
}

function directoryExists(dirPath: string, description: string) {
  const fullPath = path.join(process.cwd(), dirPath);
  check(
    description,
    fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory(),
    `Directory not found: ${dirPath}`,
    undefined
  );
}

// Main validation checks
console.log('🔍 Validating E2E Testing Setup...\n');

// 1. Check file structure
console.log('📁 Checking file structure...');
fileExists('playwright.config.ts', 'Playwright config file');
fileExists('e2e/fixtures.ts', 'E2E fixtures file');
fileExists('e2e/auth.spec.ts', 'Auth test suite');
fileExists('e2e/auth-privy-real.spec.ts', 'Real Privy auth tests');
directoryExists('e2e', 'E2E directory');
directoryExists('.github/workflows', 'GitHub workflows directory');

// 2. Check workflow files
console.log('\n⚙️  Checking GitHub Actions workflows...');
fileExists('.github/workflows/ci.yml', 'CI workflow');
fileExists('.github/workflows/e2e-privy-auth.yml', 'E2E Privy auth workflow');

// 3. Check environment configuration
console.log('\n🔐 Checking environment configuration...');
fileExists('.env.example', '.env.example file');

const envExampleContent = fs.readFileSync('.env.example', 'utf-8');
check(
  'PRIVY test credentials in .env.example',
  envExampleContent.includes('PRIVY_TEST_EMAIL') && envExampleContent.includes('PRIVY_TEST_OTP'),
  'PRIVY_TEST_EMAIL or PRIVY_TEST_OTP not found in .env.example',
  undefined
);

// 4. Check Playwright installation
console.log('\n🎭 Checking Playwright installation...');
try {
  const version = execSync('npx playwright --version').toString().trim();
  check(
    'Playwright CLI installed',
    version.includes('Version'),
    'Playwright CLI not found',
    undefined
  );
} catch (e) {
  check('Playwright CLI installed', false, 'Failed to execute playwright --version', undefined);
}

// 5. Check package.json scripts
console.log('\n📝 Checking npm scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const scripts = packageJson.scripts || {};

check('pnpm test:e2e script', 'test:e2e' in scripts, 'test:e2e script not found', undefined);
check('pnpm test:e2e:ui script', 'test:e2e:ui' in scripts, 'test:e2e:ui script not found', undefined);
check('pnpm test:e2e:debug script', 'test:e2e:debug' in scripts, 'test:e2e:debug script not found', undefined);

// 6. Check playwright.config.ts content
console.log('\n🔧 Checking Playwright configuration...');
const configContent = fs.readFileSync('playwright.config.ts', 'utf-8');

check(
  'Playwright configured for chromium',
  configContent.includes('chromium'),
  'Chromium project not configured',
  undefined
);

check(
  'E2E tests directory configured',
  configContent.includes('testDir: \'./e2e\''),
  'testDir not set to ./e2e',
  undefined
);

check(
  'Test timeout configured',
  configContent.includes('timeout:') || configContent.includes('timeout ='),
  'Timeout not configured',
  undefined
);

// 7. Check fixtures content
console.log('\n🔗 Checking E2E fixtures...');
const fixturesContent = fs.readFileSync('e2e/fixtures.ts', 'utf-8');

check(
  'authenticatedPage fixture exists',
  fixturesContent.includes('authenticatedPage'),
  'authenticatedPage fixture not found',
  undefined
);

check(
  'realAuthPage fixture exists',
  fixturesContent.includes('realAuthPage'),
  'realAuthPage fixture not found',
  undefined
);

check(
  'Privy test email in fixtures',
  fixturesContent.includes('test-1049@privy.io') || fixturesContent.includes('PRIVY_TEST_EMAIL'),
  'Privy test email not configured in fixtures',
  undefined
);

// 8. Check test file structure
console.log('\n🧪 Checking test files...');
const authPrivyContent = fs.readFileSync('e2e/auth-privy-real.spec.ts', 'utf-8');

check(
  'Real Privy auth test suite exists',
  authPrivyContent.includes('Real Privy Authentication'),
  'Real Privy Authentication test suite not found',
  undefined
);

check(
  'Uses realAuthPage fixture',
  authPrivyContent.includes('realAuthPage'),
  'realAuthPage fixture not used in tests',
  undefined
);

// 9. Check documentation
console.log('\n📚 Checking documentation...');
fileExists('E2E_TESTING.md', 'E2E Testing documentation');

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

const passCount = results.filter(r => r.status === 'pass').length;
const warnCount = results.filter(r => r.status === 'warn').length;
const failCount = results.filter(r => r.status === 'fail').length;

results.forEach(result => {
  const icon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
  const color = result.status === 'pass' ? '\x1b[32m' : result.status === 'warn' ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`${color}${icon}${reset} ${result.name.padEnd(40)} ${result.message}`);
});

console.log('='.repeat(60));
console.log(`\n✓ Passed: ${passCount} | ⚠ Warnings: ${warnCount} | ✗ Failed: ${failCount}\n`);

if (failCount > 0) {
  console.log('❌ E2E setup validation FAILED. Please fix the issues above.\n');
  process.exit(1);
}

if (warnCount > 0) {
  console.log('⚠️  E2E setup validation completed with warnings.\n');
  process.exit(0);
}

console.log('✅ E2E setup validation PASSED! Ready to run tests.\n');
console.log('Next steps:');
console.log('1. Run local tests: pnpm test:e2e');
console.log('2. Run with UI: pnpm test:e2e:ui');
console.log('3. Run specific suite: pnpm test:e2e -g "Real Privy"');
console.log('4. See E2E_TESTING.md for full documentation\n');

process.exit(0);
