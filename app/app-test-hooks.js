/**
 * Test hooks for E2E testing
 * Only loaded in non-production environments or with ?e2e=1 parameter
 */

// Only initialize test hooks in appropriate environments
if (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.search.includes('e2e=1') ||
  window.location.hostname.includes('preview') ||
  window.location.hostname.includes('staging')
) {
  console.log('🧪 Initializing E2E test hooks');
  
  window.appTestHooks = {
    /**
     * Refresh Firebase Auth token to get updated custom claims
     */
    async refreshPlan() {
      try {
        console.log('🔄 Refreshing user plan via token refresh...');
        
        // Import Firebase auth
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
        
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user) {
          // Force token refresh to get updated custom claims
          await user.getIdToken(true);
          console.log('✅ Token refreshed successfully');
          
          // Trigger any plan-related UI updates
          if (typeof window.updatePlanUI === 'function') {
            window.updatePlanUI();
          }
          
          // Dispatch custom event for plan refresh
          window.dispatchEvent(new CustomEvent('planRefreshed', {
            detail: { timestamp: Date.now() }
          }));
          
          return true;
        } else {
          console.warn('⚠️ No authenticated user for token refresh');
          return false;
        }
      } catch (error) {
        console.error('❌ Failed to refresh plan:', error);
        throw error;
      }
    },

    /**
     * Get current user plan from custom claims
     */
    async getCurrentPlan() {
      try {
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
        
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user) {
          const idTokenResult = await user.getIdTokenResult();
          return idTokenResult.claims.plan || 'free';
        }
        
        return 'free';
      } catch (error) {
        console.error('Failed to get current plan:', error);
        return 'free';
      }
    },

    /**
     * Wait for authentication to be ready
     */
    async waitForAuth(timeoutMs = 10000) {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkAuth = async () => {
          try {
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
            const auth = getAuth();
            
            if (auth.currentUser) {
              resolve(auth.currentUser);
              return;
            }
            
            // Check timeout
            if (Date.now() - startTime > timeoutMs) {
              reject(new Error('Authentication timeout'));
              return;
            }
            
            // Check again in 100ms
            setTimeout(checkAuth, 100);
          } catch (error) {
            reject(error);
          }
        };
        
        checkAuth();
      });
    },

    /**
     * Simulate bucket addition for testing
     */
    async simulateAddBucket() {
      console.log('🪣 Simulating bucket addition...');
      
      // Look for add bucket functionality
      const addButton = document.querySelector('[data-testid="add-bucket-btn"], .add-bucket-btn, #addBucketBtn');
      
      if (addButton && !addButton.disabled) {
        addButton.click();
        return true;
      } else {
        console.log('Add bucket button not available or disabled');
        return false;
      }
    },

    /**
     * Get current bucket count
     */
    getBucketCount() {
      // Try to find bucket counter element
      const counter = document.querySelector('[data-testid="bucket-counter"], .bucket-counter, .bucket-count');
      
      if (counter) {
        const text = counter.textContent || '';
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
      
      // Fallback: count bucket elements
      const buckets = document.querySelectorAll('.bucket, .expense-bucket, .savings-bucket, [data-bucket]');
      return buckets.length;
    },

    /**
     * Check if upgrade prompt is shown
     */
    hasUpgradePrompt() {
      const promptSelectors = [
        '[data-testid="upgrade-prompt"]',
        '.upgrade-prompt',
        '.limit-reached',
        '.plan-limit-modal'
      ];
      
      return promptSelectors.some(selector => {
        const element = document.querySelector(selector);
        return element && element.offsetParent !== null; // Check if visible
      });
    },

    /**
     * Force UI update for testing
     */
    updateUI() {
      // Dispatch a resize event to trigger responsive updates
      window.dispatchEvent(new Event('resize'));
      
      // Trigger custom UI update event
      window.dispatchEvent(new CustomEvent('testUIUpdate'));
      
      console.log('🔄 UI update triggered');
    }
  };

  // Add visual indicator that test hooks are loaded
  const indicator = document.createElement('div');
  indicator.id = 'e2e-test-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 5px;
    right: 5px;
    background: #00ff00;
    color: #000;
    padding: 2px 6px;
    font-size: 10px;
    z-index: 9999;
    border-radius: 3px;
    font-family: monospace;
    opacity: 0.7;
  `;
  indicator.textContent = 'E2E';
  document.body.appendChild(indicator);

  console.log('✅ E2E test hooks loaded');
  
  // Clean up indicator after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 3000);
}