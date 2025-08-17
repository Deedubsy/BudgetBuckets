/**
 * Route Guards and Auth State Management
 * Ensures authentication before allowing access to protected resources
 */

import { authHelpers } from './firebase.js';

// Route protection with loading states
class AuthGuard {
  constructor() {
    this.loadingElement = null;
    this.isInitialized = false;
  }

  // Show loading overlay during auth checks
  showAuthLoading(message = 'Checking authentication...') {
    if (this.loadingElement) return;
    
    this.loadingElement = document.createElement('div');
    this.loadingElement.id = 'authLoadingOverlay';
    this.loadingElement.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(10, 10, 10, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        color: #e4e4e4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          width: 48px;
          height: 48px;
          border: 3px solid #333;
          border-top-color: #4a9eff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        "></div>
        <p>${message}</p>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </div>
    `;
    
    document.body.appendChild(this.loadingElement);
  }

  // Hide loading overlay
  hideAuthLoading() {
    if (this.loadingElement) {
      this.loadingElement.remove();
      this.loadingElement = null;
    }
  }

  // Require authentication with redirect on failure
  async requireAuth(redirectPath = '/auth/login.html', hideLoadingAfterAuth = false) {
    try {
      this.showAuthLoading('Verifying authentication...');
      
      console.log('🔐 Checking authentication state...');
      
      // Wait for Firebase to initialize and determine auth state
      const user = await authHelpers.waitForAuth();
      
      if (!user) {
        console.log('❌ No authenticated user, redirecting to login');
        this.hideAuthLoading();
        window.location.href = redirectPath;
        return null;
      }
      
      console.log('✅ User authenticated:', user.uid);
      
      // Verify the user can get a valid token
      try {
        await authHelpers.getIdToken();
        console.log('✅ ID token verified');
      } catch (tokenError) {
        console.error('❌ ID token verification failed:', tokenError);
        this.hideAuthLoading();
        window.location.href = redirectPath;
        return null;
      }
      
      // Only hide loading if explicitly requested (for backwards compatibility)
      if (hideLoadingAfterAuth) {
        this.hideAuthLoading();
      }
      return user;
      
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      this.hideAuthLoading();
      this.showError('Authentication failed. Please try signing in again.');
      
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 3000);
      
      return null;
    }
  }

  // Check if user is authenticated (non-blocking)
  isAuthenticated() {
    return authHelpers.isAuthenticated();
  }

  // Get current user (may be null)
  currentUser() {
    return authHelpers.getCurrentUser();
  }

  // Get current user's ID token
  async getIdToken() {
    try {
      return await authHelpers.getIdToken();
    } catch (error) {
      console.error('❌ Failed to get ID token:', error);
      throw new Error('Authentication required');
    }
  }

  // Redirect to app if authenticated (for login pages)
  async redirectIfAuthenticated(appPath = '/app/index.html') {
    try {
      const user = await authHelpers.waitForAuth();
      
      if (user) {
        console.log('✅ User already authenticated, redirecting to app');
        window.location.href = appPath;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Auth check failed during redirect check:', error);
      return false;
    }
  }

  // Show error message
  showError(message, duration = 5000) {
    const errorElement = document.createElement('div');
    errorElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 400px;
      word-wrap: break-word;
    `;
    errorElement.textContent = message;
    
    document.body.appendChild(errorElement);
    
    setTimeout(() => {
      if (errorElement.parentNode) {
        errorElement.remove();
      }
    }, duration);
  }

  // Show success message  
  showSuccess(message, duration = 3000) {
    const successElement = document.createElement('div');
    successElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4ade80;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 400px;
      word-wrap: break-word;
    `;
    successElement.textContent = message;
    
    document.body.appendChild(successElement);
    
    setTimeout(() => {
      if (successElement.parentNode) {
        successElement.remove();
      }
    }, duration);
  }

  // Setup auth state listener for automatic redirects
  setupAuthStateListener(protectedPages = ['/app/']) {
    console.log('🔐 Setting up auth state listener...');
    
    // This should be called on protected pages only
    const currentPath = window.location.pathname;
    const isProtectedPage = protectedPages.some(path => currentPath.includes(path));
    
    if (isProtectedPage) {
      // Automatically redirect if auth state changes to null
      firebase.auth.onAuthStateChanged((user) => {
        if (this.isInitialized && !user) {
          console.log('🔐 Auth state changed to null, redirecting to login');
          window.location.href = '/auth/login.html';
        }
        this.isInitialized = true;
      });
    }
  }

  // Initialize auth guard for current page
  async initialize() {
    const currentPath = window.location.pathname;
    
    console.log(`🔐 Initializing auth guard for: ${currentPath}`);
    
    // Login page - redirect if already authenticated
    if (currentPath.includes('/auth/login.html')) {
      await this.redirectIfAuthenticated();
      return;
    }
    
    // Protected pages - require authentication
    if (currentPath.includes('/app/')) {
      // Don't hide loading after auth - let the app handle it after data loads
      const user = await this.requireAuth('/auth/login.html', false);
      if (user) {
        this.setupAuthStateListener();
      }
      return user;
    }
    
    // Other pages - just wait for auth to initialize
    await authHelpers.waitForAuth();
    return authHelpers.getCurrentUser();
  }
}

// Create singleton instance
const authGuard = new AuthGuard();

// Export for use in other modules
window.authGuard = authGuard;

// Auto-initialize based on current page
document.addEventListener('DOMContentLoaded', () => {
  authGuard.initialize().catch(error => {
    console.error('💥 Auth guard initialization failed:', error);
    authGuard.showError('Authentication system failed to initialize');
  });
});

export {
  authGuard,
  AuthGuard
};