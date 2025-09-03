import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import { initializeStripe, createPaymentElement, processSubscriptionPayment } from '/app/lib/billing-client.js';

(function() {
    'use strict';

    let currentUser = null;
    let stripeInitialized = false;
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

            // Initialize Stripe if not already done
            if (!stripeInitialized) {
                console.log('Initializing Stripe...');
                await initializeStripe();
                stripeInitialized = true;
            }

            hideLoading();
            showPaymentSection();

            // Create payment element in the payment section
            const paymentContainer = document.getElementById('payment-element');
            if (!paymentContainer) {
                throw new Error('Payment container not found');
            }

            console.log('Creating payment element...');
            const idToken = await currentUser.getIdToken();
            const paymentInfo = await createPaymentElement('payment-element', { 
                idToken,
                email: currentUser.email,
                uid: currentUser.uid
            });

            // Set up payment completion
            const submitButton = document.getElementById('payment-submit');
            if (submitButton) {
                submitButton.onclick = async () => {
                    try {
                        showLoading();
                        
                        const success = await processSubscriptionPayment({
                            uid: currentUser.uid,
                            customerId: paymentInfo.customerId,
                            priceId: paymentInfo.priceId,
                            idToken: await currentUser.getIdToken(true)
                        });
                        
                        if (success) {
                            // Store in sessionStorage to prevent race condition
                            sessionStorage.setItem('planJustSelected', 'plus');
                            
                            hideLoading();
                            showSuccess('Plus plan activated! Taking you to Budget Buckets...');
                            setTimeout(() => location.assign('/app'), 1500);
                        } else {
                            hideLoading();
                            showError('Payment was not completed. Please try again.');
                        }
                    } catch (paymentError) {
                        hideLoading();
                        console.error('Payment error:', paymentError);
                        showError('Payment failed: ' + paymentError.message);
                    }
                };
            }

        } catch (error) {
            hideLoading();
            processingPlan = false;
            showPlanSelection();
            console.error('Plus plan selection error:', error);
            showError('Failed to start Plus subscription: ' + error.message);
        }
    }

    async function checkUserPlanStatus() {
        try {
            if (!currentUser) return;

            // Check if user already has a plan set
            const userDoc = await getDoc(doc(window.firebase.db, 'users', currentUser.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Only redirect if user has a complete plan (free or plus), not free_pending
                if (userData.planType === 'free' || userData.planType === 'plus') {
                    console.log('User already has complete plan:', userData.planType);
                    // Set sessionStorage to prevent auth flow from redirecting back
                    sessionStorage.setItem('planJustSelected', userData.planType);
                    location.assign('/app');
                    return;
                }
                
                // If user has free_pending or no plan, stay on plan selection page
                console.log('User needs to select plan, current status:', userData.planType || 'none');
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