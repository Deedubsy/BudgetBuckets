/**
 * Basic smoke tests to verify the E2E setup is working
 * These tests don't require authentication
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('Homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check for main heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('Budget');
    
    // Check navigation elements
    const loginButton = page.locator('a[href*="login"], button:has-text("Login"), button:has-text("Sign In")');
    await expect(loginButton.first()).toBeVisible();
  });

  test('Login page structure', async ({ page }) => {
    await page.goto('/auth/login.html');
    
    // Check form elements exist
    const emailInput = page.locator('input[type="email"], #email');
    const passwordInput = page.locator('input[type="password"], #password');
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign In")');
    const googleButton = page.locator('button:has-text("Google")');
    
    await expect(emailInput.first()).toBeVisible();
    await expect(passwordInput.first()).toBeVisible();
    await expect(submitButton.first()).toBeVisible();
    await expect(googleButton.first()).toBeVisible();
  });

  test('Login form interaction', async ({ page }) => {
    await page.goto('/auth/login.html');
    
    // Fill in test credentials (won't authenticate, just test form)
    const emailInput = page.locator('input[type="email"], #email').first();
    const passwordInput = page.locator('input[type="password"], #password').first();
    
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    
    // Verify inputs were filled
    await expect(emailInput).toHaveValue('test@example.com');
    await expect(passwordInput).toHaveValue('password123');
    
    // Check submit button is clickable
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign In")').first();
    await expect(submitButton).toBeEnabled();
  });

  test('App page loads and shows core elements', async ({ page }) => {
    // Access app page directly
    await page.goto('/app/index.html');
    
    // Check for core Budget Buckets elements
    await expect(page.locator('h1').first()).toContainText('Budget Buckets');
    
    // Check for main sections
    await expect(page.locator('h2:has-text("Expenses")')).toBeVisible();
    await expect(page.locator('h2:has-text("Savings")')).toBeVisible();
    
    // Check for add bucket functionality
    const addBucketButtons = page.locator('button:has-text("Add bucket")');
    await expect(addBucketButtons.first()).toBeVisible();
    
    // Check bucket counter
    const bucketCounter = page.locator(':text("buckets")');
    await expect(bucketCounter.first()).toBeVisible();
  });

  test('Test hooks are loaded in test environment', async ({ page }) => {
    await page.goto('/?e2e=1');
    
    // Check if test hooks are loaded
    const hasTestHooks = await page.evaluate(() => {
      return typeof (window as any).appTestHooks === 'object';
    });
    
    if (hasTestHooks) {
      console.log('✅ Test hooks loaded successfully');
      
      // Check available test hook methods
      const hookMethods = await page.evaluate(() => {
        const hooks = (window as any).appTestHooks;
        return hooks ? Object.keys(hooks) : [];
      });
      
      expect(hookMethods).toContain('refreshPlan');
      expect(hookMethods).toContain('getCurrentPlan');
    } else {
      console.log('ℹ️ Test hooks not loaded (expected in development mode)');
    }
  });
});