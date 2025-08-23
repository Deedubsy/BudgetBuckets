// Global setup for Playwright tests
// This runs once before all test files

async function globalSetup() {
  console.log('🚀 Starting Playwright E2E test global setup...');
  
  // Check if development server is already running
  try {
    const response = await fetch('http://localhost:8080/__/health');
    if (response.ok) {
      console.log('✅ Development server is already running');
      return;
    }
  } catch (error) {
    console.log('⏳ Development server not detected, will be started by webServer config');
  }
  
  console.log('✅ Playwright global setup complete');
}

module.exports = globalSetup;