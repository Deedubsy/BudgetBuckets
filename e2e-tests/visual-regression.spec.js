/**
 * Visual Regression Tests
 * Captures and compares screenshots to detect UI changes
 */

const { test, expect } = require('@playwright/test');

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for visual tests
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  });

  test('homepage visual appearance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for any dynamic content to load
    await page.waitForTimeout(1000);
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      threshold: 0.2 // Allow 20% difference for slight rendering variations
    });
    
    // Take viewport screenshot
    await expect(page).toHaveScreenshot('homepage-viewport.png', {
      threshold: 0.2
    });
  });

  test('login page visual appearance', async ({ page }) => {
    await page.goto('/auth/login.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Screenshot the login page
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      threshold: 0.2
    });
    
    // Test form elements specifically
    const formArea = page.locator('form, .auth-container, .login-form').first();
    if (await formArea.isVisible()) {
      await expect(formArea).toHaveScreenshot('login-form.png', {
        threshold: 0.2
      });
    }
  });

  test('app page initial state', async ({ page }) => {
    await page.goto('/app/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Screenshot the app interface (may show login prompt or main app)
    await expect(page).toHaveScreenshot('app-initial-state.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('smoke test page layout', async ({ page }) => {
    await page.goto('/test/smoke-test.html');
    await page.waitForLoadState('networkidle');
    
    // Screenshot the smoke test interface
    await expect(page).toHaveScreenshot('smoke-test-page.png', {
      fullPage: true,
      threshold: 0.2
    });
    
    // Test the main test interface area
    const testArea = page.locator('.container, .test-container, main').first();
    if (await testArea.isVisible()) {
      await expect(testArea).toHaveScreenshot('smoke-test-interface.png', {
        threshold: 0.2
      });
    }
  });

  test('network diagnostic page layout', async ({ page }) => {
    await page.goto('/test/network-diagnostic.html');
    await page.waitForLoadState('networkidle');
    
    // Screenshot the diagnostic interface
    await expect(page).toHaveScreenshot('network-diagnostic-page.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('responsive design - mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const pages = [
      { url: '/', name: 'homepage-mobile' },
      { url: '/auth/login.html', name: 'login-mobile' },
      { url: '/test/smoke-test.html', name: 'smoke-test-mobile' }
    ];
    
    for (const pageInfo of pages) {
      await page.goto(pageInfo.url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot(`${pageInfo.name}.png`, {
        fullPage: true,
        threshold: 0.2
      });
    }
  });

  test('responsive design - tablet view', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('homepage-tablet.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('dark mode appearance (if supported)', async ({ page }) => {
    // Try to enable dark mode through various methods
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Method 1: Check for dark mode toggle
    const darkModeToggle = page.locator('[data-theme="dark"], .dark-mode-toggle, #dark-mode').first();
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);
      
      await expect(page).toHaveScreenshot('homepage-dark-mode.png', {
        fullPage: true,
        threshold: 0.2
      });
    } else {
      // Method 2: Manually set dark theme via CSS or localStorage
      await page.evaluate(() => {
        document.body.classList.add('dark-theme', 'dark-mode');
        document.documentElement.setAttribute('data-theme', 'dark');
        if (localStorage) {
          localStorage.setItem('theme', 'dark');
        }
      });
      
      await page.waitForTimeout(500);
      
      await expect(page).toHaveScreenshot('homepage-forced-dark.png', {
        fullPage: true,
        threshold: 0.3 // Higher threshold for forced dark mode
      });
    }
  });

  test('error state appearances', async ({ page }) => {
    // Test 404 page appearance
    await page.goto('/nonexistent-page');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('error-404-page.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('smoke test with results display', async ({ page }) => {
    await page.goto('/test/smoke-test.html');
    await page.waitForLoadState('networkidle');
    
    // Try to run smoke test and capture results appearance
    const runButton = page.locator('#runAllBtn, button:has-text("Run All"), button:has-text("Run")').first();
    
    if (await runButton.isVisible()) {
      // Screenshot before running tests
      await expect(page).toHaveScreenshot('smoke-test-before-run.png', {
        fullPage: true,
        threshold: 0.2
      });
      
      await runButton.click();
      await page.waitForTimeout(3000); // Wait for some tests to run
      
      // Screenshot with test results
      await expect(page).toHaveScreenshot('smoke-test-with-results.png', {
        fullPage: true,
        threshold: 0.3 // Higher threshold due to dynamic content
      });
      
      // Screenshot just the results area
      const resultsArea = page.locator('#testResults, .test-results, pre').first();
      if (await resultsArea.isVisible()) {
        await expect(resultsArea).toHaveScreenshot('smoke-test-results-area.png', {
          threshold: 0.4 // Very high threshold for dynamic test output
        });
      }
    }
  });

  test('high contrast mode compatibility', async ({ page }) => {
    // Enable high contrast mode simulation
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Apply high contrast styles
    await page.addStyleTag({
      content: `
        * {
          filter: contrast(200%) !important;
        }
        body {
          background: black !important;
          color: white !important;
        }
      `
    });
    
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('homepage-high-contrast.png', {
      fullPage: true,
      threshold: 0.4 // High threshold for contrast adjustments
    });
  });

  test('print stylesheet appearance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Emulate print media
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('homepage-print-style.png', {
      fullPage: true,
      threshold: 0.3
    });
  });

  test('component focus states', async ({ page }) => {
    await page.goto('/auth/login.html');
    await page.waitForLoadState('networkidle');
    
    // Find and focus form elements to test focus styles
    const emailInput = page.locator('input[type="email"], #email, [name="email"]').first();
    const passwordInput = page.locator('input[type="password"], #password, [name="password"]').first();
    const submitButton = page.locator('button[type="submit"], #loginBtn, button:has-text("Login")').first();
    
    if (await emailInput.isVisible()) {
      await emailInput.focus();
      await page.waitForTimeout(200);
      
      await expect(page).toHaveScreenshot('login-email-focus.png', {
        threshold: 0.2
      });
    }
    
    if (await passwordInput.isVisible()) {
      await passwordInput.focus();
      await page.waitForTimeout(200);
      
      await expect(page).toHaveScreenshot('login-password-focus.png', {
        threshold: 0.2
      });
    }
    
    if (await submitButton.isVisible()) {
      await submitButton.focus();
      await page.waitForTimeout(200);
      
      await expect(page).toHaveScreenshot('login-button-focus.png', {
        threshold: 0.2
      });
    }
  });

  test('cross-browser consistency', async ({ page, browserName }) => {
    // Test the same page across different browsers
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Use browser-specific screenshot names for comparison
    await expect(page).toHaveScreenshot(`homepage-${browserName}.png`, {
      fullPage: true,
      threshold: 0.3 // Allow for browser rendering differences
    });
  });
});