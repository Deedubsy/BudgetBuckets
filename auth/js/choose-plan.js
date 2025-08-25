import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

(function() {
    'use strict';

    let currentUser = null;
    let billingClient = null;
    let processingPlan = false;

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

    function showPlanSelection() {
        document.querySelector('.plan-selection-content').style.display = 'block';
        document.getElementById('paymentSection').style.display = 'none';
    }

    function showPaymentSection() {
        document.querySelector('.plan-selection-content').style.display = 'none';
        document.getElementById('paymentSection').style.display = 'block';
    }

    async function chooseFree() {
        try {
            if (!currentUser) {
                showError('Please sign in again.');
                const isTestMode = window.location.search.includes('test=true') || window.location.hostname === 'localhost';
                if (!isTestMode) {
                    setTimeout(() => location.assign('/auth/login'), 2000);
                }
                return;
            }

            processingPlan = true;
            showLoading();
            
            // Update user document to set free plan
            await setDoc(doc(window.firebase.db, 'users', currentUser.uid), {
                planType: 'free'
            }, { merge: true });

            // Store in sessionStorage to prevent race condition
            sessionStorage.setItem('planJustSelected', 'free');

            hideLoading();
            showSuccess('Free plan activated! Taking you to Budget Buckets...');
            setTimeout(() => location.assign('/app'), 1500);
        } catch (error) {
            hideLoading();
            processingPlan = false;
            console.error('Free plan selection error:', error);
            showError('Failed to activate free plan. Please try again.');
        }
    }

    async function choosePlus() {
        try {
            if (!currentUser) {
                showError('Please sign in again.');
                const isTestMode = window.location.search.includes('test=true') || window.location.hostname === 'localhost';
                if (!isTestMode) {
                    setTimeout(() => location.assign('/auth/login'), 2000);
                }
                return;
            }

            processingPlan = true;
            showLoading();

            // Initialize billing client if not already done
            if (!billingClient && window.BillingClient) {
                billingClient = new window.BillingClient();
                await billingClient.initialize();
            }

            if (!billingClient) {
                throw new Error('Billing system not available');
            }

            hideLoading();
            showPaymentSection();

            // Start the upgrade flow using existing billing client
            const success = await billingClient.startUpgradeFlow();
            
            if (success) {
                // Refresh token to get new claims
                await currentUser.getIdToken(true);
                
                // Store in sessionStorage to prevent race condition
                sessionStorage.setItem('planJustSelected', 'plus');
                
                showSuccess('Plus plan activated! Taking you to Budget Buckets...');
                setTimeout(() => location.assign('/app'), 1500);
            } else {
                showPlanSelection();
                showError('Subscription was not completed. Please try again.');
            }
        } catch (error) {
            hideLoading();
            processingPlan = false;
            showPlanSelection();
            console.error('Plus plan selection error:', error);
            showError('Failed to start Plus subscription. Please try again.');
        }
    }

    async function checkUserPlanStatus() {
        try {
            if (!currentUser) return;

            // Check if user already has a plan set
            const userDoc = await getDoc(doc(window.firebase.db, 'users', currentUser.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // If user already has a plan (not free_pending), redirect to app
                if (userData.planType && userData.planType !== 'free_pending') {
                    console.log('User already has plan:', userData.planType);
                    // Set sessionStorage to prevent auth flow from redirecting back
                    sessionStorage.setItem('planJustSelected', userData.planType);
                    location.assign('/app');
                    return;
                }
            }
        } catch (error) {
            console.error('Failed to check user plan status:', error);
        }
    }

    function setupEventListeners() {
        const freeBtn = document.getElementById('plan-free-btn');
        const plusBtn = document.getElementById('plan-plus-btn');
        const cancelPaymentBtn = document.getElementById('payment-cancel');

        if (freeBtn) {
            freeBtn.addEventListener('click', chooseFree);
        }

        if (plusBtn) {
            plusBtn.addEventListener('click', choosePlus);
        }

        if (cancelPaymentBtn) {
            cancelPaymentBtn.addEventListener('click', showPlanSelection);
        }
    }

    function init() {
        console.log('📋 Initializing plan selection page...');
        
        setupEventListeners();
        showPlanSelection();

        // Check if this is a test environment
        const isTestMode = window.location.search.includes('test=true') || window.location.hostname === 'localhost';

        // Listen for auth state changes
        onAuthStateChanged(window.firebase.auth, async (user) => {
            console.log('Auth state change:', user ? `User ${user.uid}` : 'No user');
            currentUser = user;
            
            if (!user && !isTestMode && !processingPlan) {
                // No user signed in, redirect to login (unless in test mode or processing plan)
                console.log('No authenticated user, redirecting to login');
                location.assign('/auth/login');
                return;
            }

            // Check if user is email verified (for password providers)
            const isPasswordProvider = user.providerData.some(p => p.providerId === 'password');
            if (isPasswordProvider && !user.emailVerified) {
                console.log('Email not verified, redirecting to verification');
                location.assign(`/auth/verify?email=${encodeURIComponent(user.email)}`);
                return;
            }

            // Check if user already has a plan (but not while processing)
            if (!processingPlan) {
                await checkUserPlanStatus();
            }
        });

        console.log('✅ Plan selection page initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();