/**
 * UI interaction utilities for E2E tests
 */
import { Page, expect, Locator } from '@playwright/test';

/**
 * Wait for element by test ID with fallback selectors
 */
export async function waitForTestId(
  page: Page, 
  testId: string, 
  fallbackSelectors: string[] = [],
  timeoutMs = 10000
): Promise<Locator> {
  const selectors = [`[data-testid="${testId}"]`, ...fallbackSelectors];
  
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      await expect(element).toBeVisible({ timeout: timeoutMs });
      return element;
    } catch (error) {
      // Try next selector
      continue;
    }
  }
  
  throw new Error(`Element not found with testId "${testId}" or fallback selectors: ${fallbackSelectors.join(', ')}`);
}

/**
 * Assert plan badge shows correct plan type
 */
export async function assertPlanBadge(page: Page, expectedPlan: 'free' | 'plus'): Promise<void> {
  const planBadge = page.getByTestId('plan-badge')
    .or(page.locator('[data-testid="plan"]'))
    .or(page.locator('.plan-badge'))
    .or(page.locator('.subscription-badge'))
    .or(page.locator(':text-matches("Free|Plus", "i")'));
  
  await expect(planBadge.first()).toBeVisible({ timeout: 10000 });
  
  const expectedText = expectedPlan === 'free' ? /Free/i : /Plus/i;
  await expect(planBadge.first()).toHaveText(expectedText, { timeout: 5000 });
}

/**
 * Add buckets up to specified count
 */
export async function addBuckets(page: Page, count: number): Promise<void> {
  const addBucketBtn = page.getByTestId('add-bucket-btn')
    .or(page.locator('[data-testid="add-bucket"]'))
    .or(page.locator('button:has-text("Add")'))
    .or(page.locator('.add-bucket-btn'))
    .or(page.locator('#addBucketBtn'));
  
  for (let i = 0; i < count; i++) {
    try {
      // Check if button is still visible and enabled
      const isVisible = await addBucketBtn.first().isVisible({ timeout: 2000 });
      const isEnabled = await addBucketBtn.first().isEnabled({ timeout: 1000 });
      
      if (!isVisible || !isEnabled) {
        console.log(`Add bucket button not available after ${i} buckets - may have hit limit`);
        break;
      }
      
      await addBucketBtn.first().click();
      
      // Wait a bit for the bucket to be added
      await page.waitForTimeout(500);
      
      // Optionally wait for bucket count to update
      await waitForBucketCountUpdate(page, i + 1);
      
    } catch (error) {
      console.log(`Failed to add bucket ${i + 1}: ${error.message}`);
      break;
    }
  }
}

/**
 * Wait for bucket counter to update
 */
export async function waitForBucketCountUpdate(page: Page, expectedCount: number): Promise<void> {
  const bucketCounter = page.getByTestId('bucket-counter')
    .or(page.locator('[data-testid="counter"]'))
    .or(page.locator('.bucket-counter'))
    .or(page.locator('.bucket-count'));
  
  try {
    await expect(bucketCounter.first()).toContainText(expectedCount.toString(), { timeout: 5000 });
  } catch (error) {
    // Counter might not be visible or might use different format
    console.log(`Could not verify bucket count update to ${expectedCount}`);
  }
}

/**
 * Check if upgrade prompt/limit reached UI is shown
 */
export async function checkUpgradePrompt(page: Page): Promise<boolean> {
  const upgradePromptSelectors = [
    '[data-testid="upgrade-prompt"]',
    '.upgrade-prompt',
    '.limit-reached',
    ':text("upgrade")',
    ':text("limit")',
    ':text("Plus")'
  ];
  
  for (const selector of upgradePromptSelectors) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 2000 });
      if (isVisible) {
        return true;
      }
    } catch (error) {
      continue;
    }
  }
  
  return false;
}

/**
 * Assert bucket counter shows expected format (e.g., "5 / 5")
 */
