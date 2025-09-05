/**
 * Authentication Test Helpers
 * 
 * Utilities for testing Google OAuth and Firebase Authentication flows
 * without requiring real OAuth credentials or external service dependencies.
 */

export class GoogleAuthTestHelper {
  /**
   * Mock successful Google OAuth authentication
   * @param {Page} page - Playwright page object
   * @param {Object} userOptions - Mock user data options
   */
  static async mockSuccessfulGoogleAuth(page, userOptions = {}) {
    const mockUser = {
      uid: userOptions.uid || `test-user-${Date.now()}`,
      email: userOptions.email || 'testuser@gmail.com',
      displayName: userOptions.displayName || 'Test User',
      photoURL: userOptions.photoURL || 'https://lh3.googleusercontent.com/a/test-photo',
      emailVerified: userOptions.emailVerified !== false,
      isAnonymous: false,
      providerId: 'google.com',
      ...userOptions
    };

    await page.addInitScript((user) => {
      // Mock Firebase Auth success
      window.mockAuthSuccess = true;
      window.mockUserData = user;
      
      // Override signInWithPopup to return our mock user
      if (window.firebase && window.firebase.auth) {
        const originalSignInWithPopup = window.firebase.auth.signInWithPopup;
        window.firebase.auth.signInWithPopup = async (provider) => {
          console.log('🧪 Mock: Google sign-in successful:', user.uid);
          return {
            user: user,
            credential: {
              providerId: 'google.com',
              signInMethod: 'popup',
              accessToken: 'mock-access-token'
            },
            operationType: 'signIn'
          };
        };
      }
    }, mockUser);

    return mockUser;
  }

  /**
   * Mock Google OAuth popup being blocked
   * @param {Page} page - Playwright page object
   */
  static async mockPopupBlocked(page) {
    await page.addInitScript(() => {
      // Override signInWithPopup to throw popup blocked error
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth.signInWithPopup = async () => {
          const error = new Error('Popup blocked');
          error.code = 'auth/popup-blocked';
          throw error;
        };
      }
    });
  }

  /**
   * Mock user closing the OAuth popup
   * @param {Page} page - Playwright page object
   */
  static async mockPopupClosedByUser(page) {
    await page.addInitScript(() => {
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth.signInWithPopup = async () => {
          const error = new Error('The popup has been closed by the user before finalizing the operation.');
          error.code = 'auth/popup-closed-by-user';
          throw error;
        };
      }
    });
  }

  /**
   * Mock network failure during Google OAuth
   * @param {Page} page - Playwright page object
   */
  static async mockNetworkFailure(page) {
    await page.addInitScript(() => {
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth.signInWithPopup = async () => {
          const error = new Error('Network request failed');
          error.code = 'auth/network-request-failed';
          throw error;
        };
      }
    });
  }

  /**
   * Mock existing user authentication (should go to app)
   * @param {Page} page - Playwright page object
   * @param {Object} userOptions - Existing user data
   */
  static async mockExistingUserAuth(page, userOptions = {}) {
    const existingUser = await this.mockSuccessfulGoogleAuth(page, {
      uid: 'existing-user-123',
      email: 'existing@gmail.com',
      displayName: 'Existing User',
      plan: 'Plus',
      planSelected: true,
      ...userOptions
    });

    // Mock Firestore user document exists
    await page.addInitScript((user) => {
      window.mockUserDocExists = true;
      window.mockExistingUserData = {
        plan: user.plan,
        planSelected: user.planSelected,
        createdAt: new Date('2024-01-01'),
        email: user.email
      };
    }, existingUser);

    return existingUser;
  }

  /**
   * Mock new user authentication (should go to plan selection)
   * @param {Page} page - Playwright page object
   * @param {Object} userOptions - New user data
   */
  static async mockNewUserAuth(page, userOptions = {}) {
    const newUser = await this.mockSuccessfulGoogleAuth(page, {
      uid: 'new-user-456',
      email: 'newuser@gmail.com',
      displayName: 'New User',
      plan: 'Free',
      planSelected: false,
      ...userOptions
    });

    // Mock Firestore user document doesn't exist
    await page.addInitScript(() => {
      window.mockUserDocExists = false;
      window.mockIsNewUser = true;
    });

    return newUser;
  }

  /**
   * Wait for authentication to complete and redirect
   * @param {Page} page - Playwright page object
   * @param {string} expectedRedirect - Expected redirect URL pattern
   * @param {number} timeout - Maximum wait time in ms
   */
  static async waitForAuthRedirect(page, expectedRedirect = '/app', timeout = 5000) {
    try {
      await page.waitForURL(`**${expectedRedirect}**`, { timeout });
      return true;
    } catch (error) {
      console.warn(`Auth redirect to ${expectedRedirect} not detected within ${timeout}ms`);
      return false;
    }
  }

  /**
   * Verify user session is established
   * @param {Page} page - Playwright page object
   */
  static async verifyUserSession(page) {
    const sessionInfo = await page.evaluate(() => {
      return {
        hasFirebaseUser: !!window.firebase?.auth?.currentUser,
        hasAuthHelpers: !!window.authHelpers,
        currentUrl: window.location.href,
        localStorage: {
          hasFirebaseAuth: !!localStorage.getItem('firebase:authUser:AIzaSyAyQnI3I5IRm2MZ16ttVaaA-8bneE3lWeo:[DEFAULT]'),
          keys: Object.keys(localStorage)
        }
      };
    });

    return sessionInfo;
  }

  /**
   * Monitor authentication console messages
   * @param {Page} page - Playwright page object
   */
  static monitorAuthMessages(page) {
    const authMessages = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🔐') || 
          text.includes('Google sign-in') ||
          text.includes('auth') ||
          text.includes('Firebase') ||
          text.includes('OAuth')) {
        authMessages.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
      }
    });

    return authMessages;
  }

  /**
   * Clear authentication state
   * @param {Page} page - Playwright page object
   */
  static async clearAuthState(page) {
    await page.evaluate(() => {
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear cookies
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
      
      // Sign out from Firebase if available
      if (window.firebase && window.firebase.auth && window.firebase.auth.currentUser) {
        window.firebase.auth.signOut();
      }
    });
  }
}

