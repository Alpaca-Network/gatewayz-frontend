#!/usr/bin/env tsx
/**
 * Build Health Monitor
 *
 * Autonomous build health system that:
 * 1. Runs typecheck and captures all warnings/errors
 * 2. Analyzes dependency version conflicts (package.json vs lockfile)
 * 3. Checks for known breaking changes in major dependencies
 * 4. Audits for security vulnerabilities
 * 5. Detects deprecated packages
 * 6. Produces a detailed report with fix recommendations
 *
 * Usage:
 *   pnpm build:health            # Full health check
 *   pnpm build:health --json     # JSON output
 *   pnpm build:health --fix      # Show actionable fix commands
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

interface HealthIssue {
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  category: 'security' | 'deprecated' | 'breaking-change' | 'build-error' | 'version-drift' | 'config';
  package?: string;
  title: string;
  detail: string;
  fix?: string;
}

interface HealthReport {
  timestamp: string;
  projectName: string;
  projectVersion: string;
  nodeVersion: string;
  pnpmVersion: string;
  typecheckPassed: boolean;
  typecheckOutput: string;
  issues: HealthIssue[];
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
    total: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');

function run(cmd: string, opts?: { ignoreError?: boolean }): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err: any) {
    if (opts?.ignoreError) {
      return (err.stdout || '') + '\n' + (err.stderr || '');
    }
    throw err;
  }
}

function readPkg(): Record<string, any> {
  return JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
}

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgGreen: '\x1b[42m',
};

function severityColor(sev: string): string {
  switch (sev) {
    case 'critical': return C.bgRed + C.white;
    case 'high': return C.red;
    case 'moderate': return C.yellow;
    case 'low': return C.blue;
    default: return C.dim;
  }
}

function severityIcon(sev: string): string {
  switch (sev) {
    case 'critical': return '!!!';
    case 'high': return '!!';
    case 'moderate': return '!';
    case 'low': return '-';
    default: return '.';
  }
}

// ── Checks ───────────────────────────────────────────────────────────────────

function checkTypecheck(): { passed: boolean; output: string; issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  let output: string;
  let passed: boolean;

  try {
    output = run('pnpm typecheck 2>&1');
    passed = true;
  } catch (err: any) {
    output = (err.stdout || '') + '\n' + (err.stderr || '');
    passed = false;

    // Parse TS errors
    const errorLines = output.split('\n').filter(l => /error TS\d+/.test(l));
    for (const line of errorLines.slice(0, 20)) {
      issues.push({
        severity: 'high',
        category: 'build-error',
        title: 'TypeScript compilation error',
        detail: line.trim(),
        fix: 'Run `pnpm typecheck` and fix the reported errors',
      });
    }

    if (errorLines.length === 0) {
      issues.push({
        severity: 'high',
        category: 'build-error',
        title: 'TypeScript typecheck failed',
        detail: output.trim().slice(0, 500),
        fix: 'Run `pnpm typecheck` to see full output',
      });
    }
  }

  return { passed, output: output.trim(), issues };
}

function checkSecurityAudit(): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const output = run('pnpm audit 2>&1', { ignoreError: true });

  // Parse audit output for vulnerability blocks
  const vulnRegex = /^│\s*(critical|high|moderate|low)\s*│\s*(.+?)\s*│$/gm;
  const pkgRegex = /^│\s*Package\s*│\s*(.+?)\s*│$/gm;
  const patchRegex = /^│\s*Patched versions\s*│\s*(.+?)\s*│$/gm;

  const lines = output.split('\n');
  let currentSeverity: HealthIssue['severity'] | null = null;
  let currentTitle = '';
  let currentPkg = '';
  let currentPatch = '';
  let currentVulnVersions = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const sevMatch = line.match(/│\s*(critical|high|moderate|low)\s*│\s*(.+?)\s*│/);
    if (sevMatch) {
      // Flush previous
      if (currentSeverity && currentPkg) {
        issues.push({
          severity: currentSeverity,
          category: 'security',
          package: currentPkg,
          title: `Security: ${currentTitle.trim()}`,
          detail: `Vulnerable: ${currentVulnVersions.trim()}, Patched: ${currentPatch.trim()}`,
          fix: currentPatch.trim() !== 'No fix available'
            ? `pnpm update ${currentPkg}`
            : `No patch available yet. Consider replacing ${currentPkg} or adding to pnpm.overrides.`,
        });
      }
      currentSeverity = sevMatch[1] as HealthIssue['severity'];
      currentTitle = sevMatch[2];
      currentPkg = '';
      currentPatch = '';
      currentVulnVersions = '';
      continue;
    }

    const pkgMatch = line.match(/│\s*Package\s*│\s*(.+?)\s*│/);
    if (pkgMatch) { currentPkg = pkgMatch[1].trim(); continue; }

    const vulnMatch = line.match(/│\s*Vulnerable versions\s*│\s*(.+?)\s*│/);
    if (vulnMatch) { currentVulnVersions = vulnMatch[1].trim(); continue; }

    const patchMatch = line.match(/│\s*Patched versions\s*│\s*(.+?)\s*│/);
    if (patchMatch) { currentPatch = patchMatch[1].trim(); continue; }
  }

  // Flush last
  if (currentSeverity && currentPkg) {
    issues.push({
      severity: currentSeverity,
      category: 'security',
      package: currentPkg,
      title: `Security: ${currentTitle.trim()}`,
      detail: `Vulnerable: ${currentVulnVersions.trim()}, Patched: ${currentPatch.trim()}`,
      fix: currentPatch.trim() !== 'No fix available'
        ? `pnpm update ${currentPkg}`
        : `No patch available yet. Consider replacing ${currentPkg} or adding to pnpm.overrides.`,
    });
  }

  return issues;
}

function checkDeprecated(): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const output = run('pnpm outdated 2>&1', { ignoreError: true });

  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('Deprecated')) {
      const match = line.match(/│\s*(.+?)\s*(?:\(dev\))?\s*│/);
      if (match) {
        const pkgName = match[1].trim().replace(/\s*\(dev\)/, '');
        const isDev = line.includes('(dev)');
        issues.push({
          severity: 'moderate',
          category: 'deprecated',
          package: pkgName,
          title: `Deprecated package: ${pkgName}`,
          detail: `${pkgName} is deprecated${isDev ? ' (devDependency)' : ''}. It may stop receiving updates.`,
          fix: getDeprecatedFix(pkgName),
        });
      }
    }
  }

  return issues;
}

function getDeprecatedFix(pkg: string): string {
  const fixes: Record<string, string> = {
    '@cypress/react18': 'Cypress 13+ has built-in component testing. Remove @cypress/react18 and use `cypress/react` import instead.',
    '@types/cypress': 'Cypress ships its own types since v10. Remove @types/cypress from devDependencies.',
    '@types/ioredis': 'ioredis ships its own types since v5. Remove @types/ioredis from devDependencies.',
  };
  return fixes[pkg] || `Check the package registry for a replacement: npm info ${pkg}`;
}

function checkMajorVersionDrift(): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkg = readPkg();
  const output = run('pnpm outdated 2>&1', { ignoreError: true });

  // Known major version jumps worth flagging
  const majorUpgrades: Record<string, { current: string; latest: string; note: string }> = {};

  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(/│\s*(.+?)\s*│\s*(\S+)\s*│\s*(\S+)\s*│/);
    if (!match) continue;
    const [, name, current, latest] = match;
    const cleanName = name.trim().replace(/\s*\(dev\)/, '');

    // Detect major version jumps
    const curMajor = parseInt(current, 10);
    const latMajor = parseInt(latest, 10);
    if (!isNaN(curMajor) && !isNaN(latMajor) && latMajor > curMajor) {
      majorUpgrades[cleanName] = { current, latest, note: '' };
    }
  }

  // Annotate known breaking changes
  const breakingNotes: Record<string, string> = {
    'ai': 'AI SDK v6 has breaking API changes. Review migration guide before upgrading.',
    '@ai-sdk/anthropic': 'AI SDK providers v3 require ai@6. Upgrade together.',
    '@ai-sdk/google': 'AI SDK providers v3 require ai@6. Upgrade together.',
    '@ai-sdk/openai': 'AI SDK providers v3 require ai@6. Upgrade together.',
    '@ai-sdk/react': 'AI SDK react v3 requires ai@6. Upgrade together.',
    '@faker-js/faker': 'Faker v9/v10 dropped CommonJS support. Ensure your test setup supports ESM.',
    '@hookform/resolvers': 'v5 requires react-hook-form v7.54+. Check compatibility.',
    '@privy-io/wagmi': 'v4 has breaking changes to wallet connector APIs.',
    'date-fns': 'v4 is ESM-only. Ensure all imports use named exports.',
    'dotenv': 'v17 drops Node.js < 18 support.',
    '@types/node': 'Major @types/node upgrade may introduce type incompatibilities.',
    '@types/react': 'React 19 types are incompatible with React 18 runtime. Do NOT upgrade @types/react to v19 while using React 18.',
    '@types/react-dom': 'React DOM 19 types are incompatible with React 18 runtime. Do NOT upgrade while using React 18.',
  };

  for (const [name, info] of Object.entries(majorUpgrades)) {
    const note = breakingNotes[name] || '';
    issues.push({
      severity: note.includes('Do NOT') ? 'high' : 'low',
      category: 'version-drift',
      package: name,
      title: `Major version available: ${name} ${info.current} -> ${info.latest}`,
      detail: note || `A new major version is available. Review changelog before upgrading.`,
      fix: note.includes('Do NOT') ? 'Do not upgrade until React 18 -> 19 migration is planned.' : `pnpm update ${name}`,
    });
  }

  return issues;
}

function checkSentryDeprecations(): HealthIssue[] {
  const issues: HealthIssue[] = [];

  // Check next.config.ts for deprecated Sentry options
  const nextConfigPath = path.join(ROOT, 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const content = fs.readFileSync(nextConfigPath, 'utf-8');

    if (content.includes('disableLogger: true')) {
      issues.push({
        severity: 'moderate',
        category: 'deprecated',
        package: '@sentry/nextjs',
        title: 'Sentry: disableLogger is deprecated',
        detail: 'The `disableLogger` option is deprecated in @sentry/nextjs 10.x and will be removed in a future version.',
        fix: 'Replace `disableLogger: true` with `webpack: { treeshake: { removeDebugLogging: true } }` in your Sentry config.',
      });
    }

    if (content.includes('automaticVercelMonitors: true')) {
      issues.push({
        severity: 'moderate',
        category: 'deprecated',
        package: '@sentry/nextjs',
        title: 'Sentry: automaticVercelMonitors is deprecated',
        detail: 'The `automaticVercelMonitors` option is deprecated in @sentry/nextjs 10.x.',
        fix: 'Replace `automaticVercelMonitors: true` with `webpack: { automaticVercelMonitors: true }` in your Sentry config.',
      });
    }
  }

  return issues;
}

function checkNextjsSecurity(): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkg = readPkg();
  const nextVersion = pkg.dependencies?.next;

  if (nextVersion === '15.3.8') {
    issues.push({
      severity: 'high',
      category: 'security',
      package: 'next',
      title: 'Next.js 15.3.8 has known security vulnerabilities',
      detail: 'CVE: HTTP request deserialization DoS (GHSA-h25m-26qc-wcjf), Image Optimization cache key confusion (GHSA-g5qg-72qw-gw5v), Image Optimization content injection (GHSA-xv57-4mr9-wg8v).',
      fix: 'Update to Next.js >= 15.4.5: Edit package.json to set "next": "15.4.5" and run `pnpm install`.',
    });
  }

  return issues;
}

function checkConfigIssues(): HealthIssue[] {
  const issues: HealthIssue[] = [];

  // Check for ignoreBuildErrors
  const nextConfigPath = path.join(ROOT, 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const content = fs.readFileSync(nextConfigPath, 'utf-8');

    if (content.includes('ignoreBuildErrors: true')) {
      issues.push({
        severity: 'info',
        category: 'config',
        title: 'TypeScript errors ignored during build',
        detail: 'next.config.ts has `typescript: { ignoreBuildErrors: true }`. TypeScript errors will not fail the production build.',
        fix: 'Consider setting `ignoreBuildErrors: false` to catch type errors at build time.',
      });
    }

    if (content.includes('ignoreDuringBuilds: true')) {
      issues.push({
        severity: 'info',
        category: 'config',
        title: 'ESLint errors ignored during build',
        detail: 'next.config.ts has `eslint: { ignoreDuringBuilds: true }`. Lint errors will not fail the production build.',
        fix: 'Consider setting `ignoreDuringBuilds: false` to catch lint errors at build time.',
      });
    }
  }

  return issues;
}

// ── Report Generation ────────────────────────────────────────────────────────

function generateReport(): HealthReport {
  const pkg = readPkg();

  let nodeVersion = 'unknown';
  let pnpmVersion = 'unknown';
  try { nodeVersion = run('node --version').trim(); } catch {}
  try { pnpmVersion = run('pnpm --version').trim(); } catch {}

  console.log(`${C.cyan}${C.bold}Build Health Monitor${C.reset}`);
  console.log(`${C.dim}Scanning ${pkg.name}@${pkg.version}...${C.reset}\n`);

  // Run all checks
  console.log(`${C.dim}  [1/6] TypeScript typecheck...${C.reset}`);
  const tc = checkTypecheck();

  console.log(`${C.dim}  [2/6] Security audit...${C.reset}`);
  const secIssues = checkSecurityAudit();

  console.log(`${C.dim}  [3/6] Deprecated packages...${C.reset}`);
  const depIssues = checkDeprecated();

  console.log(`${C.dim}  [4/6] Major version drift...${C.reset}`);
  const driftIssues = checkMajorVersionDrift();

  console.log(`${C.dim}  [5/6] Sentry config...${C.reset}`);
  const sentryIssues = checkSentryDeprecations();
  const nextjsIssues = checkNextjsSecurity();

  console.log(`${C.dim}  [6/6] Build config...${C.reset}`);
  const configIssues = checkConfigIssues();

  const allIssues = [
    ...tc.issues,
    ...secIssues,
    ...nextjsIssues,
    ...sentryIssues,
    ...depIssues,
    ...driftIssues,
    ...configIssues,
  ];

  const summary = {
    critical: allIssues.filter(i => i.severity === 'critical').length,
    high: allIssues.filter(i => i.severity === 'high').length,
    moderate: allIssues.filter(i => i.severity === 'moderate').length,
    low: allIssues.filter(i => i.severity === 'low').length,
    info: allIssues.filter(i => i.severity === 'info').length,
    total: allIssues.length,
  };

  return {
    timestamp: new Date().toISOString(),
    projectName: pkg.name,
    projectVersion: pkg.version,
    nodeVersion,
    pnpmVersion,
    typecheckPassed: tc.passed,
    typecheckOutput: tc.output,
    issues: allIssues,
    summary,
  };
}

function printReport(report: HealthReport, showFixes: boolean): void {
  console.log('');

  // Summary bar
  const { summary } = report;
  const statusColor = summary.critical > 0 || summary.high > 0 ? C.red : summary.moderate > 0 ? C.yellow : C.green;
  const statusLabel = summary.critical > 0 || summary.high > 0 ? 'NEEDS ATTENTION' : summary.moderate > 0 ? 'MINOR ISSUES' : 'HEALTHY';

  console.log(`${C.bold}${statusColor}  ${statusLabel}${C.reset}`);
  console.log(`${C.dim}  ${report.timestamp}${C.reset}`);
  console.log('');

  // Typecheck status
  const tcIcon = report.typecheckPassed ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`;
  console.log(`  Typecheck: ${tcIcon}`);
  console.log(`  Issues:    ${C.red}${summary.critical} critical${C.reset}  ${C.red}${summary.high} high${C.reset}  ${C.yellow}${summary.moderate} moderate${C.reset}  ${C.blue}${summary.low} low${C.reset}  ${C.dim}${summary.info} info${C.reset}`);
  console.log('');

  // Group by category
  const categories: Record<string, HealthIssue[]> = {};
  for (const issue of report.issues) {
    const cat = issue.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(issue);
  }

  const categoryOrder = ['build-error', 'security', 'deprecated', 'breaking-change', 'version-drift', 'config'];
  const categoryLabels: Record<string, string> = {
    'build-error': 'Build Errors',
    'security': 'Security Vulnerabilities',
    'deprecated': 'Deprecated Packages',
    'breaking-change': 'Breaking Changes',
    'version-drift': 'Major Version Drift',
    'config': 'Configuration Notes',
  };

  for (const cat of categoryOrder) {
    const catIssues = categories[cat];
    if (!catIssues || catIssues.length === 0) continue;

    console.log(`${C.bold}  ${categoryLabels[cat] || cat} (${catIssues.length})${C.reset}`);
    console.log(`${C.dim}  ${'─'.repeat(60)}${C.reset}`);

    for (const issue of catIssues) {
      const sColor = severityColor(issue.severity);
      const icon = severityIcon(issue.severity);
      const pkgStr = issue.package ? ` ${C.cyan}${issue.package}${C.reset}` : '';
      console.log(`  ${sColor}${icon}${C.reset}${pkgStr} ${issue.title}`);
      console.log(`    ${C.dim}${issue.detail}${C.reset}`);
      if (showFixes && issue.fix) {
        console.log(`    ${C.green}Fix: ${issue.fix}${C.reset}`);
      }
      console.log('');
    }
  }

  // Quick fix section
  if (showFixes) {
    const actionable = report.issues.filter(i => i.fix && (i.severity === 'critical' || i.severity === 'high'));
    if (actionable.length > 0) {
      console.log(`${C.bold}${C.magenta}  Priority Fix Commands${C.reset}`);
      console.log(`${C.dim}  ${'─'.repeat(60)}${C.reset}`);
      for (const issue of actionable) {
        console.log(`  ${C.green}$ ${issue.fix}${C.reset}`);
      }
      console.log('');
    }
  }
}

function writeReportFile(report: HealthReport): string {
  const reportsDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `build-health-${new Date().toISOString().split('T')[0]}.json`;
  const filepath = path.join(reportsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  // Also write latest
  fs.writeFileSync(path.join(reportsDir, 'build-health-latest.json'), JSON.stringify(report, null, 2));

  return filepath;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const showFixes = args.includes('--fix') || !jsonMode;

  const report = generateReport();

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report, showFixes);
    const filepath = writeReportFile(report);
    console.log(`${C.dim}  Report saved: ${path.relative(ROOT, filepath)}${C.reset}`);
  }

  // Exit with non-zero if critical/high issues found
  if (report.summary.critical > 0 || report.summary.high > 0) {
    process.exit(1);
  }
}

main();
