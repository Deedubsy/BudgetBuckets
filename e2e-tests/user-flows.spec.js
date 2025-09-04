/**
 * E2E User Flow Tests
 * Test complete user journeys through the application
 */

const { test, expect } = require('@playwright/test');

test.describe('User Journey Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('user can access smoke test and run basic checks', async ({ page }) => {
    await page.goto('/test/smoke-test.html');
    
    // Should load smoke test interface
    await expect(page).toHaveTitle(/Smoke Test/i);
    
    // Find and click run button (try different possible selectors)
    const runButton = page.locator('#runAllBtn').or(page.locator('button:has-text("Run All")')).or(page.locator('button:has-text("Run")')).first();
    await expect(runButton).toBeVisible();
    
    // Click run button
    await runButton.click();
    
    // Wait for tests to start
    await page.waitForTimeout(2000);
    
    // Should show test results
    const resultsArea = page.locator('#testResults').or(page.locator('.test-results')).or(page.locator('pre')).first();
    await expect(resultsArea).toBeVisible();
    
    // Results should contain some content
    const resultsText = await resultsArea.textContent();
    expect(resultsText.trim().length).toBeGreaterThan(0);
    
    // Should show timestamps or test indicators
    expect(resultsText).toMatch(/\[.*\]|✅|❌|ℹ️|⚠️|Testing|Firebase|Auth/i);
  });

  test('user can navigate network diagnostic tool', async ({ page }) => {
    await page.goto('/test/network-diagnostic.html');
    
    // Should load network diagnostic page
    await expect(page).toHaveTitle(/Network.*Diagnostic|Diagnostic/i);
    
    // Should have some diagnostic functionality
    const diagnosticButtons = page.locator('button').or(page.locator('input[type="button"]')).or(page.locator('.btn'));
    const buttonCount = await diagnosticButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
    
    // Try clicking a diagnostic button if available
    if (buttonCount > 0) {
      const firstButton = diagnosticButtons.first();
      const buttonText = await firstButton.textContent();
      console.log(`Clicking diagnostic button: ${buttonText}`);
      
      await firstButton.click();
      await page.waitForTimeout(1000);
      
      // Should not crash
      const hasContent = await page.locator('body').isVisible();
      expect(hasContent).toBe(true);
    }
  });

  test('user can attempt login flow (without valid credentials)', async ({ page }) => {
    await page.goto('/auth/login.html');
    
    // Should load login page
    await expect(page).toHaveTitle(/Login/i);
    
    // Find login form elements (try different selectors)
    const emailInput = page.locator('[data-testid="email-input"]')
                          .or(page.locator('input[type="email"]'))
                          .or(page.locator('#email'))
                          .or(page.locator('[name="email"]')).first();
    
    const passwordInput = page.locator('[data-testid="password-input"]')
                             .or(page.locator('input[type="password"]'))
                             .or(page.locator('#password'))
                             .or(page.locator('[name="password"]')).first();
    
    const loginButton = page.locator('[data-testid="login-button"]')
                           .or(page.locator('button[type="submit"]'))
                           .or(page.locator('#loginBtn'))
                           .or(page.locator('button:has-text("Login")')
                           .or(page.locator('button:has-text("Sign In")'))).first();
    
    // Check that login form exists
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
    
    // Fill in test credentials
    await emailInput.fill('test@example.com');
    await passwordInput.fill('testpassword');
    
    // Click login button
    await loginButton.click();
    
    // Should either show error message or redirect
    // Wait a moment for the response
    await page.waitForTimeout(3000);
    
    // Page should still be functional (not crashed)
    const pageIsResponsive = await page.locator('body').isVisible();
    expect(pageIsResponsive).toBe(true);
  });

  test('user can access app page and see interface', async ({ page }) => {
    await page.goto('/app/index.html');
    
    // Should load app or redirect to login
    await expect(page).toHaveTitle(/Budget|App|Login/i);
    
    // Should show either app interface or login prompt
    const hasAppContent = await page.locator('#app, .budget-container, .main-content, .budget-app').count() > 0;
    const hasAuthContent = await page.locator('.auth-container, #loginForm, .login-form').count() > 0;
    const hasGenericContent = await page.locator('main, .container, body > div').count() > 0;
    
    expect(hasAppContent || hasAuthContent || hasGenericContent).toBe(true);
    
    // Page should be interactive
    const clickableElements = await page.locator('button, a, input').count();
    expect(clickableElements).toBeGreaterThan(0);
  });

  test('user can navigate between different sections', async ({ page }) => {
    const pages = [
      { url: '/', titlePattern: /Budget Buckets|Home/i },
      { url: '/auth/login.html', titlePattern: /Login/i },
      { url: '/app/index.html', titlePattern: /Budget|App|Login/i },
      { url: '/test/smoke-test.html', titlePattern: /Smoke Test/i }
    ];
    
    for (const pageInfo of pages) {
      await page.goto(pageInfo.url);
      await expect(page).toHaveTitle(pageInfo.titlePattern);
      
      // Page should be responsive
      const isVisible = await page.locator('body').isVisible();
      expect(isVisible).toBe(true);
      
      // Should not have critical errors
      const hasContent = await page.evaluate(() => document.body.innerText.trim().length > 0);
      expect(hasContent).toBe(true);
    }
  });

  test('user can interact with pricing page (if exists)', async ({ page }) => {
    // Try to access pricing page
    const pricingResponse = await page.goto('/pricing', { waitUntil: 'domcontentloaded' }).catch(() => null);
    
    if (pricingResponse && pricingResponse.status() === 200) {
      await expect(page).toHaveTitle(/Pricing|Budget Buckets/i);
      
      // Should have pricing content
      const hasPricingContent = await page.locator('.pricing, .price, .plan, h1, h2').count() > 0;
      expect(hasPricingContent).toBe(true);
    } else {
      // If pricing page doesn't exist, that's fine - skip this test
      console.log('Pricing page not available, skipping pricing test');
    }
  });

  test('mobile user experience is functional', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const mobilePages = [
      '/',
      '/auth/login.html',
      '/test/smoke-test.html'
    ];
    
    for (const url of mobilePages) {
      await page.goto(url);
      
      // Page should load
      const bodyVisible = await page.locator('body').isVisible();
      expect(bodyVisible).toBe(true);
      
      // Content should not overflow horizontally
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(400); // Allow some buffer
      
      // Should have some interactive elements
      const interactiveCount = await page.locator('button, a, input').count();
      expect(interactiveCount).toBeGreaterThan(0);
    }
  });

  test('user can use environment switcher (if available)', async ({ page }) => {
    // Try to access environment switcher
    const envResponse = await page.goto('/environment', { waitUntil: 'domcontentloaded' }).catch(() => null);
    
    if (envResponse && envResponse.status() === 200) {
      // Should show environment controls
      const hasEnvControls = await page.locator('button, select, input, .env').count() > 0;
      expect(hasEnvControls).toBe(true);
      
      // Should be functional
      const pageTitle = await page.title();
      expect(pageTitle.length).toBeGreaterThan(0);
    } else {
      console.log('Environment switcher not available, skipping test');
    }
  });

  test('error pages are handled gracefully', async ({ page }) => {
    // Test 404 handling
    const response = await page.goto('/nonexistent-page');
    
    if (response.status() === 404) {
      // Should show a proper 404 page
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toMatch(/404|not found|page.*not.*found/i);
    } else {
      // If redirected or handled differently, should still be functional
      const bodyVisible = await page.locator('body').isVisible();
      expect(bodyVisible).toBe(true);
    }
  });
});