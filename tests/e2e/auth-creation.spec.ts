import { test, expect } from '@playwright/test';

test.describe('Account Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('should show inline error when signing in with non-existing email', async ({ page }) => {
    // Fill sign-in form with non-existing email
    await page.fill('#signinEmail', 'nonexistent@example.com');
    await page.fill('#signinPassword', 'password123');
    
    // Submit sign-in form
    await page.click('#signinForm button[type="submit"]');
    
    // Should show inline error
    await expect(page.locator('.inline-error')).toBeVisible();
    await expect(page.locator('.inline-error')).toContainText("Sign in failed");
    
    // Note: Tab switching only happens for specific Firebase error codes
    // For generic errors, we just show the error message
  });

  test('should show correct validation errors', async ({ page }) => {
    // Try to submit empty sign-in form
    await page.click('#signinForm button[type="submit"]');
    await expect(page.locator('.inline-error')).toBeVisible();
    await expect(page.locator('.inline-error')).toContainText('Email and password are required');
    
    // Try weak password in registration
    await page.click('[data-tab="register"]');
    await page.fill('#registerEmail', 'test@example.com');
    await page.fill('#registerPassword', '123');
    await page.fill('#registerConfirmPassword', '123');
    await page.click('#registerForm button[type="submit"]');
    
    await expect(page.locator('.inline-error')).toBeVisible();
    await expect(page.locator('.inline-error')).toContainText('at least 8 characters');
  });

  test('should show password mismatch error', async ({ page }) => {
    await page.click('[data-tab="register"]');
    await page.fill('#registerEmail', 'test@example.com');
    await page.fill('#registerPassword', 'password123');
    await page.fill('#registerConfirmPassword', 'different456');
    await page.click('#registerForm button[type="submit"]');
    
    await expect(page.locator('.inline-error')).toBeVisible();
    await expect(page.locator('.inline-error')).toContainText('Passwords do not match');
  });

  // Note: Cannot test actual account creation without email verification automation
  test.skip('should create account and redirect to verification page', async ({ page }) => {
    // This test would require email verification automation
    // which is complex to set up in automated tests
  });
});

test.describe('Email Verification Page', () => {
  test('should display verification page with email', async ({ page }) => {
    const testEmail = 'test@example.com';
    await page.goto(`/auth/verify?email=${encodeURIComponent(testEmail)}`);
    
    // Should show the target email
    await expect(page.locator('#targetEmail')).toContainText(testEmail);
    
    // Should have resend and check buttons
    await expect(page.locator('#resendBtn')).toBeVisible();
    await expect(page.locator('#checkVerificationBtn')).toBeVisible();
  });

  test('should have correct navigation links', async ({ page }) => {
    await page.goto('/auth/verify?email=test@example.com');
    
    // Should have link back to login
    const loginLink = page.locator('a[href="/auth/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText('different email');
  });
});

test.describe('Plan Selection Page', () => {
  test('should display both plan options', async ({ page }) => {
    await page.goto('/auth/choose-plan');
    
    // Should show both plan cards
    await expect(page.locator('#freePlan')).toBeVisible();
    await expect(page.locator('#plusPlan')).toBeVisible();
    
    // Should have correct test IDs
    await expect(page.locator('[data-testid="plan-free-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-plus-btn"]')).toBeVisible();
    
    // Should show plan features
    await expect(page.locator('#freePlan')).toContainText('Up to 5 budget buckets');
    await expect(page.locator('#plusPlan')).toContainText('Unlimited budget buckets');
  });

  test('should show plan pricing', async ({ page }) => {
    await page.goto('/auth/choose-plan');
    
    // Free plan should show $0
    await expect(page.locator('#freePlan .plan-price')).toContainText('$0');
    
    // Plus plan should show $3.99
    await expect(page.locator('#plusPlan .plan-price')).toContainText('$3.99');
  });

  test('should have correct footer links', async ({ page }) => {
    await page.goto('/auth/choose-plan');
    
    // Should have terms and privacy links
    await expect(page.locator('a[href="/terms"]')).toBeVisible();
    await expect(page.locator('a[href="/privacy"]')).toBeVisible();
  });

  // Note: Cannot fully test plan selection without authentication setup
  test.skip('should handle free plan selection', async ({ page }) => {
    // This test would require authentication setup
    // which is complex in automated tests
  });
});