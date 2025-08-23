/**
 * E2E Smoke Tests
 * Critical user journeys that must work for the app to be functional
 */

const { test, expect } = require('@playwright/test');

test.describe('Application Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up any common prerequisites
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Should load without errors
    await expect(page).toHaveTitle(/Budget Buckets/i);
    
    // Check for key elements
    await expect(page.locator('h1')).toBeVisible();
    
    // Should not show any console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Give page time to fully load and check for errors
    await page.waitForTimeout(2000);
    expect(errors.filter(error => 
      !error.includes('Not implemented: navigation') // Filter JSDOM warnings
    )).toHaveLength(0);
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/auth/login.html');
    
    // Should load login page
    await expect(page).toHaveTitle(/Login.*Budget Buckets/i);
    
    // Check for login form elements
    await expect(page.locator('[data-testid="email-input"], input[type="email"], #email')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"], input[type="password"], #password')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"], button[type="submit"], #loginBtn')).toBeVisible();
  });

  test('app page loads (authentication required)', async ({ page }) => {
    await page.goto('/app/index.html');
    
    // Should load app page (may redirect to login or show login prompt)
    await expect(page).toHaveTitle(/Budget.*App|Login/i);
    
    // Should either show the app interface or login interface
    const hasAppInterface = await page.locator('#app, .budget-container, .main-content').count() > 0;
    const hasLoginInterface = await page.locator('[data-testid="login"], #loginForm, .auth-container').count() > 0;
    
    expect(hasAppInterface || hasLoginInterface).toBe(true);
  });

  test('smoke test page functionality', async ({ page }) => {
    await page.goto('/test/smoke-test.html');
    
    // Should load smoke test page
    await expect(page).toHaveTitle(/Smoke Test/i);
    
    // Check for test controls
    await expect(page.locator('#runAllBtn, button:has-text("Run All")')).toBeVisible();
    await expect(page.locator('#testResults, .test-results, pre')).toBeVisible();
    
    // Try running Firebase initialization test (should not crash)
    const runButton = page.locator('#runAllBtn, button:has-text("Run All")').first();
    if (await runButton.isVisible()) {
      await runButton.click();
      
      // Wait for some test results to appear
      await page.waitForTimeout(3000);
      
      // Should show some test output
      const results = page.locator('#testResults, .test-results, pre').first();
      const resultsText = await results.textContent();
      expect(resultsText.length).toBeGreaterThan(10);
    }
  });

  test('network diagnostic page loads', async ({ page }) => {
    await page.goto('/test/network-diagnostic.html');
    
    // Should load network diagnostic page
    await expect(page).toHaveTitle(/Network Diagnostic|Diagnostic/i);
    
    // Should have diagnostic controls
    const hasControls = await page.locator('button, input[type="button"], .btn').count() > 0;
    expect(hasControls).toBe(true);
  });

  test('static assets load correctly', async ({ page }) => {
    const responses = [];
    
    // Track all network requests
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status()
      });
    });
    
    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check that critical assets loaded successfully
    const failedRequests = responses.filter(r => r.status >= 400);
    const criticalFailures = failedRequests.filter(r => 
      r.url.includes('.js') || r.url.includes('.css') || r.url.includes('.html')
    );
    
    expect(criticalFailures).toHaveLength(0);
  });

  test('navigation between pages works', async ({ page }) => {
    // Start at home
    await page.goto('/');
    await expect(page).toHaveTitle(/Budget Buckets/i);
    
    // Navigate to login
    await page.goto('/auth/login.html');
    await expect(page).toHaveTitle(/Login/i);
    
    // Navigate to app
    await page.goto('/app/index.html');
    await expect(page).toHaveTitle(/Budget.*App|Login/i);
    
    // Navigate to smoke test
    await page.goto('/test/smoke-test.html');
    await expect(page).toHaveTitle(/Smoke Test/i);
    
    // Each navigation should work without errors
  });

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Page should still be usable on mobile
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that content doesn't overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(400); // Allow some margin
  });

  test('JavaScript errors do not crash the page', async ({ page }) => {
    const jsErrors = [];
    const consoleLogs = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Try interacting with the page
    const clickableElements = await page.locator('button, a, input').count();
    if (clickableElements > 0) {
      // Try clicking the first clickable element
      await page.locator('button, a, input').first().click({ timeout: 5000 }).catch(() => {
        // Click might fail, that's okay for this test
      });
    }
    
    // Filter out expected errors (like navigation warnings)
    const unexpectedErrors = jsErrors.filter(error => 
      !error.includes('Not implemented: navigation') &&
      !error.includes('Firebase') && // Firebase might not be configured in test env
      !error.includes('auth/invalid-api-key') // Expected in test environment
    );
    
    // Should not have unexpected JavaScript errors
    if (unexpectedErrors.length > 0) {
      console.log('Console logs for debugging:', consoleLogs.slice(-10));
    }
    
    expect(unexpectedErrors).toHaveLength(0);
  });
});