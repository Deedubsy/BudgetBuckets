import { authHelpers, firestoreHelpers } from '../firebase.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

(function() {
    'use strict';

    let authStateReady = false;
    let currentAuthUser = null;

    // Action code settings for email verification
    const actionCodeSettings = {
        url: `${location.origin}/auth/verify`,
        handleCodeInApp: false
    };

    // Show/hide loading overlay
    function showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    function hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    // Show error/success messages with inline support
    function showError(message, inline = false) {
        if (inline) {
            showInlineError(message);
            return;
        }
        
        const errorEl = document.getElementById('errorMessage');
        const successEl = document.getElementById('successMessage');
        if (successEl) successEl.style.display = 'none';
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            setTimeout(() => errorEl.style.display = 'none', 7000);
        }
    }

    function showSuccess(message) {
        const errorEl = document.getElementById('errorMessage');
        const successEl = document.getElementById('successMessage');
        if (errorEl) errorEl.style.display = 'none';
        if (successEl) {
            successEl.textContent = message;
            successEl.style.display = 'block';
            setTimeout(() => successEl.style.display = 'none', 5000);
        }
    }

    function showInlineError(message) {
        // Remove any existing inline errors
        document.querySelectorAll('.inline-error').forEach(el => el.remove());
        
        // Create new inline error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'inline-error';
        errorDiv.textContent = message;
        
        // Insert after the active form
        const activeForm = document.querySelector('.auth-form.active');
        if (activeForm) {
            activeForm.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 10000);
        }
    }

    // Switch to create account tab with CTA message
    function switchToCreateAccountTab() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const forms = document.querySelectorAll('.auth-form');
        
        // Switch to register tab
        tabButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-tab="register"]').classList.add('active');
        
        forms.forEach(form => form.classList.remove('active'));
        document.getElementById('registerForm').classList.add('active');
        
        // Focus email field and pre-fill if available
        const signinEmail = document.getElementById('signinEmail').value;
        const registerEmail = document.getElementById('registerEmail');
        if (signinEmail && registerEmail) {
            registerEmail.value = signinEmail;
        }
        registerEmail.focus();
        
        showInlineError("Don't have an account yet? Create one here!");
    }

    // Tab switching functionality
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const forms = document.querySelectorAll('.auth-form');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Update tab buttons
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update forms
                forms.forEach(form => form.classList.remove('active'));
                const targetForm = document.getElementById(targetTab === 'signin' ? 'signinForm' : 'registerForm');
                if (targetForm) targetForm.classList.add('active');
                
                // Clear messages
                document.getElementById('errorMessage').style.display = 'none';
                document.getElementById('successMessage').style.display = 'none';
                document.querySelectorAll('.inline-error').forEach(el => el.remove());
            });
        });
    }

    // Form validation
    function validateForm(formData) {
        const { email, password, confirmPassword } = formData;
        
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Please enter a valid email address');
        }
        
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        
        if (confirmPassword !== undefined && password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
    }

    // Sign in form handler (NO account creation on user-not-found)
    async function handleSignIn(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const email = formData.get('email') || document.getElementById('signinEmail').value;
        const password = formData.get('password') || document.getElementById('signinPassword').value;
        
        console.log('🔐 DEBUG: handleSignIn called with email:', email);
        
        try {
            validateForm({ email, password });
            
            showLoading();
            
            console.log('🔐 DEBUG: About to call signInWithEmailAndPassword');
            // Use Firebase Auth directly to get proper error codes
            const { user } = await signInWithEmailAndPassword(window.firebase.auth, email, password);
            console.log('🔐 DEBUG: signInWithEmailAndPassword succeeded, user:', user.uid);
            
            // Check if this is a password provider and email is not verified
            const isPasswordProvider = user.providerData.some(p => p.providerId === 'password');
            if (isPasswordProvider && !user.emailVerified) {
                await signOut(window.firebase.auth);
                hideLoading();
                location.assign(`/auth/verify?email=${encodeURIComponent(email)}`);
                return;
            }
            
            hideLoading();
            location.assign('/auth/choose-plan');
            
        } catch (error) {
            hideLoading();
            console.error('🔐 DEBUG: Sign in error caught:', error);
            console.error('🔐 DEBUG: Error code:', error.code);
            console.error('🔐 DEBUG: Error message:', error.message);
            
            // Handle validation errors (no error.code)
            if (!error.code) {
                console.log('🔐 DEBUG: Validation error, showing inline error');
                showInlineError(error.message);
                return;
            }
            
            // Handle specific Firebase error codes
            if (error.code === 'auth/user-not-found') {
                console.log('🔐 DEBUG: User not found error, switching to create account tab');
                showInlineError("We can't find an account for that email.");
                switchToCreateAccountTab();
            } else if (error.code === 'auth/wrong-password') {
                console.log('🔐 DEBUG: Wrong password error');
                showInlineError('Incorrect password.');
            } else if (error.code === 'auth/too-many-requests') {
                console.log('🔐 DEBUG: Too many requests error');
                showInlineError('Too many attempts. Please wait and try again.');
            } else {
                console.log('🔐 DEBUG: Generic sign in error, code:', error.code);
                showInlineError('Sign in failed. Please try again.');
            }
        }
    }

    // Create account form handler (with verification flow)
    async function handleCreateAccount(event) {
        event.preventDefault();
        
        console.log('🔐 DEBUG: handleCreateAccount called');
        
        const formData = new FormData(event.target);
        const email = formData.get('email') || document.getElementById('registerEmail').value;
        const password = formData.get('password') || document.getElementById('registerPassword').value;
        const confirmPassword = formData.get('confirmPassword') || document.getElementById('registerConfirmPassword').value;
        
        console.log('🔐 DEBUG: Creating account for email:', email);
        
        try {
            validateForm({ email, password, confirmPassword });
            
            showLoading();
            
            // Create the user account
            const { user } = await createUserWithEmailAndPassword(window.firebase.auth, email, password);
            
            // Create user document in Firestore
            await setDoc(doc(window.firebase.db, 'users', user.uid), {
                email,
                createdAt: serverTimestamp(),
                planType: 'free_pending'
            }, { merge: true });
            
            // Send email verification
            await sendEmailVerification(user, actionCodeSettings);
            
            // Sign out and redirect to verification page
            await signOut(window.firebase.auth);
            
            hideLoading();
            location.assign(`/auth/verify?email=${encodeURIComponent(email)}`);
            
        } catch (error) {
            hideLoading();
            console.error('Account creation error:', error);
            
            // Handle validation errors (no error.code)
            if (!error.code) {
                showInlineError(error.message);
                return;
            }
            
            // Handle specific Firebase error codes
            if (error.code === 'auth/email-already-in-use') {
                showInlineError('An account with this email already exists.');
            } else if (error.code === 'auth/weak-password') {
                showInlineError('Password should be at least 8 characters long.');
            } else {
                showInlineError('Account creation failed. Please try again.');
            }
        }
    }

    // Google sign in handler (treated as verified, goes to plan selection)
    async function handleGoogleSignIn() {
        try {
            showLoading();
            const user = await authHelpers.signInWithGoogle();
            
            // For Google users, create user doc if missing and go to plan selection
            if (user) {
                await setDoc(doc(window.firebase.db, 'users', user.uid), {
                    email: user.email,
                    createdAt: serverTimestamp(),
                    planType: 'free_pending'
                }, { merge: true });
                
                hideLoading();
                location.assign('/auth/choose-plan');
            }
            
        } catch (error) {
            hideLoading();
            console.error('Google sign-in error:', error);
            showError('Google sign-in failed. Please try again.');
        }
    }

    // Password reset handler
    async function handlePasswordReset(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const email = formData.get('email') || document.getElementById('resetEmail').value;
        
        if (!email) {
            showError('Please enter your email address');
            return;
        }
        
        try {
            showLoading();
            await authHelpers.resetPassword(email);
            
            hideLoading();
            showSuccess('Password reset email sent! Check your inbox.');
            
            // Close modal
            document.getElementById('resetPasswordModal').close();
            
        } catch (error) {
            hideLoading();
            console.error('Password reset error:', error);
            showError(error.message);
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Form submissions
        const signinForm = document.getElementById('signinForm');
        const registerForm = document.getElementById('registerForm');
        const resetPasswordForm = document.getElementById('resetPasswordForm');
        
        if (signinForm) signinForm.addEventListener('submit', handleSignIn);
        if (registerForm) registerForm.addEventListener('submit', handleCreateAccount);
        if (resetPasswordForm) resetPasswordForm.addEventListener('submit', handlePasswordReset);
        
        // Google sign-in button
        const googleBtn = document.getElementById('googleSignInBtn');
        if (googleBtn) googleBtn.addEventListener('click', handleGoogleSignIn);
        
        // Forgot password modal
        const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
        const resetPasswordModal = document.getElementById('resetPasswordModal');
        const cancelResetBtn = document.getElementById('cancelResetBtn');
        
        if (forgotPasswordBtn && resetPasswordModal) {
            forgotPasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const email = document.getElementById('signinEmail').value;
                if (email) {
                    document.getElementById('resetEmail').value = email;
                }
                resetPasswordModal.showModal();
            });
        }
        
        if (cancelResetBtn && resetPasswordModal) {
            cancelResetBtn.addEventListener('click', () => {
                resetPasswordModal.close();
            });
        }
        
        if (resetPasswordModal) {
            // Close modal when clicking outside
            resetPasswordModal.addEventListener('click', (e) => {
                if (e.target === resetPasswordModal) {
                    resetPasswordModal.close();
                }
            });
        }
        
        // Enter key handling for better UX
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const activeForm = document.querySelector('.auth-form.active');
                if (activeForm && e.target.tagName === 'INPUT') {
                    const inputs = Array.from(activeForm.querySelectorAll('input[type="email"], input[type="password"]'));
                    const currentIndex = inputs.indexOf(e.target);
                    
                    if (currentIndex < inputs.length - 1) {
                        e.preventDefault();
                        inputs[currentIndex + 1].focus();
                    }
                }
            }
        });
    }

    // Initialize the auth system
    async function init() {
        console.log('🔐 Initializing authentication...');
        
        setupTabs();
        setupEventListeners();
        
        // Check if already authenticated (will redirect if true)
        if (window.authGuard) {
            await window.authGuard.redirectIfAuthenticated();
        }
        
        console.log('✅ Authentication system initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();