/**
 * Firebase Test Helpers
 */
export class FirebaseTestHelper {
  /**
   * Check if Firebase is properly initialized
   * @param {Page} page - Playwright page object
   */
  static async verifyFirebaseInit(page) {
    return await page.evaluate(() => {
      return {
        hasFirebase: typeof window.firebase !== 'undefined',
        hasAuth: !!window.firebase?.auth,
        hasFirestore: !!window.firebase?.db,
        hasConfig: !!window.firebase?.app?.options,
        authReady: !!window.authHelpers,
        authMethods: window.authHelpers ? Object.keys(window.authHelpers) : []
      };
    });
  }

  /**
   * Mock Firestore document operations
   * @param {Page} page - Playwright page object
   * @param {Object} mockData - Mock document data
   */
  static async mockFirestoreDoc(page, mockData) {
    await page.addInitScript((data) => {
      window.mockFirestoreData = data;
      
      // Mock common Firestore operations
      if (window.firebase && window.firebase.db) {
        const originalDoc = window.firebase.db.doc;
        window.firebase.db.doc = (path) => {
          return {
            get: async () => ({
              exists: data.exists !== false,
              data: () => data.data || data,
              id: path.split('/').pop()
            }),
            set: async (newData) => {
              console.log('🧪 Mock Firestore set:', path, newData);
              return Promise.resolve();
            }
          };
        };
      }
    }, mockData);
  }

  /**
   * Monitor Firebase Auth state changes
   * @param {Page} page - Playwright page object
   */
  static monitorAuthStateChanges(page) {
    const stateChanges = [];
    
    return page.addInitScript(() => {
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth.onAuthStateChanged((user) => {
          window.mockAuthStateChanges = window.mockAuthStateChanges || [];
          window.mockAuthStateChanges.push({
            user: user ? {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName
            } : null,
            timestamp: new Date().toISOString()
          });
          console.log('🧪 Auth state changed:', user ? user.uid : 'signed out');
        });
      }
    });
  }
}

/**
 * Test Environment Helpers
 */
export class TestEnvironmentHelper {
  /**
   * Detect if running in Firebase emulator environment
   * @param {Page} page - Playwright page object
   */
  static async isEmulatorEnvironment(page) {
    return await page.evaluate(() => {
      const hostname = window.location.hostname;
      const port = window.location.port;
      return hostname === 'localhost' && (port === '8080' || port === '8081');
    });
  }

  /**
   * Setup test environment with proper CSP and permissions
   * @param {Page} page - Playwright page object
   */
  static async setupTestEnvironment(page) {
    // Grant necessary permissions for testing
    const context = page.context();
    await context.grantPermissions(['camera', 'microphone'], { origin: page.url() });
    
    // Disable security features that might interfere with testing
    await page.addInitScript(() => {
      // Disable popup blockers for testing
      window.originalAlert = window.alert;
      window.alert = () => {}; // Suppress alerts during tests
      
      // Mock window.open to prevent actual popups during tests
      window.originalOpen = window.open;
      window.testModeOpen = window.open;
    });
  }

  /**
   * Wait for page to be fully loaded with all scripts
   * @param {Page} page - Playwright page object
   */
  static async waitForPageReady(page) {
    await page.waitForLoadState('networkidle');
    
    // Wait for Firebase to be initialized
    await page.waitForFunction(() => {
      return typeof window.firebase !== 'undefined' && 
             window.firebase.auth && 
             window.authHelpers;
    }, { timeout: 10000 });
  }
}