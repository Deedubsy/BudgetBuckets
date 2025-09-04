// Global teardown for Playwright tests
// This runs once after all test files

async function globalTeardown() {
  console.log('🧹 Starting Playwright E2E test global teardown...');
  
  // Any cleanup that needs to happen after all tests
  // The webServer will be automatically stopped by Playwright
  
  console.log('✅ Playwright global teardown complete');
}

module.exports = globalTeardown;