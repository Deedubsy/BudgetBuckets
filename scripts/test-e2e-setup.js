#!/usr/bin/env node

/**
 * Quick E2E setup validation script
 */

const { execSync } = require('child_process');

// Load environment variables from .env file
require('dotenv').config();

console.log('🧪 Budget Buckets E2E Test Setup Validation');
console.log('='.repeat(50));

// Check environment variables
const requiredEnvVars = ['TEST_EMAIL', 'TEST_PASSWORD', 'BASE_URL'];
const missingVars = [];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
  } else {
    console.log(`✅ ${varName}: ${process.env[varName].substring(0, 20)}...`);
  }
});

if (missingVars.length > 0) {
  console.log(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.log('Please add these to your .env file');
  process.exit(1);
}

// Check server connectivity
try {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
  console.log(`\n🌐 Testing server connectivity: ${baseUrl}`);
  
  execSync(`curl -s -f ${baseUrl} > /dev/null`, { stdio: 'ignore' });
  console.log('✅ Server is accessible');
} catch (error) {
  console.log('❌ Server is not accessible - make sure to start it first:');
  console.log('   npm run dev');
  process.exit(1);
}

// Check Playwright installation
try {
  console.log('\n🎭 Checking Playwright installation...');
  const version = execSync('npx playwright --version', { encoding: 'utf8' }).trim();
  console.log(`✅ ${version}`);
} catch (error) {
  console.log('❌ Playwright not installed - run: npx playwright install');
  process.exit(1);
}

// Check Stripe CLI (optional)
if (process.env.E2E_STRIPE === '1') {
  try {
    console.log('\n💳 Checking Stripe CLI (optional)...');
    execSync('stripe --version', { stdio: 'ignore' });
    console.log('✅ Stripe CLI available for webhook testing');
  } catch (error) {
    console.log('⚠️  Stripe CLI not found - webhook tests will be skipped');
    console.log('   Install with: brew install stripe/stripe-cli/stripe');
  }
}

console.log('\n🎯 Ready to run E2E tests!');
console.log('Available commands:');
console.log('  npm run test:e2e:billing        # Run billing tests (headless)');
console.log('  npm run test:e2e:billing:headed # Run billing tests (visible browser)');
console.log('  npm run test:e2e:ui             # Run with interactive UI');