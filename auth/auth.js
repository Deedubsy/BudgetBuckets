import { authHelpers } from './firebase.js';

(function() {
    'use strict';

    let authStateReady = false;
    let currentAuthUser = null;

    // Show/hide loading overlay
    function showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    function hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    // Show error/success messages
    function showError(message) {
        const errorEl = document.getElementById('errorMessage');
        const successEl = document.getElementById('successMessage');
        successEl.style.display = 'none';
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => errorEl.style.display = 'none', 5000);
    }

    function showSuccess(message) {
        const errorEl = document.getElementById('errorMessage');
        const successEl = document.getElementById('successMessage');
        errorEl.style.display = 'none';
        successEl.textContent = message;
        successEl.style.display = 'block';
        setTimeout(() => successEl.style.display = 'none', 5000);
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
                document.getElementById(targetTab + 'Form').classList.add('active');
                
                // Clear messages
                document.getElementById('errorMessage').style.display = 'none';
                document.getElementById('successMessage').style.display = 'none';
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

    // Sign in form handler
    async function handleSignIn(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const email = formData.get('email') || document.getElementById('signinEmail').value;
        const password = formData.get('password') || document.getElementById('signinPassword').value;
        
        try {
            validateForm({ email, password });
            
            showLoading();
            const user = await authHelpers.signInWithEmail(email, password);
            
            hideLoading();
            window.location.href = '/app/index.html';
            
        } catch (error) {
            hideLoading();
            console.error('Sign in error:', error);
            showError(error.message);
        }
    }

    // Register form handler
    async function handleRegister(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const email = formData.get('email') || document.getElementById('registerEmail').value;
        const password = formData.get('password') || document.getElementById('registerPassword').value;
        const confirmPassword = formData.get('confirmPassword') || document.getElementById('registerConfirmPassword').value;
        
        try {
            validateForm({ email, password, confirmPassword });
            
            showLoading();
            const user = await authHelpers.createAccount(email, password);
            
            hideLoading();
            window.location.href = '/app/index.html';
            
        } catch (error) {
            hideLoading();
            console.error('Registration error:', error);
            showError(error.message);
        }
    }

    // Google sign in handler
    async function handleGoogleSignIn() {
        try {
            showLoading();
            const user = await authHelpers.signInWithGoogle();
            
            hideLoading();
            window.location.href = '/app/index.html';
            
        } catch (error) {
            hideLoading();
            console.error('Google sign-in error:', error);
            showError(error.message);
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
        document.getElementById('signinForm').addEventListener('submit', handleSignIn);
        document.getElementById('registerForm').addEventListener('submit', handleRegister);
        document.getElementById('resetPasswordForm').addEventListener('submit', handlePasswordReset);
        
        // Google sign-in button
        document.getElementById('googleSignInBtn').addEventListener('click', handleGoogleSignIn);
        
        // Forgot password modal
        const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
        const resetPasswordModal = document.getElementById('resetPasswordModal');
        const cancelResetBtn = document.getElementById('cancelResetBtn');
        
        forgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const email = document.getElementById('signinEmail').value;
            if (email) {
                document.getElementById('resetEmail').value = email;
            }
            resetPasswordModal.showModal();
        });
        
        cancelResetBtn.addEventListener('click', () => {
            resetPasswordModal.close();
        });
        
        // Close modal when clicking outside
        resetPasswordModal.addEventListener('click', (e) => {
            if (e.target === resetPasswordModal) {
                resetPasswordModal.close();
            }
        });
        
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