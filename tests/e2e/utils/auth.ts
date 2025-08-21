/**
 * Authentication utilities for E2E tests
 */
import { Page, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
}

export function getTestUser(): TestUser {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD environment variables are required');
  }
  
  return { email, password };
}

/**
 * Log in with email/password and assert redirect to /app/index
 */
export async function loginWithEmail(page: Page, user?: TestUser): Promise<void> {
  const testUser = user || getTestUser();
  
  // Navigate to login page
  await page.goto('/auth/login.html');
  await page.waitForLoadState('networkidle');
  
  // Fill login form using stable selectors
  const emailInput = page.getByTestId('login-email')
    .or(page.locator('input[type="email"]'))
    .or(page.locator('#email'));
  
  const passwordInput = page.getByTestId('login-password')
    .or(page.locator('input[type="password"]'))
    .or(page.locator('#password'));
    
  const submitButton = page.getByTestId('login-submit')
    .or(page.locator('button[type="submit"]'))
    .or(page.locator('#loginBtn'))
    .or(page.locator('button:has-text("Login")'))
    .or(page.locator('button:has-text("Sign In")'));
  
  // Wait for form elements to be visible
  await expect(emailInput.first()).toBeVisible();
  await expect(passwordInput.first()).toBeVisible();
  await expect(submitButton.first()).toBeVisible();
  
  // Fill and submit form
  await emailInput.first().fill(testUser.email);
  await passwordInput.first().fill(testUser.password);
  
  // Click submit and wait for navigation
  await Promise.all([
    page.waitForURL('**/app/index.html', { timeout: 15000 }),
    submitButton.first().click()
  ]);
  
  // Assert successful login - should be on app page
  await expect(page).toHaveURL(/\/app\/index/);
  
  // Wait for app to fully load
  await page.waitForLoadState('networkidle');
  
  // Assert account navigation is visible (indicates successful auth)
  const accountNav = page.getByTestId('nav-account')
    .or(page.locator('[data-testid="account"]'))
    .or(page.locator('nav a:has-text("Account")'))
    .or(page.locator('.nav-account'))
    .or(page.locator('#accountBtn'));
  
  await expect(accountNav.first()).toBeVisible({ timeout: 10000 });
}

/**
 * Ensure user is signed out and on login page
 */
export async function ensureSignedOut(page: Page): Promise<void> {
  // Try to go to login page first
  await page.goto('/auth/login.html');
  await page.waitForLoadState('networkidle');
  
  // Check if already logged out (on login page without redirect)
  try {
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
      // Check for login form elements to confirm we're on login page
      const emailInput = page.locator('input[type="email"], #email').first();
      const isOnLoginPage = await emailInput.isVisible({ timeout: 2000 });
      
      if (isOnLoginPage) {
        console.log('✓ Already signed out');
        return;
      }
    }
  } catch (error) {
    // Continue with logout process
  }
  
  // If redirected to app, need to logout
  if (page.url().includes('/app/')) {
    await logout(page);
  }
  
  // Navigate back to login page and verify
  await page.goto('/auth/login.html');
  await page.waitForLoadState('networkidle');
  
  // Verify we're on login page
  const emailInput = page.locator('input[type="email"], #email').first();
  await expect(emailInput).toBeVisible();
}

/**
 * Log out from the application
 */
export async function logout(page: Page): Promise<void> {
  try {
    // Look for logout button with various selectors
    const logoutBtn = page.getByTestId('logout-btn')
      .or(page.locator('[data-testid="logout"]'))
      .or(page.locator('button:has-text("Logout")'))
      .or(page.locator('button:has-text("Sign Out")'))
      .or(page.locator('.logout-btn'))
      .or(page.locator('#logoutBtn'));
    
    // If logout button is visible, click it
    const isLogoutVisible = await logoutBtn.first().isVisible({ timeout: 2000 });
    
    if (isLogoutVisible) {
      await logoutBtn.first().click();
      
      // Wait for redirect to login or home page
      await page.waitForURL(/\/(auth\/login|$)/, { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }
  } catch (error) {
    console.log('Logout button not found or click failed:', error.message);
  }
  
  // Clear any stored authentication state
  await page.evaluate(() => {
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    
    // Clear sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });
  
  // Clear cookies
  await page.context().clearCookies();
}

/**
 * Wait for Firebase auth to be ready
 */
export async function waitForAuthReady(page: Page, timeoutMs = 10000): Promise<boolean> {
  return page.evaluate(
    (timeout) => {
      return new Promise<boolean>((resolve) => {
        const startTime = Date.now();
        
        const checkAuth = () => {
          // Check if Firebase auth is available and initialized
          if (typeof window !== 'undefined' && (window as any).firebase) {
            try {
              const auth = (window as any).firebase.auth();
              if (auth) {
                resolve(true);
                return;
              }
            } catch (error) {
              // Continue checking
            }
          }
          
          // Check if we've exceeded timeout
          if (Date.now() - startTime > timeout) {
            resolve(false);
            return;
          }
          
          // Check again in 100ms
          setTimeout(checkAuth, 100);
        };
        
        checkAuth();
      });
    },
    timeoutMs
  );
}

/**
 * Get current user authentication state
 */
export async function getCurrentUser(page: Page): Promise<any> {
  return page.evaluate(() => {
    if (typeof window !== 'undefined' && (window as any).firebase) {
      try {
        const auth = (window as any).firebase.auth();
        return auth.currentUser;
      } catch (error) {
        return null;
      }
    }
    return null;
  });
}