#!/usr/bin/env node

/**
 * Script to fetch and analyze the most common errors from Sentry
 *
 * Usage:
 *   1. Set SENTRY_AUTH_TOKEN in your .env file
 *   2. Set SENTRY_ORG and SENTRY_PROJECT below
 *   3. Run: node scripts/analyze-sentry-errors.js
 */

const https = require('https');

// Configuration
const SENTRY_ORG = process.env.SENTRY_ORG || 'alpaca-network'; // Replace with your Sentry organization slug
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || 'javascript-nextjs'; // Replace with your Sentry project slug
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN || process.env.SENTRY_ACCESS_TOKEN;
const DAYS_BACK = 1; // Analyze errors from the last N days (changed to 1 for last 24h)

if (!SENTRY_AUTH_TOKEN) {
  console.error('Error: SENTRY_AUTH_TOKEN environment variable is required');
  console.error('Get your auth token from: https://sentry.io/settings/account/api/auth-tokens/');
  process.exit(1);
}

/**
 * Make a request to the Sentry API
 */
function sentryRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sentry.io',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`Sentry API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Fetch issues from Sentry
 */
async function fetchIssues() {
  console.log(`Fetching issues from the last ${DAYS_BACK} days...`);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK);
  const startDateStr = startDate.toISOString();

  const path = `/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=&statsPeriod=24h&sort=freq`;

  return await sentryRequest(path);
}

/**
 * Fetch detailed issue information
 */
async function fetchIssueDetails(issueId) {
  const path = `/api/0/issues/${issueId}/`;
  return await sentryRequest(path);
}

/**
 * Analyze and display common errors
 */
async function analyzeErrors() {
  try {
    console.log('\n🔍 Analyzing Sentry Errors...\n');
    console.log('='.repeat(80));

    const issues = await fetchIssues();

    if (!issues || issues.length === 0) {
      console.log('No issues found in the specified time period.');
      return;
    }

    console.log(`\nFound ${issues.length} issues. Analyzing top 10 most frequent errors:\n`);

    // Sort by event count and take top 10
    const topIssues = issues
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 10);

    // Display summary table
    console.log('┌─────┬────────────┬───────────┬─────────────────────────────────────────────────┐');
    console.log('│ Rank│   Events   │   Users   │ Error Title                                     │');
    console.log('├─────┼────────────┼───────────┼─────────────────────────────────────────────────┤');

    topIssues.forEach((issue, index) => {
      const rank = String(index + 1).padStart(4);
      const events = String(issue.count || 0).padStart(10);
      const users = String(issue.userCount || 0).padStart(9);
      const title = (issue.title || 'Unknown').substring(0, 47).padEnd(47);

      console.log(`│ ${rank}│ ${events} │ ${users} │ ${title} │`);
    });

    console.log('└─────┴────────────┴───────────┴─────────────────────────────────────────────────┘');

    // Display detailed information for each issue
    console.log('\n\n📊 Detailed Error Analysis:\n');
    console.log('='.repeat(80));

    for (let i = 0; i < Math.min(5, topIssues.length); i++) {
      const issue = topIssues[i];

      console.log(`\n${i + 1}. ${issue.title}`);
      console.log('-'.repeat(80));
      console.log(`   Issue ID:      ${issue.id}`);
      console.log(`   Short ID:      ${issue.shortId}`);
      console.log(`   Status:        ${issue.status}`);
      console.log(`   Level:         ${issue.level}`);
      console.log(`   Type:          ${issue.type}`);
      console.log(`   Event Count:   ${issue.count || 0}`);
      console.log(`   User Count:    ${issue.userCount || 0}`);
      console.log(`   First Seen:    ${new Date(issue.firstSeen).toLocaleString()}`);
      console.log(`   Last Seen:     ${new Date(issue.lastSeen).toLocaleString()}`);
      console.log(`   Link:          ${issue.permalink}`);

      if (issue.metadata) {
        console.log(`   Error Type:    ${issue.metadata.type || 'N/A'}`);
        console.log(`   Error Value:   ${issue.metadata.value || 'N/A'}`);
      }

      // Display tags
      if (issue.tags && issue.tags.length > 0) {
        console.log('   Tags:');
        issue.tags.forEach(tag => {
          if (tag.key && tag.value) {
            console.log(`     - ${tag.key}: ${tag.value}`);
          }
        });
      }

      // Display culprit (where the error occurred)
      if (issue.culprit) {
        console.log(`   Location:      ${issue.culprit}`);
      }
    }

    // Category analysis
    console.log('\n\n📈 Error Categories:\n');
    console.log('='.repeat(80));

    const categories = {};
    topIssues.forEach(issue => {
      const category = issue.metadata?.type || issue.type || 'Unknown';
      if (!categories[category]) {
        categories[category] = { count: 0, events: 0 };
      }
      categories[category].count += 1;
      categories[category].events += issue.count || 0;
    });

    Object.entries(categories)
      .sort((a, b) => b[1].events - a[1].events)
      .forEach(([category, data]) => {
        console.log(`   ${category.padEnd(30)} ${String(data.count).padStart(3)} issues, ${String(data.events).padStart(6)} events`);
      });

    // Tag analysis
    console.log('\n\n🏷️  Common Error Tags:\n');
    console.log('='.repeat(80));

    const tagMap = {};
    topIssues.forEach(issue => {
      if (issue.tags) {
        issue.tags.forEach(tag => {
          const key = tag.key;
          if (key && key !== 'browser' && key !== 'browser.name') {
            if (!tagMap[key]) {
              tagMap[key] = {};
            }
            const value = tag.value || 'unknown';
            if (!tagMap[key][value]) {
              tagMap[key][value] = 0;
            }
            tagMap[key][value] += 1;
          }
        });
      }
    });

    Object.entries(tagMap).forEach(([tagKey, values]) => {
      console.log(`\n   ${tagKey}:`);
      Object.entries(values)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([value, count]) => {
          console.log(`     - ${value}: ${count} issues`);
        });
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Analysis complete!\n');

  } catch (error) {
    console.error('Error analyzing Sentry data:', error.message);

    if (error.message.includes('401')) {
      console.error('\n❌ Authentication failed. Please check your SENTRY_AUTH_TOKEN.');
      console.error('Get your token from: https://sentry.io/settings/account/api/auth-tokens/');
    } else if (error.message.includes('404')) {
      console.error('\n❌ Project not found. Please verify SENTRY_ORG and SENTRY_PROJECT values.');
      console.error(`Current values: org="${SENTRY_ORG}", project="${SENTRY_PROJECT}"`);
    }

    process.exit(1);
  }
}

// Run the analysis
analyzeErrors();
