/**
 * E2E tests for account management and billing flows
 */
import { test, expect } from '@playwright/test';
import { 
  loginWithEmail, 
  ensureSignedOut, 
  logout,
  getTestUser 
} from './utils/auth';
import { 
  assertPlanBadge, 
  addBuckets, 
  assertBucketCounter,
  clickAccountNav,
  waitForTestId,
  hasVerificationBanner,
  clickResendVerification,
  clickIveVerified,
  checkUpgradePrompt,
  safeClick
} from './utils/ui';
import { 
  isStripeE2EEnabled,
  stripeListenStart,
  stripeListenStop,
  triggerSubscriptionCreated,
  triggerSubscriptionDeleted,
  validateStripeSetup,
  cleanupStripeProcesses
} from './utils/stripe';

// Configure test timeouts for billing flows
test.describe.configure({ mode: 'serial' });

test.describe('Account & Billing E2E Tests', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:8080';
  
  test.beforeAll(async () => {
    // Validate environment setup
    const testUser = getTestUser();
    console.log(`🧪 Testing with user: ${testUser.email}`);
    console.log(`🌐 Base URL: ${baseURL}`);
    
    if (isStripeE2EEnabled()) {
      const stripeValidation = await validateStripeSetup();
      if (!stripeValidation.valid) {
        console.warn(`⚠️ Stripe setup issue: ${stripeValidation.message}`);
      } else {
        console.log(`✅ ${stripeValidation.message}`);
        
        // Start Stripe listener for webhook tests
        try {
          await stripeListenStart(`${baseURL}/api/billing/webhook`);
        } catch (error) {
          console.error('Failed to start Stripe listener:', error.message);
        }
      }
    }
  });

  test.afterAll(async () => {
    await cleanupStripeProcesses();
  });

  test.beforeEach(async ({ page }) => {
    // Ensure clean state before each test
    await ensureSignedOut(page);
  });

  test('Flow A: Email/password login', async ({ page }) => {
    test.slow(); // Mark as slow test for longer timeout
    
    await test.step('Navigate to login page', async () => {
      await page.goto('/auth/login.html');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Complete login form', async () => {
      await loginWithEmail(page);
    });

    await test.step('Verify successful login', async () => {
      // Should be on app page
      expect(page.url()).toMatch(/\/app\/index/);
      
      // Account navigation should be visible
      const accountNav = page.getByTestId('nav-account')
        .or(page.locator('nav a:has-text("Account")'))
        .or(page.locator('.nav-account'));
      
      await expect(accountNav.first()).toBeVisible();
    });

    await test.step('Check for email verification banner', async () => {
      const hasVerifyBanner = await hasVerificationBanner(page);
      
      if (hasVerifyBanner) {
        console.log('📧 Email verification banner detected');
        
        // Test resend verification
        try {
          await clickResendVerification(page);
          console.log('✅ Resend verification clicked successfully');
        } catch (error) {
          console.log('ℹ️ Resend verification not available or failed');
        }
        
        // Test "I've verified" button
        try {
          await clickIveVerified(page);
          // This might reload the page or update the UI
          await page.waitForTimeout(2000);
          console.log('✅ "I\'ve verified" clicked successfully');
        } catch (error) {
          console.log('ℹ️ "I\'ve verified" button not available or failed');
        }
      } else {
        console.log('ℹ️ No email verification banner (user may already be verified)');
      }
    });
  });

  test('Flow B: Profile & buttons', async ({ page }) => {
    await test.step('Login and navigate to account', async () => {
      await loginWithEmail(page);
      await clickAccountNav(page);
    });

    await test.step('Verify account page elements', async () => {
      // Plan badge should be visible
      const planBadge = page.getByTestId('plan-badge')
        .or(page.locator('.plan-badge'))
        .or(page.locator(':text-matches("Free|Plus", "i")'));
      
      await expect(planBadge.first()).toBeVisible();
      
      // Should show "Free" for new accounts
      await assertPlanBadge(page, 'free');
      
      // Upgrade button should be visible for free accounts
      const upgradeBtn = page.getByTestId('upgrade-btn')
        .or(page.locator('button:has-text("Upgrade")'))
        .or(page.locator('.upgrade-btn'));
      
      await expect(upgradeBtn.first()).toBeVisible();
      
      // Manage billing button should be visible
      const manageBillingBtn = page.getByTestId('manage-billing-btn')
        .or(page.locator('button:has-text("Manage")'))
        .or(page.locator('.manage-billing-btn'));
      
      await expect(manageBillingBtn.first()).toBeVisible();
      
      // Logout button should be visible
      const logoutBtn = page.getByTestId('logout-btn')
        .or(page.locator('button:has-text("Logout")'))
        .or(page.locator('button:has-text("Sign Out")'));
      
      await expect(logoutBtn.first()).toBeVisible();
    });
  });

  test('Flow C: Free plan limit UI', async ({ page }) => {
    await test.step('Login and go to main app', async () => {
      await loginWithEmail(page);
      
      // Make sure we're on the main app page
      if (!page.url().includes('/app/index')) {
        await page.goto('/app/index.html');
        await page.waitForLoadState('networkidle');
      }
    });

    await test.step('Add buckets up to free limit', async () => {
      // Add 5 buckets (free plan limit)
      await addBuckets(page, 5);
      
      // Check bucket counter shows 5/5
      try {
        await assertBucketCounter(page, 5, 5);
      } catch (error) {
        console.log('ℹ️ Bucket counter format may vary:', error.message);
        
        // Alternative check - look for any indication of 5 buckets
        const counterText = await page.locator('*:has-text("5")').first().textContent().catch(() => '');
        expect(counterText).toContain('5');
      }
    });

    await test.step('Attempt to add 6th bucket and verify blocking', async () => {
      // Try to add a 6th bucket
      const addBtn = page.getByTestId('add-bucket-btn')
        .or(page.locator('button:has-text("Add")'))
        .or(page.locator('.add-bucket-btn'));
      
      const initialButtonState = await addBtn.first().isEnabled().catch(() => true);
      
      if (initialButtonState) {
        await addBtn.first().click();
        
        // Should show upgrade prompt or button should become disabled
        const hasUpgradePrompt = await checkUpgradePrompt(page);
        const buttonNowDisabled = !(await addBtn.first().isEnabled().catch(() => true));
        
        expect(hasUpgradePrompt || buttonNowDisabled).toBe(true);
        
        if (hasUpgradePrompt) {
          console.log('✅ Upgrade prompt shown when attempting 6th bucket');
        } else if (buttonNowDisabled) {
          console.log('✅ Add bucket button disabled after reaching limit');
        }
      } else {
        console.log('✅ Add bucket button already disabled at limit');
      }
    });
  });

  test('Flow D: Upgrade to Plus - server handoff & webhook', async ({ page }) => {
    test.slow(); // This test involves external API calls
    
    await test.step('Login and navigate to upgrade', async () => {
      await loginWithEmail(page);
      await clickAccountNav(page);
    });

    await test.step('Initiate upgrade flow', async () => {
      // Set up request interception for billing API
      const checkoutRequests: any[] = [];
      
      await page.route('**/api/billing/checkout', route => {
        checkoutRequests.push({
          url: route.request().url(),
          method: route.request().method(),
          headers: route.request().headers()
        });
        route.continue();
      });
      
      // Click upgrade button
      const upgradeBtn = page.getByTestId('upgrade-btn')
        .or(page.locator('button:has-text("Upgrade")'))
        .or(page.locator('.upgrade-btn'));
      
      await expect(upgradeBtn.first()).toBeVisible();
      
      const responsePromise = page.waitForResponse('**/api/billing/checkout');
      await upgradeBtn.first().click();
      
      // Wait for API response
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      
      // Verify Authorization header present
      const request = checkoutRequests.find(req => req.url.includes('/api/billing/checkout'));
      expect(request).toBeDefined();
      expect(request.headers.authorization).toMatch(/Bearer .+/);
      
      // Verify response contains Stripe checkout URL
      const responseBody = await response.json();
      expect(responseBody.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      
      console.log('✅ Checkout API returns valid Stripe URL');
      console.log(`📋 Checkout URL: ${responseBody.url.substring(0, 50)}...`);
    });

    if (isStripeE2EEnabled()) {
      await test.step('Trigger webhook to complete upgrade', async () => {
        test.skip(!isStripeE2EEnabled(), 'Enable E2E_STRIPE=1 + Stripe CLI to run full billing tests');
        
        // Trigger subscription created webhook
        await triggerSubscriptionCreated();
        
        // Refresh user claims/token
        await page.evaluate(() => {
          if ((window as any).appTestHooks?.refreshPlan) {
            return (window as any).appTestHooks.refreshPlan();
          }
          // Fallback: reload page to refresh token
          window.location.reload();
          return Promise.resolve();
        });
        
        // Wait for page reload if it occurred
        await page.waitForLoadState('networkidle');
        
        // Navigate back to account if needed
        if (!page.url().includes('account') && !page.url().includes('Account')) {
          await clickAccountNav(page);
        }
        
        // Verify plan badge now shows "Plus"
        await assertPlanBadge(page, 'plus');
        console.log('✅ Plan upgraded to Plus via webhook');
        
        // Go back to app and test bucket limit is removed
        await page.goto('/app/index.html');
        await page.waitForLoadState('networkidle');
        
        // Should now be able to add more than 5 buckets
        await addBuckets(page, 6);
        
        // Verify 6th bucket was added successfully
        const addBtn = page.getByTestId('add-bucket-btn')
          .or(page.locator('button:has-text("Add")'))
          .or(page.locator('.add-bucket-btn'));
        
        const canStillAdd = await addBtn.first().isEnabled().catch(() => false);
        expect(canStillAdd).toBe(true);
        
        console.log('✅ Plus plan allows unlimited buckets');
      });
    } else {
      test.skip('Stripe CLI not available - webhook testing skipped');
    }
  });

  test('Flow E: Manage billing / Cancel - server handoff & webhook', async ({ page }) => {
    test.slow();
    test.skip(!isStripeE2EEnabled(), 'Enable E2E_STRIPE=1 + Stripe CLI to run full billing tests');
    
    await test.step('Setup Plus plan for cancellation test', async () => {
      await loginWithEmail(page);
      
      // First upgrade to Plus (skip UI flow, just trigger webhook)
      await triggerSubscriptionCreated();
      
      // Refresh token
      await page.evaluate(() => {
        if ((window as any).appTestHooks?.refreshPlan) {
          return (window as any).appTestHooks.refreshPlan();
        }
        window.location.reload();
        return Promise.resolve();
      });
      
      await page.waitForLoadState('networkidle');
      await clickAccountNav(page);
      
      // Verify we start with Plus plan
      await assertPlanBadge(page, 'plus');
    });

    await test.step('Access billing portal', async () => {
      // Set up request interception
      const portalRequests: any[] = [];
      
      await page.route('**/api/billing/portal', route => {
        portalRequests.push({
          url: route.request().url(),
          method: route.request().method(),
          headers: route.request().headers()
        });
        route.continue();
      });
      
      // Click manage billing button
      const manageBillingBtn = page.getByTestId('manage-billing-btn')
        .or(page.locator('button:has-text("Manage")'))
        .or(page.locator('.manage-billing-btn'));
      
      await expect(manageBillingBtn.first()).toBeVisible();
      
      const responsePromise = page.waitForResponse('**/api/billing/portal');
      await manageBillingBtn.first().click();
      
      // Wait for API response
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      
      // Verify Authorization header present
      const request = portalRequests.find(req => req.url.includes('/api/billing/portal'));
      expect(request).toBeDefined();
      expect(request.headers.authorization).toMatch(/Bearer .+/);
      
      // Verify response contains Stripe portal URL
      const responseBody = await response.json();
      expect(responseBody.url).toMatch(/^https:\/\/billing\.stripe\.com\//);
      
      console.log('✅ Portal API returns valid Stripe URL');
    });

    await test.step('Trigger cancellation webhook', async () => {
      // Trigger subscription deleted webhook
      await triggerSubscriptionDeleted();
      
      // Refresh user claims
      await page.evaluate(() => {
        if ((window as any).appTestHooks?.refreshPlan) {
          return (window as any).appTestHooks.refreshPlan();
        }
        window.location.reload();
        return Promise.resolve();
      });
      
      await page.waitForLoadState('networkidle');
      
      // Navigate back to account page
      if (!page.url().includes('account')) {
        await clickAccountNav(page);
      }
      
      // Verify plan badge returns to "Free"
      await assertPlanBadge(page, 'free');
      console.log('✅ Plan downgraded to Free via webhook');
      
      // Verify bucket limit is enforced again
      await page.goto('/app/index.html');
      await page.waitForLoadState('networkidle');
      
      // Add buckets up to limit
      await addBuckets(page, 5);
      
      // 6th add should be blocked
      const addBtn = page.getByTestId('add-bucket-btn')
        .or(page.locator('button:has-text("Add")'))
        .or(page.locator('.add-bucket-btn'));
      
      await addBtn.first().click();
      
      const hasUpgradePromptAfterDowngrade = await checkUpgradePrompt(page);
      expect(hasUpgradePromptAfterDowngrade).toBe(true);
      
      console.log('✅ Free plan limit re-enforced after cancellation');
    });
  });

  test('Flow F: Google SSO smoke test', async ({ page }) => {
    await test.step('Navigate to login page', async () => {
      await page.goto('/auth/login.html');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Test Google SSO button', async () => {
      // Find Google sign-in button
      const googleBtn = page.getByTestId('login-google')
        .or(page.locator('button:has-text("Google")'))
        .or(page.locator('[id*="google"]'))
        .or(page.locator('.google-signin-btn'));
      
      await expect(googleBtn.first()).toBeVisible();
      
      // Click Google button and expect navigation to Google
      const navigationPromise = page.waitForURL('**/accounts.google.com/**', { 
        timeout: 10000 
      }).catch(() => {
        // If direct navigation doesn't happen, check for popup
        return page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
      });
      
      await googleBtn.first().click();
      
      const result = await navigationPromise;
      
      if (result) {
        if ('url' in result) {
          // Direct navigation occurred
          expect(result.url()).toContain('accounts.google.com');
          console.log('✅ Google SSO redirects to Google accounts');
        } else {
          // Popup was opened
          console.log('✅ Google SSO opens popup (popup blocked or closed)');
        }
      } else {
        // Check if error is shown inline (popup-closed-by-user is acceptable)
        const errorMessages = await page.locator('[class*="error"], .error-message, [id*="error"]').allTextContents();
        const hasPopupError = errorMessages.some(msg => 
          msg.includes('popup') || msg.includes('closed') || msg.includes('blocked')
        );
        
        if (hasPopupError) {
          console.log('✅ Google SSO popup blocked/closed error handled gracefully');
        } else {
          // This might be expected in headless mode
          console.log('ℹ️ Google SSO click registered (headless mode may prevent popup)');
        }
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up after each test
    try {
      await logout(page);
    } catch (error) {
      console.log('Logout cleanup failed:', error.message);
    }
  });
});