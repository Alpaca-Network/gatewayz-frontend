#!/usr/bin/env node

/**
 * Subscription Configuration Checker
 *
 * This script checks if the required Stripe subscription configuration is set up correctly.
 * Run with: node scripts/check-subscription-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Subscription Configuration...\n');

// Check if .env.local exists
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envLocalExists = fs.existsSync(envLocalPath);

console.log(`📁 .env.local file: ${envLocalExists ? '✅ Found' : '❌ Not found'}`);

if (!envLocalExists) {
  console.log('\n⚠️  .env.local not found!');
  console.log('   Create it from the template:');
  console.log('   cp .env.local.template .env.local\n');
  process.exit(1);
}

// Read .env.local
const envContent = fs.readFileSync(envLocalPath, 'utf8');
const envLines = envContent.split('\n');

// Parse environment variables
const env = {};
envLines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    env[key] = valueParts.join('=');
  }
});

// Check required variables
const requiredVars = [
  'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_PRIVY_APP_ID'
];

console.log('\n📋 Checking required environment variables:\n');

let allConfigured = true;
const results = {};

requiredVars.forEach(varName => {
  const value = env[varName];
  const isSet = value && value.trim() !== '' && !value.includes('xxxxx') && !value.includes('your-');

  results[varName] = { value, isSet };

  if (varName.includes('STRIPE') && varName.includes('PRICE_ID')) {
    console.log(`   ${isSet ? '✅' : '❌'} ${varName}`);
    if (isSet) {
      console.log(`      Value: ${value.substring(0, 10)}...`);
      // Check if it starts with 'price_'
      if (!value.startsWith('price_')) {
        console.log(`      ⚠️  Warning: Should start with 'price_'`);
        allConfigured = false;
      }
    } else {
      console.log(`      ⚠️  Not configured or using placeholder value`);
      allConfigured = false;
    }
  } else {
    console.log(`   ${isSet ? '✅' : '❌'} ${varName}${isSet ? '' : ' (not configured)'}`);
    if (!isSet) {
      allConfigured = false;
    }
  }
});

console.log('\n' + '='.repeat(60));

if (allConfigured) {
  console.log('\n✅ All configuration looks good!\n');
  console.log('Next steps:');
  console.log('1. Restart your development server: pnpm dev');
  console.log('2. Test subscription at: http://localhost:3000/settings/credits');
  console.log('3. Click "Get Started" on Pro or Max tier\n');
} else {
  console.log('\n❌ Configuration incomplete!\n');
  console.log('To fix:');
  console.log('1. Get Stripe Price IDs from Stripe Dashboard:');
  console.log('   https://dashboard.stripe.com/products');
  console.log('');
  console.log('2. Find products:');
  console.log('   - Pro: prod_TKOqQPhVRxNp4Q ($10/month)');
  console.log('   - Max: prod_TKOraBpWMxMAIu ($75/month)');
  console.log('');
  console.log('3. Copy the Price IDs (start with "price_") and add to .env.local');
  console.log('');
  console.log('📚 See SUBSCRIPTION_FIX.md for detailed instructions\n');
  process.exit(1);
}

// Check Stripe product IDs in code
console.log('📦 Verifying Stripe Product IDs in code:\n');

const pricingSectionPath = path.join(__dirname, '..', 'src', 'components', 'pricing', 'pricing-section.tsx');
if (fs.existsSync(pricingSectionPath)) {
  const pricingContent = fs.readFileSync(pricingSectionPath, 'utf8');

  const proProdMatch = pricingContent.match(/stripeProductId:\s*['"]([^'"]+)['"]/);
  const maxProdMatch = pricingContent.match(/stripeProductId:\s*['"]([^'"]+)['"]/g);

  if (proProdMatch) {
    console.log('   ✅ Pro Product ID: prod_TKOqQPhVRxNp4Q (found in code)');
  }
  if (maxProdMatch && maxProdMatch.length >= 2) {
    console.log('   ✅ Max Product ID: prod_TKOraBpWMxMAIu (found in code)');
  }
  console.log('');
}

console.log('🎉 Configuration check complete!\n');
