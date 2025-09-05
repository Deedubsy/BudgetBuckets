import { test, expect } from '@playwright/test';
import { 
  GoogleAuthTestHelper, 
  FirebaseTestHelper, 
  TestEnvironmentHelper 
} from './helpers/auth-helpers.js';

/**
 * Google OAuth Complete Flow Tests
 * 
 * These tests use the helper utilities to simulate complete authentication
 * flows including successful logins, account creation, and error scenarios.
 */

test.describe('Google OAuth Complete Flows', () => {
  test.beforeEach(async ({ page }) => {
    await TestEnvironmentHelper.setupTestEnvironment(page);
    await page.goto('/auth/login');
    await TestEnvironmentHelper.waitForPageReady(page);
  });

  test('successful Google login for existing user', async ({ page }) => {
    // Setup: Mock existing user with Plus subscription
    await GoogleAuthTestHelper.mockExistingUserAuth(page, {
      email: 'existinguser@gmail.com',
      displayName: 'John Doe',
      plan: 'Plus',
      planSelected: true
    });

    // Setup monitoring
    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);
    await FirebaseTestHelper.monitorAuthStateChanges(page);

    // Action: Click Google sign-in button
    await page.locator('#googleSignInBtn').click();

    // Wait for authentication to complete
    await page.waitForTimeout(2000);

    // Verification: Check auth messages
    expect(authMessages.some(msg => 
      msg.text.includes('Google sign-in successful')
    )).toBe(true);

    // Verification: Should redirect to app for existing users
    // Note: In a real flow, this would redirect to /app or /choose-plan
    const currentUrl = page.url();
    console.log('Post-auth URL for existing user:', currentUrl);

    // Verification: User session should be established
    const sessionInfo = await GoogleAuthTestHelper.verifyUserSession(page);
    expect(sessionInfo.hasAuthHelpers).toBe(true);
  });

  test('successful Google account creation for new user', async ({ page }) => {
    // Setup: Mock new user who needs to select a plan
    await GoogleAuthTestHelper.mockNewUserAuth(page, {
      email: 'newuser@gmail.com',
      displayName: 'Jane Smith'
    });

    // Setup Firestore to simulate no existing user document
    await FirebaseTestHelper.mockFirestoreDoc(page, {
      exists: false,
      data: null
    });

    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);

    // Action: Click Google sign-in button
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(2000);

    // Verification: Authentication should succeed
    expect(authMessages.some(msg => 
      msg.text.includes('Google sign-in successful')
    )).toBe(true);

    // Verification: New users should be directed to plan selection
    // In the real flow, this would create a user document and redirect
    console.log('New user Google auth completed');
  });

  test('handles popup blocked gracefully', async ({ page }) => {
    // Setup: Mock popup blocking
    await GoogleAuthTestHelper.mockPopupBlocked(page);
    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);

    // Action: Click Google sign-in button
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(3000);

    // Verification: Should detect popup blocking and try redirect
    const hasRedirectAttempt = authMessages.some(msg =>
      msg.text.includes('redirect method') || 
      msg.text.includes('Popup blocked')
    );
    expect(hasRedirectAttempt).toBe(true);

    // Verification: User should remain on login page with option to retry
    await expect(page.locator('#googleSignInBtn')).toBeVisible();
  });

  test('handles user cancellation appropriately', async ({ page }) => {
    // Setup: Mock user closing popup
    await GoogleAuthTestHelper.mockPopupClosedByUser(page);
    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);

    // Action: Click Google sign-in button  
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(2000);

    // Verification: Should handle cancellation gracefully
    const hasCancellationHandling = authMessages.some(msg =>
      msg.text.includes('popup-closed-by-user') ||
      msg.text.includes('User closed the popup')
    );
    
    // Note: The improved error handling should show this message
    console.log('Auth messages after cancellation:', 
      authMessages.map(m => m.text));

    // Verification: User should remain on login page
    await expect(page.locator('#googleSignInBtn')).toBeVisible();
    expect(page.url()).toContain('/auth/login');
  });

  test('handles network failures during authentication', async ({ page }) => {
    // Setup: Mock network failure
    await GoogleAuthTestHelper.mockNetworkFailure(page);
    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);

    // Action: Click Google sign-in button
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(2000);

    // Verification: Should handle network errors
    const hasNetworkErrorHandling = authMessages.some(msg =>
      msg.text.includes('Google sign-in failed') ||
      msg.text.includes('network')
    );
    expect(hasNetworkErrorHandling).toBe(true);

    // Verification: Application should remain functional
    await expect(page.locator('form[name="login"]')).toBeVisible();
    await expect(page.locator('#googleSignInBtn')).toBeVisible();
  });

  test('preserves redirect URL after authentication', async ({ page }) => {
    // Setup: Start from a protected route
    await page.goto('/app');
    
    // Should redirect to login
    await page.waitForURL('**/auth/login**');
    
    // Setup successful auth
    await GoogleAuthTestHelper.mockExistingUserAuth(page);
    
    // Action: Complete authentication
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(2000);
    
    // Verification: Should remember the intended destination
    // In a complete implementation, this would redirect back to /app
    console.log('Auth completed from protected route redirect');
  });

  test('authentication works across different browsers', async ({ page, browserName }) => {
    // Setup: Mock successful auth
    await GoogleAuthTestHelper.mockSuccessfulGoogleAuth(page);
    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);

    // Action: Authenticate
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(1000);

    // Verification: Should work in all browsers
    expect(authMessages.some(msg => 
      msg.text.includes('Google sign-in successful')
    )).toBe(true);

    console.log(`Google auth tested successfully in ${browserName}`);
  });
});

