// Debug popup testing functionality
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';

// Custom console for page logging
const pageConsole = {
    log: (...args) => {
        const div = document.createElement('div');
        div.className = 'log';
        div.textContent = args.join(' ');
        document.getElementById('debugConsole').appendChild(div);
        window.console.log(...args);
    },
    error: (...args) => {
        const div = document.createElement('div');
        div.className = 'log error';
        div.textContent = 'ERROR: ' + args.join(' ');
        document.getElementById('debugConsole').appendChild(div);
        window.console.error(...args);
    },
    warn: (...args) => {
        const div = document.createElement('div');
        div.className = 'log';
        div.textContent = 'WARN: ' + args.join(' ');
        document.getElementById('debugConsole').appendChild(div);
        window.console.warn(...args);
    }
};

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAyQnI3I5IRm2MZ16ttVaaA-8bneE3lWeo",
    authDomain: "budgetbuckets-79b3b.firebaseapp.com",
    projectId: "budgetbuckets-79b3b",
    storageBucket: "budgetbuckets-79b3b.firebasestorage.app",
    messagingSenderId: "268145092645",
    appId: "1:268145092645:web:cef8d22a972fd3081577cc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

pageConsole.log('🔥 Firebase initialized for debugging');

// Test functions
function testFlag() {
    pageConsole.log('Current auth flow flag:', window.__authFlowInProgress);
    window.__authFlowInProgress = true;
    pageConsole.log('Set flag to true:', window.__authFlowInProgress);
    setTimeout(() => {
        window.__authFlowInProgress = false;
        pageConsole.log('Reset flag to false:', window.__authFlowInProgress);
    }, 3000);
}

async function testPopup() {
    try {
        pageConsole.log('🔐 Testing raw Google popup...');
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        pageConsole.log('About to call signInWithPopup directly...');
        const result = await signInWithPopup(auth, provider);
        pageConsole.log('✅ SUCCESS: User signed in:', result.user.email);
    } catch (error) {
        pageConsole.error('❌ FAILED:', error.code, error.message);
    }
}

async function testRedirect() {
    try {
        pageConsole.log('🔄 Testing Google redirect...');
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({ prompt: 'select_account', nonce: Date.now().toString() });
        
        // Check if there's a redirect result first
        const result = await getRedirectResult(auth);
        if (result) {
            pageConsole.log('✅ REDIRECT SUCCESS: User signed in:', result.user.email);
            return;
        }
        
        pageConsole.log('About to call signInWithRedirect...');
        await signInWithRedirect(auth, provider);
        pageConsole.log('Redirect initiated - page will navigate...');
    } catch (error) {
        pageConsole.error('❌ REDIRECT FAILED:', error.code, error.message);
    }
}

async function testWithGuard() {
    try {
        pageConsole.log('🛡️ Testing with guard protection...');
        
        // Set flag
        window.__authFlowInProgress = true;
        pageConsole.log('Flag set:', window.__authFlowInProgress);
        
        // Import guard helpers
        const { authGuard } = await import('./guard.js');
        pageConsole.log('Guard imported');
        
        // Test guard protection
        const shouldSkip = authGuard.constructor.prototype.noopIfAuthFlowInProgress?.('test');
        pageConsole.log('Guard should skip:', shouldSkip);
        
        // Try popup
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        pageConsole.log('✅ SUCCESS with guard protection:', result.user.email);
        
    } catch (error) {
        pageConsole.error('❌ FAILED with guard:', error.code, error.message);
    } finally {
        window.__authFlowInProgress = false;
        pageConsole.log('Flag cleared');
    }
}

function clearConsole() {
    document.getElementById('debugConsole').innerHTML = '';
}

// Setup event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('testFlag').addEventListener('click', testFlag);
    document.getElementById('testPopup').addEventListener('click', testPopup);
    document.getElementById('testRedirect').addEventListener('click', testRedirect);
    document.getElementById('testWithGuard').addEventListener('click', testWithGuard);
    document.getElementById('clearConsole').addEventListener('click', clearConsole);
});

// Monitor auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        pageConsole.log('🔐 Auth state: User signed in -', user.email);
    } else {
        pageConsole.log('🔐 Auth state: No user');
    }
});