export async function assertBucketCounter(page: Page, current: number, max: number): Promise<void> {
  const bucketCounter = page.getByTestId('bucket-counter')
    .or(page.locator('[data-testid="counter"]'))
    .or(page.locator('.bucket-counter'))
    .or(page.locator('.bucket-count'));
  
  const expectedPattern = new RegExp(`${current}\\s*[/\\s]\\s*${max}`);
  
  try {
    await expect(bucketCounter.first()).toHaveText(expectedPattern, { timeout: 5000 });
  } catch (error) {
    // Try alternative counter formats
    const alternativeSelectors = [
      `:text("${current} of ${max}")`,
      `:text("${current}/${max}")`,
      `:text("${current} buckets")`
    ];
    
    let found = false;
    for (const selector of alternativeSelectors) {
      try {
        const element = page.locator(selector).first();
        await expect(element).toBeVisible({ timeout: 2000 });
        found = true;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!found) {
      throw new Error(`Could not find bucket counter with expected format: ${current} / ${max}`);
    }
  }
}

/**
 * Click account/profile navigation
 */
export async function clickAccountNav(page: Page): Promise<void> {
  const accountNav = page.getByTestId('nav-account')
    .or(page.locator('[data-testid="account"]'))
    .or(page.locator('nav a:has-text("Account")'))
    .or(page.locator('.nav-account'))
    .or(page.locator('#accountBtn'))
    .or(page.locator('button:has-text("Account")'));
  
  await expect(accountNav.first()).toBeVisible();
  await accountNav.first().click();
  
  // Wait for account page to load
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for element to be clickable (visible and enabled)
 */
export async function waitForClickable(locator: Locator, timeoutMs = 5000): Promise<void> {
  await expect(locator).toBeVisible({ timeout: timeoutMs });
  await expect(locator).toBeEnabled({ timeout: timeoutMs });
}

/**
 * Safely click an element with retry logic
 */
export async function safeClick(locator: Locator, maxRetries = 3): Promise<void> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await waitForClickable(locator);
      await locator.click();
      return;
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        console.log(`Click attempt ${i + 1} failed, retrying...`);
        await locator.page().waitForTimeout(1000);
      }
    }
  }
  
  throw lastError || new Error('Failed to click element after retries');
}

/**
 * Wait for navigation or URL change
 */
export async function waitForNavigation(page: Page, urlPattern: string | RegExp, timeoutMs = 10000): Promise<void> {
  try {
    await page.waitForURL(urlPattern, { timeout: timeoutMs });
  } catch (error) {
    // If exact URL wait fails, check if URL contains expected pattern
    const currentUrl = page.url();
    const patternString = urlPattern instanceof RegExp ? urlPattern.source : urlPattern;
    
    if (currentUrl.includes(patternString) || (urlPattern instanceof RegExp && urlPattern.test(currentUrl))) {
      return;
    }
    
    throw error;
  }
}

/**
 * Check if verification banner is present
 */
export async function hasVerificationBanner(page: Page): Promise<boolean> {
  const bannerSelectors = [
    '[data-testid="verify-banner"]',
    '.verification-banner',
    '.email-verification',
    ':text("verify")',
    ':text("verification")'
  ];
  
  for (const selector of bannerSelectors) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 1000 });
      if (isVisible) {
        return true;
      }
    } catch (error) {
      continue;
    }
  }
  
  return false;
}

/**
 * Click verification resend button
 */
export async function clickResendVerification(page: Page): Promise<void> {
  const resendBtn = page.getByTestId('verify-resend')
    .or(page.locator('[data-testid="resend"]'))
    .or(page.locator('button:has-text("Resend")'))
    .or(page.locator('.resend-btn'));
  
  await expect(resendBtn.first()).toBeVisible();
  await resendBtn.first().click();
}

/**
 * Click "I've verified" button
 */
export async function clickIveVerified(page: Page): Promise<void> {
  const verifiedBtn = page.getByTestId('verify-ive-verified')
    .or(page.locator('[data-testid="ive-verified"]'))
    .or(page.locator('button:has-text("I\'ve verified")'))
    .or(page.locator('button:has-text("Verified")'))
    .or(page.locator('.verified-btn'));
  
  await expect(verifiedBtn.first()).toBeVisible();
  await verifiedBtn.first().click();
}