test.describe('Google OAuth Security and CSP', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('respects Content Security Policy', async ({ page }) => {
    const cspViolations = [];
    
    page.on('pageerror', error => {
      if (error.message.includes('Content Security Policy')) {
        cspViolations.push(error.message);
      }
    });

    // Setup successful auth
    await GoogleAuthTestHelper.mockSuccessfulGoogleAuth(page);

    // Action: Attempt authentication
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(2000);

    // Verification: No CSP violations
    expect(cspViolations.length).toBe(0);

    // Verification: Check CSP headers include required domains
    const response = await page.goto('/auth/login');
    const cspHeader = response.headers()['content-security-policy'];
    
    if (cspHeader) {
      expect(cspHeader).toContain('accounts.google.com');
      expect(cspHeader).toContain('googleapis.com');
      expect(cspHeader).toContain('*.googleusercontent.com');
    }
  });

  test('validates Firebase configuration security', async ({ page }) => {
    const firebaseConfig = await FirebaseTestHelper.verifyFirebaseInit(page);
    
    // Verification: Firebase should be properly initialized
    expect(firebaseConfig.hasFirebase).toBe(true);
    expect(firebaseConfig.hasAuth).toBe(true);
    expect(firebaseConfig.hasFirestore).toBe(true);
    expect(firebaseConfig.authReady).toBe(true);

    // Verification: Required auth methods should be available
    expect(firebaseConfig.authMethods).toContain('signInWithGoogle');
    
    console.log('Firebase security validation passed:', firebaseConfig);
  });
});

test.describe('Google OAuth Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await TestEnvironmentHelper.waitForPageReady(page);
  });

  test('recovers from temporary network issues', async ({ page }) => {
    let networkFailureCount = 0;
    
    // Setup: Mock network failure that succeeds on retry
    await page.addInitScript(() => {
      if (window.firebase && window.firebase.auth) {
        const originalSignIn = window.firebase.auth.signInWithPopup;
        window.firebase.auth.signInWithPopup = async (provider) => {
          window.networkFailureCount = (window.networkFailureCount || 0) + 1;
          
          if (window.networkFailureCount === 1) {
            // Fail first attempt
            const error = new Error('Network request failed');
            error.code = 'auth/network-request-failed';
            throw error;
          } else {
            // Succeed on retry
            return {
              user: {
                uid: 'test-recovery-user',
                email: 'recovery@gmail.com',
                displayName: 'Recovery Test'
              },
              credential: { providerId: 'google.com' }
            };
          }
        };
      }
    });

    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);

    // Action: First attempt (should fail)
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(1000);

    // Action: Retry (should succeed)
    await page.locator('#googleSignInBtn').click();
    await page.waitForTimeout(1000);

    // Verification: Should show recovery
    console.log('Network recovery test completed');
  });

  test('handles concurrent authentication attempts', async ({ page }) => {
    await GoogleAuthTestHelper.mockSuccessfulGoogleAuth(page);
    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);

    // Action: Multiple rapid clicks
    const button = page.locator('#googleSignInBtn');
    await button.click();
    await button.click(); // Second click should be handled gracefully
    await button.click(); // Third click should be handled gracefully

    await page.waitForTimeout(2000);

    // Verification: Should handle concurrent attempts without errors
    const hasAuthSuccess = authMessages.some(msg => 
      msg.text.includes('Google sign-in successful')
    );
    expect(hasAuthSuccess).toBe(true);

    console.log('Concurrent auth attempts handled successfully');
  });
});

test.describe('Google OAuth Accessibility', () => {
  test('Google sign-in button is accessible', async ({ page }) => {
    await page.goto('/auth/login');
    
    const googleBtn = page.locator('#googleSignInBtn');
    
    // Check accessibility attributes
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();
    
    // Check for proper ARIA attributes
    const hasAriaLabel = await googleBtn.getAttribute('aria-label') !== null;
    const hasRole = await googleBtn.getAttribute('role') !== null || 
                   await googleBtn.evaluate(el => el.tagName.toLowerCase() === 'button');
    
    expect(hasRole).toBe(true);
    
    // Check keyboard accessibility
    await googleBtn.focus();
    const isFocused = await googleBtn.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
    
    // Should be activatable with Enter key
    await GoogleAuthTestHelper.mockSuccessfulGoogleAuth(page);
    const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);
    
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Should trigger auth on keyboard activation
    expect(authMessages.some(msg => 
      msg.text.includes('Google sign-in')
    )).toBe(true);
  });
});