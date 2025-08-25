import { 
    onAuthStateChanged, 
    sendEmailVerification,
    signOut 
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';

(function() {
    'use strict';

    let currentUser = null;
    let checkingVerification = false;

    // Action code settings for email verification
    const actionCodeSettings = {
        url: `${location.origin}/auth/verify`,
        handleCodeInApp: false
    };

    // Get email from URL params
    const urlParams = new URLSearchParams(location.search);
    const targetEmail = urlParams.get('email');

    function showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    function hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    function showError(message) {
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

    function renderVerifyUI() {
        const emailEl = document.getElementById('targetEmail');
        if (emailEl && targetEmail) {
            emailEl.textContent = targetEmail;
        }
    }

    async function resendVerification() {
        try {
            if (!currentUser) {
                showError('Please sign in again to resend verification email.');
                const isTestMode = window.location.search.includes('test=true') || window.location.hostname === 'localhost';
                if (!isTestMode) {
                    setTimeout(() => location.assign('/auth/login'), 2000);
                }
                return;
            }

            showLoading();
            await sendEmailVerification(currentUser, actionCodeSettings);
            hideLoading();
            showSuccess('Verification email sent! Check your inbox.');
        } catch (error) {
            hideLoading();
            console.error('Resend verification error:', error);
            showError('Failed to send verification email. Please try again.');
        }
    }

    async function checkVerificationStatus() {
        try {
            if (!currentUser) {
                showError('Please sign in again.');
                const isTestMode = window.location.search.includes('test=true') || window.location.hostname === 'localhost';
                if (!isTestMode) {
                    setTimeout(() => location.assign('/auth/login'), 2000);
                }
                return;
            }

            if (checkingVerification) return; // Prevent double-clicking
            checkingVerification = true;

            showLoading();
            
            // Force reload the user to get latest emailVerified status
            await currentUser.reload();
            
            if (currentUser.emailVerified) {
                hideLoading();
                location.assign('/auth/choose-plan');
            } else {
                hideLoading();
                showError('Email not verified yet. Please check your inbox and click the verification link.');
            }
        } catch (error) {
            hideLoading();
            console.error('Check verification error:', error);
            showError('Failed to check verification status. Please try again.');
        } finally {
            checkingVerification = false;
        }
    }

    function setupEventListeners() {
        const resendBtn = document.getElementById('resendBtn');
        const checkBtn = document.getElementById('checkVerificationBtn');

        if (resendBtn) {
            resendBtn.addEventListener('click', resendVerification);
        }

        if (checkBtn) {
            checkBtn.addEventListener('click', checkVerificationStatus);
        }
    }

    function init() {
        console.log('📧 Initializing email verification page...');
        
        renderVerifyUI();
        setupEventListeners();

        // Check if this is a test environment
        const isTestMode = window.location.search.includes('test=true') || window.location.hostname === 'localhost';

        // Listen for auth state changes
        onAuthStateChanged(window.firebase.auth, async (user) => {
            console.log('Auth state change:', user ? `User ${user.uid}` : 'No user');
            currentUser = user;
            
            if (!user && !isTestMode) {
                // No user signed in, redirect to login (unless in test mode)
                console.log('No authenticated user, redirecting to login');
                location.assign('/auth/login');
                return;
            }

            // Force reload to get latest verification status
            try {
                await user.reload();
                console.log('User verification status:', user.emailVerified);
                
                if (user.emailVerified) {
                    console.log('Email verified! Redirecting to plan selection...');
                    location.assign('/auth/choose-plan');
                }
            } catch (error) {
                console.error('Failed to reload user:', error);
            }
        });

        console.log('✅ Email verification page initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();