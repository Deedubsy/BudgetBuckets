/**
 * Firebase v10+ Modular SDK Setup for Budget Buckets
 * Handles auth, Firestore with emulator support and long-polling fallback
 */

// Import Firebase v10+ modular SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { 
  getAuth, 
  initializeAuth,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { 
  getFirestore, 
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork,
  doc,
  collection,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  writeBatch,
  enableMultiTabIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

// Determine auth domain based on environment
function getAuthDomain() {
  const hostname = window.location.hostname;
  const authDomain = 'budgetbuckets-79b3b.firebaseapp.com'; // Always use Firebase default domain
  
  console.log('🔧 Firebase Auth Domain Configuration:');
  console.log(`  Current hostname: ${hostname}`);
  console.log(`  Selected authDomain: ${authDomain}`);
  
  return authDomain;
}

// Firebase configuration (from existing config)
const firebaseConfig = {
  apiKey: "AIzaSyAyQnI3I5IRm2MZ16ttVaaA-8bneE3lWeo",
  authDomain: getAuthDomain(), // Dynamic auth domain based on environment
  projectId: "budgetbuckets-79b3b",
  storageBucket: "budgetbuckets-79b3b.firebasestorage.app",
  messagingSenderId: "268145092645",
  appId: "1:268145092645:web:cef8d22a972fd3081577cc",
  measurementId: "G-G743JKN6TJ"
};

// Environment configuration with manual override support
function determineEnvironment() {
  const manualOverride = localStorage.getItem('firebase-environment');
  
  console.log('🔍 Environment determination:');
  console.log('  - manualOverride:', manualOverride);
  console.log('  - window.location.hostname:', window.location.hostname);
  console.log('  - window.location.search:', window.location.search);
  
  if (manualOverride === 'production') {
    console.log('  → FORCED PRODUCTION via localStorage');
    return false; // Force production
  } else if (manualOverride === 'emulators') {
    console.log('  → FORCED EMULATORS via localStorage');
    return true; // Force emulators
  }
  
  // Check URL parameter
  if (window.location.search.includes('emulator=true')) {
    console.log('  → EMULATORS via URL parameter');
    return true;
  }
  
  // For local development, default to production Firebase
  console.log('  → DEFAULT: PRODUCTION (localhost uses production Firebase)');
  return false;
}

const USE_EMULATORS = determineEnvironment();

// Standalone retry function for auth operations
async function retryAuthOperation(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Auth operation failed (attempt ${attempt}/${maxRetries}):`, error.code);
      
      // Check if this is a retryable error
      const retryableErrors = [
        'auth/visibility-check-was-unavailable.-please-retry-the-request-and-contact-support-if-the-problem-persists',
        'auth/network-request-failed',
        'auth/too-many-requests'
      ];
      
      const shouldRetry = retryableErrors.some(code => error.code?.includes(code));
      
      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff delay
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

console.log(`🔥 Firebase Environment: ${USE_EMULATORS ? 'EMULATORS' : 'PRODUCTION'}`);
console.log(`🌐 Current URL: ${window.location.href}`);
console.log(`🏠 Hostname: ${window.location.hostname}`);
console.log(`🔌 Port: ${window.location.port}`);
console.log(`📡 Online status: ${navigator.onLine ? 'Online' : 'Offline'}`);
console.log(`💾 Manual override: ${localStorage.getItem('firebase-environment') || 'none'}`);
console.log(`⚙️ Will try to connect emulators: ${USE_EMULATORS}`);

if (USE_EMULATORS) {
  console.warn('🚨 EMULATOR MODE: Will try to connect to Auth:9099 and Firestore:8081');
} else {
  console.log('✅ PRODUCTION MODE: Will use real Firebase services');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
});
const db = getFirestore(app);

// Global auth state
let currentUser = null;
let authStateReady = false;
let authStateChangeCount = 0;
const authReadyPromise = new Promise((resolve) => {
  let hasResolved = false;
  onAuthStateChanged(auth, (user) => {
    authStateChangeCount++;
    const previousUser = currentUser;
    currentUser = user;
    authStateReady = true;
    
    console.log(`🔐 Auth state changed (${authStateChangeCount}): ${user ? `User ${user.uid}` : 'No user'}`);
    if (previousUser && !user) {
      console.warn('⚠️ User was logged out - this might indicate a token issue');
    }
    
    // Only resolve the first time, but keep listening for state changes
    if (!hasResolved) {
      hasResolved = true;
      resolve(user);
    }
  });
});

// Initialize emulators if needed (must be done before any auth/db operations)
let emulatorsInitialized = false;
async function initializeEmulators() {
  if (!USE_EMULATORS) {
    console.log('⏩ Skipping emulator initialization - using production Firebase');
    return;
  }
  
  if (emulatorsInitialized) {
    console.log('⏩ Emulators already initialized');
    return;
  }
  
  try {
    console.log('🔧 Attempting to connect to Firebase emulators...');
    
    // Connect auth emulator
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log('🔐 Connected to Auth Emulator on localhost:9099');
    
    // Connect Firestore emulator  
    connectFirestoreEmulator(db, 'localhost', 8081);
    console.log('🔥 Connected to Firestore Emulator on localhost:8081');
    
    emulatorsInitialized = true;
    console.log('✅ Emulator initialization complete');
  } catch (error) {
    console.error('❌ Emulator connection failed:', error.message);
    console.error('💡 Make sure to run: firebase emulators:start');
    emulatorsInitialized = true; // Don't keep trying
    throw new Error(`Emulator connection failed: ${error.message}`);
  }
}

// Enable long-polling for network-restricted environments
async function configureLongPolling() {
  try {
    // Enable offline persistence for better reliability
    if (!USE_EMULATORS) {
      await enableMultiTabIndexedDbPersistence(db);
      console.log('🔄 Enabled Firestore offline persistence');
    }
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Multiple tabs open, persistence only available in one tab');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Browser doesn\'t support persistence');
    } else {
      console.warn('⚠️ Persistence setup failed:', err);
    }
  }
}

// Set auth persistence
async function initializeAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log('🔐 Auth persistence enabled');
  } catch (error) {
    console.warn('⚠️ Auth persistence failed:', error);
  }
}

// Initialize Firebase services with network error handling
async function initializeFirebase() {
  console.log('🚀 Initializing Firebase...');
  
  // Check network connectivity first
  if (!navigator.onLine) {
    console.warn('⚠️ Device appears to be offline');
    throw new Error('No internet connection detected. Please check your network.');
  }
  
  try {
    await initializeEmulators();
    await initializeAuthPersistence();
    await configureLongPolling();
    
    // Check for redirect result from Google OAuth
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        console.log('✅ Google redirect sign-in successful:', result.user.uid);
        currentUser = result.user;
      }
    } catch (error) {
      console.warn('⚠️ Redirect result check failed:', error);
    }
    
    // Wait for auth state with timeout
    const authPromise = Promise.race([
      authReadyPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth initialization timeout')), 10000)
      )
    ]);
    
    await authPromise;
    
    console.log('✅ Firebase initialization complete');
    return { auth, db, currentUser };
  } catch (error) {
    console.error('💥 Firebase initialization failed:', error);
    
    // Provide specific error guidance
    if (error.code === 'auth/network-request-failed') {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    } else if (error.message.includes('timeout')) {
      throw new Error('Firebase services are taking too long to respond. Please try again.');
    } else if (error.code === 'auth/api-key-not-valid') {
      throw new Error('Invalid Firebase API key. Please check your configuration.');
    } else {
      throw new Error(`Firebase setup failed: ${error.message}`);
    }
  }
}

// Auth helper functions
const authHelpers = {
  // Wait for auth to be ready
  async waitForAuth() {
    if (!authStateReady) {
      await authReadyPromise;
    }
    return currentUser;
  },

  // Get current user (sync)
  getCurrentUser() {
    return currentUser;
  },

  // Get complete user data including subscription status from Firestore
  async getCompleteUserData() {
    const user = await this.waitForAuth();
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Get Firestore user document
      const { doc, getDoc, getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      // Combine Firebase Auth user with Firestore data
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};
      
      return {
        // Firebase Auth properties
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        providerData: user.providerData,
        
        // Firestore properties
        plan: userData.plan || 'Free',
        planSelected: userData.planSelected || false,
        subscriptionId: userData.subscriptionId,
        stripeCustomerId: userData.stripeCustomerId,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      };
    } catch (error) {
      console.error('Error loading complete user data:', error);
      // Return basic auth user data if Firestore fails
      return {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        providerData: user.providerData,
        plan: 'Free',
        planSelected: false
      };
    }
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!currentUser;
  },

  // Get user ID token
  async getIdToken() {
    const user = await this.waitForAuth();
    if (!user) throw new Error('User not authenticated');
    try {
      return await user.getIdToken();
    } catch (error) {
      console.warn('getIdToken failed, but not retrying to avoid loops:', error.code);
      throw error;
    }
  },

  // Sign in with email/password
  async signInWithEmail(email, password) {
    try {
      console.log('🔐 Signing in with email:', email);
      const result = await retryAuthOperation(
        () => signInWithEmailAndPassword(auth, email, password)
      );
      currentUser = result.user;
      console.log('✅ Email sign-in successful:', result.user.uid);
      return result.user;
    } catch (error) {
      console.error('❌ Email sign-in failed:', error);
      throw this.getAuthError(error);
    }
  },

  // Create account with email/password
  async createAccount(email, password) {
    try {
      console.log('🔐 Creating account for:', email);
      const result = await retryAuthOperation(
        () => createUserWithEmailAndPassword(auth, email, password)
      );
      currentUser = result.user;
      console.log('✅ Account created:', result.user.uid);
      return result.user;
    } catch (error) {
      console.error('❌ Account creation failed:', error);
      throw this.getAuthError(error);
    }
  },

  // Sign in with Google
  async signInWithGoogle() {
    try {
      console.log('🔐 Starting Google sign-in...');
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account', nonce: Date.now().toString() });

      // Try popup first from a direct user click handler
      try {
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        console.log('✅ Google sign-in successful:', result.user.uid);
        return result.user;
      } catch (popupError) {
        console.log('🔄 Popup failed:', popupError.code, popupError.message);

        // Do not auto-redirect if user closed the popup
        if (popupError.code === 'auth/popup-closed-by-user') {
          console.log('💡 User closed the popup. No redirect fallback.');
          throw popupError;
        }

        // Redirect only when popup is blocked or not supported
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/operation-not-supported-in-this-environment') {
          console.log('🚫 Popup blocked/unsupported. Falling back to redirect…');
        } else {
          console.log('🔄 Non-blocking popup error; attempting redirect fallback…');
        }

        await signInWithRedirect(auth, provider);
        return null;
      }
    } catch (error) {
      console.error('❌ Google sign-in failed:', error);
      throw this.getAuthError(error);
    }
  },

  // Send password reset email
  async resetPassword(email) {
    try {
      console.log('📧 Sending password reset to:', email);
      await retryAuthOperation(
        () => sendPasswordResetEmail(auth, email)
      );
      console.log('✅ Password reset email sent');
    } catch (error) {
      console.error('❌ Password reset failed:', error);
      throw this.getAuthError(error);
    }
  },

  // Send email verification
  async sendEmailVerification(user, actionCodeSettings) {
    const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
    try {
      console.log('📧 Sending email verification to:', user.email);
      await retryAuthOperation(
        () => sendEmailVerification(user, actionCodeSettings)
      );
      console.log('✅ Email verification sent');
    } catch (error) {
      console.error('❌ Email verification failed:', error);
      throw this.getAuthError(error);
    }
  },

  // Sign out
  async signOut() {
    try {
      console.log('🔐 Signing out...');
      await signOut(auth);
      currentUser = null;
      console.log('✅ Sign-out successful');
    } catch (error) {
      console.error('❌ Sign-out failed:', error);
      throw error;
    }
  },

  // Get user-friendly error message
  getAuthError(error) {
    const friendlyMessages = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password should be at least 8 characters long.',
      'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
      'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/visibility-check-was-unavailable.-please-retry-the-request-and-contact-support-if-the-problem-persists': 'Temporary authentication issue. Please try again in a moment.',
      'auth/too-many-requests': 'Too many email requests. Please wait before trying again.',
      'auth/user-token-expired': 'Your session has expired. Please sign out and sign in again.',
    };

    const message = friendlyMessages[error.code] || error.message || 'Authentication failed';
    return new Error(message);
  }
};

// Firestore helper functions
const firestoreHelpers = {
  // Get server timestamp
  serverTimestamp,
  
  // Create document reference
  doc: (path, ...pathSegments) => doc(db, path, ...pathSegments),
  
  // Create collection reference  
  collection: (path, ...pathSegments) => collection(db, path, ...pathSegments),
  
  // Database instance
  db,
  
  // Query helpers
  query,
  orderBy,
  limit,
  where,
  
  // Document operations
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  
  // Batch operations
  writeBatch: () => writeBatch(db),
  
  // Network control
  enableNetwork: () => enableNetwork(db),
  disableNetwork: () => disableNetwork(db)
};

// Export everything
window.firebase = {
  app,
  auth,
  db,
  authHelpers,
  firestoreHelpers,
  initializeFirebase,
  USE_EMULATORS
};

// Auto-initialize with retry logic
async function autoInitialize() {
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 2000;
  
  while (retryCount < maxRetries) {
    try {
      await initializeFirebase();
      break; // Success, exit retry loop
    } catch (error) {
      retryCount++;
      console.error(`💥 Firebase initialization failed (attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount >= maxRetries) {
        console.error('🚨 Firebase initialization failed after all retries. Manual intervention required.');
        
        // Fire a global event for the UI to handle
        window.dispatchEvent(new CustomEvent('firebaseInitFailed', {
          detail: { 
            error: error.message,
            retries: retryCount,
            troubleshootUrl: '/test/network-diagnostic.html?autorun=true'
          }
        }));
        
        throw error;
      } else {
        console.log(`⏳ Retrying Firebase initialization in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

autoInitialize();

export {
  app,
  auth, 
  db,
  authHelpers,
  firestoreHelpers,
  initializeFirebase,
  USE_EMULATORS
};