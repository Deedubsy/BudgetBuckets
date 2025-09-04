import { test, expect } from '@playwright/test';

test.describe('Billing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the billing config endpoint
    await page.route('/api/billing/config', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          publishableKey: 'pk_test_fake_key_for_testing',
          priceId: 'price_fake_price_id_for_testing'
        })
      });
    });

    // Mock the setup-intent endpoint
    await page.route('/api/billing/setup-intent', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json', 
        body: JSON.stringify({
          clientSecret: 'seti_fake_client_secret_for_testing',
          customerId: 'cus_fake_customer_id_for_testing'
        })
      });
    });
  });

  test('should load billing configuration and initialize payment flow', async ({ page }) => {
    // Navigate to account page (assuming user is authenticated)
    await page.goto('/app');
    
    // Wait for the page to load and billing config to be fetched
    await page.waitForLoadState('networkidle');

    // Check that upgrade button exists with correct test id
    const upgradeBtn = page.getByTestId('upgrade-btn');
    await expect(upgradeBtn).toBeVisible();
    
    // Mock successful Stripe initialization
    await page.evaluate(() => {
      // Mock loadStripe and Stripe object
      window.Stripe = () => ({
        elements: () => ({
          create: () => ({
            mount: () => {},
            on: () => {},
            submit: () => Promise.resolve({ error: null })
          }),
          submit: () => Promise.resolve({ error: null })
        }),
        confirmSetup: () => Promise.resolve({
          error: null,
          setupIntent: { status: 'succeeded', payment_method: 'pm_test' }
        })
      });
    });

    // Click upgrade button to start checkout flow
    await upgradeBtn.click();

    // Verify that the setup-intent API was called with auth header
    await page.waitForRequest(request => {
      return request.url().includes('/api/billing/setup-intent') &&
             request.method() === 'POST' &&
             request.headers()['authorization']?.startsWith('Bearer ');
    });

    // Check that payment modal appears
    const paymentModal = page.locator('#payment-modal');
    await expect(paymentModal).toBeVisible();

    // Verify payment element container exists
    const paymentElement = page.locator('#stripe-payment-element');
    await expect(paymentElement).toBeVisible();

    // Check complete payment button exists but is initially disabled
    const completePaymentBtn = page.getByTestId('complete-payment-btn');
    await expect(completePaymentBtn).toBeVisible();
    await expect(completePaymentBtn).toBeDisabled();
  });

  test('should handle billing config loading failure gracefully', async ({ page }) => {
    // Override the billing config mock to return an error
    await page.route('/api/billing/config', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Billing service not configured' })
      });
    });

    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Upgrade button should still be visible but clicking should show error
    const upgradeBtn = page.getByTestId('upgrade-btn');
    await expect(upgradeBtn).toBeVisible();
    
    await upgradeBtn.click();

    // Should show error toast instead of payment modal
    const errorToast = page.locator('.toast-error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('Billing configuration not loaded');
  });

  test('should show manage billing button for plus users', async ({ page }) => {
    await page.goto('/app');
    
    // Mock user with plus plan
    await page.evaluate(() => {
      // Mock Firebase auth to return plus plan user
      window.mockUserClaims = { plan: 'plus' };
    });

    await page.waitForLoadState('networkidle');

    // Should show manage billing button instead of upgrade button
    const manageBillingBtn = page.getByTestId('manage-billing-btn');
    await expect(manageBillingBtn).toBeVisible();
    
    // Upgrade button should not be visible for plus users
    const upgradeBtn = page.getByTestId('upgrade-btn');
    await expect(upgradeBtn).not.toBeVisible();

    // Plan badge should show Plus
    const planBadge = page.getByTestId('plan-badge');
    await expect(planBadge).toContainText('Plus');
  });

  test('@manual should handle real 3DS challenge', async ({ page }) => {
    test.skip(process.env.E2E_STRIPE !== '1', 'Real Stripe integration tests require E2E_STRIPE=1');
    
    // This test would use real Stripe test cards that trigger 3DS
    // Card: 4000 0000 0000 3220 (requires 3DS authentication)
    // Implementation would:
    // 1. Use real billing config
    // 2. Enter 3DS test card details
    // 3. Verify 3DS iframe appears from hooks.stripe.com
    // 4. Complete 3DS challenge
    // 5. Verify payment completes successfully
    
    await page.goto('/app');
    // ... implementation details for manual testing
  });
});

test.describe('Billing API Integration', () => {
  test('should make authenticated requests to billing endpoints', async ({ page }) => {
    await page.goto('/app');
    
    let authHeaderFound = false;
    let setupIntentCalled = false;

    // Intercept and verify setup-intent request
    await page.route('/api/billing/setup-intent', async (route, request) => {
      setupIntentCalled = true;
      authHeaderFound = request.headers()['authorization']?.startsWith('Bearer ');
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clientSecret: 'seti_test_123',
          customerId: 'cus_test_123'
        })
      });
    });

    // Mock Stripe for successful flow
    await page.evaluate(() => {
      window.Stripe = () => ({
        elements: () => ({
          create: () => ({
            mount: () => {},
            on: () => {},
            submit: () => Promise.resolve({ error: null })
          })
        }),
        confirmSetup: () => Promise.resolve({
          setupIntent: { payment_method: 'pm_test_123' }
        })
      });
    });

    // Trigger upgrade flow
    const upgradeBtn = page.getByTestId('upgrade-btn');
    await upgradeBtn.click();

    // Wait for API calls
    await page.waitForTimeout(1000);

    expect(setupIntentCalled).toBe(true);
    expect(authHeaderFound).toBe(true);
  });
});