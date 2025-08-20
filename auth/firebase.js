/**
 * Firebase v10+ Modular SDK Setup for Budget Buckets
 * Handles auth, Firestore with emulator support and long-polling fallback
 */

// Import Firebase v10+ modular SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { 
  getAuth, 
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

// Firebase configuration (from existing config)
const firebaseConfig = {
  apiKey: "AIzaSyAyQnI3I5IRm2MZ16ttVaaA-8bneE3lWeo",
  authDomain: "budgetbuckets-79b3b.firebaseapp.com", 
  projectId: "budgetbuckets-79b3b",
  storageBucket: "budgetbuckets-79b3b.firebasestorage.app",
  messagingSenderId: "268145092645",
  appId: "1:268145092645:web:cef8d22a972fd3081577cc",
  measurementId: "G-G743JKN6TJ"
};

// Environment configuration with manual override support
function determineEnvironment() {
  const manualOverride = localStorage.getItem('firebase-environment');
  
  if (manualOverride === 'production') {
    return false; // Force production
  } else if (manualOverride === 'emulators') {
    return true; // Force emulators
  }
  
  // Auto-detect based on URL
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.port === '5000' ||
         window.location.search.includes('emulator=true');
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global auth state
let currentUser = null;
let authStateReady = false;
const authReadyPromise = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    currentUser = user;
    authStateReady = true;
    console.log(`🔐 Auth state changed: ${user ? `User ${user.uid}` : 'No user'}`);
    resolve(user);
    unsubscribe();
  });
});

// Initialize emulators if needed (must be done before any auth/db operations)
let emulatorsInitialized = false;
async function initializeEmulators() {
  if (!USE_EMULATORS || emulatorsInitialized) return;
  
  try {
    // Connect auth emulator
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log('🔐 Connected to Auth Emulator');
    
    // Connect Firestore emulator  
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('🔥 Connected to Firestore Emulator');
    
    emulatorsInitialized = true;
  } catch (error) {
    console.warn('⚠️ Emulator connection failed (may already be connected):', error.message);
    emulatorsInitialized = true; // Don't keep trying
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
async function initializeAuth() {
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
    await initializeAuth();
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

  // Check if user is authenticated
  isAuthenticated() {
    return !!currentUser;
  },

  // Get user ID token
  async getIdToken() {
    const user = await this.waitForAuth();
    if (!user) throw new Error('User not authenticated');
    return await user.getIdToken();
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
      
      // Try popup first, fallback to redirect if it fails
      try {
        const result = await retryAuthOperation(
          () => signInWithPopup(auth, provider)
        );
        currentUser = result.user;
        console.log('✅ Google sign-in successful:', result.user.uid);
        return result.user;
      } catch (popupError) {
        console.log('🔄 Popup failed, trying redirect method...');
        await signInWithRedirect(auth, provider);
        // The redirect will handle the rest
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