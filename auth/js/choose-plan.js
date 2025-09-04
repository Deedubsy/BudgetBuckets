import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import { initializeStripe, createPaymentElement, processSubscriptionPayment } from '/app/lib/billing-client.js';

(function() {
    'use strict';

    let currentUser = null;
    let stripeInitialized = false;
    let processingPlan = false;

    function showLoading() {
        console.log('🔄 showLoading() called');
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            console.log('✅ Loading overlay shown');
        } else {
            console.error('❌ Loading overlay element not found!');
        }
    }

    function hideLoading() {
        console.log('⚪ hideLoading() called');
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            console.log('✅ Loading overlay hidden');
        } else {
            console.error('❌ Loading overlay element not found!');
        }
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
                planType: 'free',
                subscriptionStatus: 'free'
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

            // Don't hide loading yet - keep it visible during payment element creation
            showPaymentSection();

            // Create payment element in the payment section
            const paymentContainer = document.getElementById('payment-element');
            if (!paymentContainer) {
                throw new Error('Payment container not found');
            }

            console.log('Creating payment element...');
            
            // Add loading message to payment container with spinner
            paymentContainer.innerHTML = `
                <div style="
                    text-align: center; 
                    padding: 40px 20px; 
                    color: var(--text-secondary);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                ">
                    <div style="
                        border: 2px solid var(--border);
                        border-top: 2px solid var(--accent);
                        border-radius: 50%;
                        width: 32px;
                        height: 32px;
                        animation: spin 1s linear infinite;
                    "></div>
                    <div>Loading secure payment form...</div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            
            const idToken = await currentUser.getIdToken();
            
            console.log('🔧 About to call createPaymentElement...');
            
            try {
                // Create payment element and wait for it to be ready with timeout
                console.log('⏰ Starting payment element creation with timeout...');
                
                const paymentInfo = await Promise.race([
                    createPaymentElement('payment-element', { 
                        idToken,
                        email: currentUser.email,
                        uid: currentUser.uid
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Payment element creation timed out after 15 seconds')), 15000)
                    )
                ]);
                
                console.log('✅ Payment element created and ready, hiding loader');
                console.log('Payment info:', { hasCustomerId: !!paymentInfo.customerId, hasPriceId: !!paymentInfo.priceId });
                hideLoading();

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
                            
                            // MANUAL FIRESTORE UPDATE - Ensure subscription status is saved immediately
                            console.log('🔧 Manually updating user subscription status in Firestore...');
                            try {
                                await setDoc(doc(window.firebase.db, 'users', currentUser.uid), {
                                    planType: 'plus',
                                    subscriptionStatus: 'active',
                                    stripeCustomerId: paymentInfo.customerId,
                                    updatedAt: serverTimestamp(),
                                    paymentCompletedAt: serverTimestamp()
                                }, { merge: true });
                                console.log('✅ Manual subscription status update completed');
                                
                                // Force token refresh to get updated custom claims
                                console.log('🔧 Forcing token refresh for updated claims...');
                                await currentUser.getIdToken(true);
                                console.log('✅ Token refreshed with updated claims');
                                
                            } catch (firestoreError) {
                                console.error('⚠️ Manual Firestore update failed (server-side update should handle):', firestoreError);
                            }
                            
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
            
            } catch (paymentElementError) {
                console.error('❌ Failed to create payment element:', paymentElementError);
                hideLoading();
                showError('Failed to load payment form: ' + paymentElementError.message);
                processingPlan = false;
                showPlanSelection();
                return;
            }

        } catch (error) {
            hideLoading();
            processingPlan = false;
            showPlanSelection();
            console.error('Plus plan selection error:', error);
            showError('Failed to start Plus subscription: ' + error.message);
        }
    }

    function checkUserPlanStatus() {
        try {
            if (!currentUser || processingPlan) return;

            console.log('🔍 Choose-plan validation debug:', {
                planType: currentUser.planType,
                subscriptionStatus: currentUser.subscriptionStatus,
                subscriptionId: currentUser.subscriptionId,
                stripeCustomerId: currentUser.stripeCustomerId
            });
            
            // Check if user has active subscription (should redirect even if planType is outdated)
            if (currentUser.subscriptionStatus === 'active' || currentUser.planType === 'plus') {
                console.log('✅ User has active subscription/plus plan, redirecting to main app');
                sessionStorage.setItem('planJustSelected', 'plus');
                location.assign('/app');
                return;
            }
            
            // Check if user has completed free plan selection
            if (currentUser.planType === 'free') {
                console.log('✅ User has completed free plan selection, redirecting to main app');
                sessionStorage.setItem('planJustSelected', 'free');
                location.assign('/app');
                return;
            }
            
            // If user has free_pending or no plan, stay on plan selection page
            console.log('📋 User needs to select plan, current status:', currentUser.planType || 'none');
        } catch (error) {
            console.error('❌ Failed to check user plan status:', error);
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
            
            if (user) {
                // Get complete user data including subscription status
                try {
                    // Import auth helpers dynamically
                    const { authHelpers } = await import('/auth/firebase.js');
                    
                    currentUser = await authHelpers.getCompleteUserData();
                    console.log('🔍 Choose-plan currentUser loaded:', {
                        uid: currentUser.uid,
                        planType: currentUser.planType,
                        subscriptionStatus: currentUser.subscriptionStatus
                    });
                } catch (error) {
                    console.error('Failed to load complete user data, falling back to auth user:', error);
                    currentUser = user;
                }
            } else {
                currentUser = null;
            }
            
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
                checkUserPlanStatus();
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