#!/usr/bin/env node

/**
 * Manual Test Script for Tier Display
 *
 * This script helps manually test the tier badge display by setting
 * localStorage values to simulate different user tiers.
 *
 * Usage:
 * 1. Open your browser to http://localhost:3000
 * 2. Open the browser console (F12 → Console)
 * 3. Copy and paste the test functions below
 * 4. Run testBasicUser(), testProUser(), or testMaxUser()
 */

console.log(`
====================================================
Tier Display Manual Test Helper
====================================================

Copy the functions below into your browser console:

// Test Basic Tier User (shows credit count)
function testBasicUser() {
  const userData = {
    user_id: 999,
    api_key: 'test-basic-key',
    auth_method: 'email',
    privy_user_id: 'test-basic-user',
    display_name: 'Basic Test User',
    email: 'basic@test.com',
    credits: 1000,
    tier: 'basic'
  };
  localStorage.setItem('gatewayz_user_data', JSON.stringify(userData));
  localStorage.setItem('gatewayz_api_key', 'test-basic-key');
  console.log('✅ Set BASIC tier user data. Refresh the page to see credit count (1,000)');
  location.reload();
}

// Test PRO Tier User (shows PRO badge)
function testProUser() {
  const userData = {
    user_id: 999,
    api_key: 'test-pro-key',
    auth_method: 'email',
    privy_user_id: 'test-pro-user',
    display_name: 'Pro Test User',
    email: 'pro@test.com',
    credits: 5000,
    tier: 'pro',
    subscription_status: 'active'
  };
  localStorage.setItem('gatewayz_user_data', JSON.stringify(userData));
  localStorage.setItem('gatewayz_api_key', 'test-pro-key');
  console.log('✅ Set PRO tier user data. Refresh the page to see PRO badge 👑');
  location.reload();
}

// Test MAX Tier User (shows MAX badge)
function testMaxUser() {
  const userData = {
    user_id: 999,
    api_key: 'test-max-key',
    auth_method: 'email',
    privy_user_id: 'test-max-user',
    display_name: 'Max Test User',
    email: 'max@test.com',
    credits: 15000,
    tier: 'max',
    subscription_status: 'active'
  };
  localStorage.setItem('gatewayz_user_data', JSON.stringify(userData));
  localStorage.setItem('gatewayz_api_key', 'test-max-key');
  console.log('✅ Set MAX tier user data. Refresh the page to see MAX badge 👑');
  location.reload();
}

// Test uppercase tier values (should still work)
function testUppercasePro() {
  const userData = {
    user_id: 999,
    api_key: 'test-uppercase-key',
    auth_method: 'email',
    privy_user_id: 'test-uppercase-user',
    display_name: 'Uppercase Test',
    email: 'uppercase@test.com',
    credits: 5000,
    tier: 'PRO', // Uppercase
    subscription_status: 'active'
  };
  localStorage.setItem('gatewayz_user_data', JSON.stringify(userData));
  localStorage.setItem('gatewayz_api_key', 'test-uppercase-key');
  console.log('✅ Set UPPERCASE PRO tier. Should still show PRO badge 👑');
  location.reload();
}

// Clear test data and restore real auth
function clearTestData() {
  localStorage.removeItem('gatewayz_user_data');
  localStorage.removeItem('gatewayz_api_key');
  console.log('✅ Cleared test data. You will need to log in again.');
  location.reload();
}

// Check current user data
function checkCurrentUser() {
  const userData = localStorage.getItem('gatewayz_user_data');
  const apiKey = localStorage.getItem('gatewayz_api_key');

  if (!userData) {
    console.log('❌ No user data found in localStorage');
    return;
  }

  const parsed = JSON.parse(userData);
  console.log('📊 Current User Data:');
  console.log('  User ID:', parsed.user_id);
  console.log('  Email:', parsed.email);
  console.log('  Credits:', parsed.credits);
  console.log('  Tier:', parsed.tier || 'undefined');
  console.log('  Subscription:', parsed.subscription_status || 'undefined');
  console.log('  API Key:', apiKey ? apiKey.substring(0, 20) + '...' : 'none');

  if (!parsed.tier) {
    console.warn('⚠️  No tier field found! This is why you might not see PRO/MAX badge.');
  }
}

====================================================
Available Test Functions:
====================================================

testBasicUser()    - Simulate basic tier (shows credits)
testProUser()      - Simulate PRO tier (shows PRO badge)
testMaxUser()      - Simulate MAX tier (shows MAX badge)
testUppercasePro() - Test uppercase tier handling
checkCurrentUser() - Check your current localStorage data
clearTestData()    - Remove test data and restore auth

====================================================
`);
