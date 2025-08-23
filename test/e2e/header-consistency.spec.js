import { test, expect } from '@playwright/test';

const publicPages = [
  '/',
  '/pricing', 
  '/guide/budget-buckets-method',
  '/calculators',
  '/privacy',
  '/terms',
  '/support'
];

test('shared header matches across public pages', async ({ page }) => {
  let firstHeaderHtml = '';
  
  for (const pagePath of publicPages) {
    await page.goto(pagePath);
    
    // Wait for page to load
    await page.waitForSelector('header.site .nav');
    
    // Get the header HTML structure
    const headerHtml = await page.locator('header.site .nav').innerHTML();
    
    if (!firstHeaderHtml) {
      firstHeaderHtml = headerHtml;
    } else {
      // Normalize whitespace for comparison
      const normalizedFirst = firstHeaderHtml.replace(/\s+/g, ' ').trim();
      const normalizedCurrent = headerHtml.replace(/\s+/g, ' ').trim();
      
      expect(normalizedCurrent, `Header on ${pagePath} should match header on ${publicPages[0]}`).toBe(normalizedFirst);
    }
    
    // Also verify key header elements are present
    await expect(page.locator('header.site .brand')).toBeVisible();
    await expect(page.locator('header.site nav a[href="/calculators"]')).toBeVisible();
    await expect(page.locator('header.site nav a[href="/guide/budget-buckets-method"]')).toBeVisible();
    await expect(page.locator('header.site nav a[href="/pricing"]')).toBeVisible();
    await expect(page.locator('header.site nav a.cta[href="/auth/login"]')).toBeVisible();
  }
});

test('active nav highlighting works correctly', async ({ page }) => {
  const pageToActiveNav = {
    '/': null, // Home doesn't have active state in current design
    '/pricing': 'pricing',
    '/guide/budget-buckets-method': 'guide', 
    '/calculators': 'calculators'
  };
  
  for (const [pagePath, expectedActive] of Object.entries(pageToActiveNav)) {
    await page.goto(pagePath);
    
    if (expectedActive) {
      // Check that the correct nav item has active class
      const activeNavItem = page.locator(`header.site nav a.active`);
      await expect(activeNavItem).toBeVisible();
      
      // Verify it's the expected nav item by checking the href or text
      const href = await activeNavItem.getAttribute('href');
      if (expectedActive === 'pricing') {
        expect(href).toBe('/pricing');
      } else if (expectedActive === 'guide') {
        expect(href).toBe('/guide/budget-buckets-method');
      } else if (expectedActive === 'calculators') {
        expect(href).toBe('/calculators');
      }
    }
  }
});

test('header brand logo links to home', async ({ page }) => {
  await page.goto('/pricing');
  
  // Click the brand logo
  await page.locator('header.site .brand').click();
  
  // Should navigate to home page
  await expect(page).toHaveURL('/');
  
  // Should see home page content
  await expect(page.locator('h1')).toContainText('fortnight');
});

test('header is sticky and visible on scroll', async ({ page }) => {
  await page.goto('/');
  
  // Get initial header position
  const header = page.locator('header.site');
  await expect(header).toBeVisible();
  
  // Scroll down
  await page.evaluate(() => window.scrollBy(0, 1000));
  
  // Header should still be visible (sticky)
  await expect(header).toBeVisible();
  
  // Check that header has sticky positioning
  const position = await header.evaluate(el => getComputedStyle(el).position);
  expect(position).toBe('sticky');
});

test('CTA button leads to login page', async ({ page }) => {
  await page.goto('/');
  
  // Click the Login CTA button
  await page.locator('header.site nav a.cta[href="/auth/login"]').click();
  
  // Should navigate to login page
  await expect(page).toHaveURL('/auth/login');
  
  // Should see login form
  await expect(page.locator('form[name="login"]')).toBeVisible();
});

test('responsive header works on mobile', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  
  await page.goto('/');
  
  // Header should still be visible
  await expect(page.locator('header.site')).toBeVisible();
  
  // Navigation should adapt to mobile layout
  const nav = page.locator('header.site .nav');
  await expect(nav).toBeVisible();
  
  // Brand should be visible
  await expect(page.locator('header.site .brand')).toBeVisible();
});