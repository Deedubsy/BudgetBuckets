import {
  getAuth, onAuthStateChanged, getIdToken, getIdTokenResult,
  GoogleAuthProvider, EmailAuthProvider,
  reauthenticateWithPopup, reauthenticateWithCredential,
  updateEmail, sendEmailVerification, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { refreshPlan } from '/app/lib/plan.js';
import { 
  initializeStripe, 
  createPaymentElement, 
  processSubscriptionPayment,
  showPaymentProcessing,
  resetPaymentUI,
  getBillingConfig
} from '/app/lib/billing-client.js';

let auth, db, currentUser = null, userDoc = null;
let isLoading = false;
let stripe = null;
let paymentElementData = null;

/**
 * Mount the account view and set up event listeners
 * @param {HTMLElement} rootEl - The root element to mount to
 * @param {Object} options - Auth and DB instances
 */
export function mountAccountView(rootEl, { auth: authInstance, db: dbInstance }) {
  auth = authInstance;
  db = dbInstance;
  
  // Initialize Stripe
  initializeStripeIfNeeded();
  
  // Set up auth state listener
  onAuthStateChanged(auth, handleAuthStateChange);
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Show the account view
 */
export function showAccountView() {
  const accountView = document.getElementById('accountView');
  if (accountView) {
    accountView.hidden = false;
  }
}

/**
 * Hide the account view
 */
export function hideAccountView() {
  const accountView = document.getElementById('accountView');
  if (accountView) {
    accountView.hidden = true;
  }
}

/**
 * Handle authentication state changes
 * @param {User|null} user - Firebase user object
 */
async function handleAuthStateChange(user) {
  currentUser = user;
  
  if (!user) {
    showSignInPrompt();
    return;
  }
  
  try {
    // Get user claims and document
    const tokenResult = await getIdTokenResult(user);
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    userDoc = userDocSnap.exists() ? userDocSnap.data() : {};
    
    // Show account content and populate UI
    showAccountContent();
    populateProfileSection(user, tokenResult.claims);
    populateBillingSection(user, tokenResult.claims, userDoc);
    populateSecuritySection(user);
    populatePreferencesSection(userDoc);
    
  } catch (error) {
    console.error('Error loading account data:', error);
    showToast('Failed to load account data', 'error');
  }
}

/**
 * Show sign-in prompt for unauthenticated users
 */
function showSignInPrompt() {
  const signInPrompt = document.getElementById('signInPrompt');
  const accountContent = document.getElementById('accountContent');
  
  if (signInPrompt) signInPrompt.classList.remove('hidden');
  if (accountContent) accountContent.classList.add('hidden');
}

/**
 * Show account content for authenticated users
 */
function showAccountContent() {
  const signInPrompt = document.getElementById('signInPrompt');
  const accountContent = document.getElementById('accountContent');
  
  if (signInPrompt) signInPrompt.classList.add('hidden');
  if (accountContent) accountContent.classList.remove('hidden');
}

/**
 * Populate the profile section
 * @param {User} user - Firebase user object
 * @param {Object} claims - Custom claims from ID token
 */
function populateProfileSection(user, claims) {
  // Avatar initials
  const avatar = document.getElementById('profileAvatar');
  const displayName = user.displayName || user.email || '';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  if (avatar) avatar.textContent = initials;
  
  // Display name
  const profileName = document.getElementById('profileName');
  if (profileName) {
    profileName.textContent = user.displayName || user.email?.split('@')[0] || 'User';
  }
  
  // Email
  const profileEmail = document.getElementById('profileEmail');
  if (profileEmail) profileEmail.textContent = user.email || '';
  
  // Verified badge
  const verifiedBadge = document.getElementById('verifiedBadge');
  const resendBtn = document.getElementById('resendVerificationBtn');
  if (verifiedBadge && resendBtn) {
    if (user.emailVerified) {
      verifiedBadge.classList.remove('hidden');
      resendBtn.hidden = true;
    } else {
      verifiedBadge.classList.add('hidden');
      resendBtn.hidden = false;
    }
  }
  
  // Plan badge
  const planBadge = document.getElementById('planBadge');
  const plan = claims.plan || userDoc.subscriptionStatus === 'active' ? 'plus' : 'free';
  if (planBadge) {
    planBadge.textContent = plan === 'plus' ? 'Plus' : 'Free';
    planBadge.className = plan === 'plus' ? 'badge badge-plan plus' : 'badge badge-plan';
  }
}

/**
 * Populate the billing section
 * @param {User} user - Firebase user object
 * @param {Object} claims - Custom claims from ID token
 * @param {Object} userDoc - User document from Firestore
 */
function populateBillingSection(user, claims, userDoc) {
  const plan = claims.plan || (userDoc.subscriptionStatus === 'active' ? 'plus' : 'free');
  const freeUserBilling = document.getElementById('freeUserBilling');
  const plusUserBilling = document.getElementById('plusUserBilling');
  const billingStatus = document.getElementById('billingStatus');
  const billingDetails = document.getElementById('billingDetails');
  
  if (plan === 'plus') {
    // Plus user
    if (freeUserBilling) freeUserBilling.classList.add('hidden');
    if (plusUserBilling) plusUserBilling.classList.remove('hidden');
    
    if (billingStatus) {
      const status = userDoc.subscriptionStatus || 'active';
      billingStatus.innerHTML = `
        <span class="status-active">●</span>
        <span>Subscription ${status}</span>
      `;
    }
  } else {
    // Free user
    if (freeUserBilling) freeUserBilling.classList.remove('hidden');
    if (plusUserBilling) plusUserBilling.classList.add('hidden');
    
    if (billingStatus) {
      billingStatus.innerHTML = `
        <span class="status-inactive">●</span>
        <span>Free Plan</span>
      `;
    }
  }
  
  // Show billing details if available
  if (billingDetails && userDoc.stripeCustomerId) {
    const maskedCustomerId = maskCustomerId(userDoc.stripeCustomerId);
    billingDetails.innerHTML = `
      <div>Customer ID: <code>${maskedCustomerId}</code></div>
      ${userDoc.subscriptionStatus ? `<div>Status: ${userDoc.subscriptionStatus}</div>` : ''}
    `;
  }
}

/**
 * Populate the security section based on user's auth providers
 * @param {User} user - Firebase user object
 */
function populateSecuritySection(user) {
  const hasPasswordProvider = user.providerData.some(p => p.providerId === 'password');
  const hasGoogleProvider = user.providerData.some(p => p.providerId === 'google.com');
  
  // Show/hide password fields for email change
  const passwordForEmail = document.getElementById('passwordForEmail');
  const googleReauthEmail = document.getElementById('googleReauthEmail');
  
  if (hasPasswordProvider) {
    if (passwordForEmail) passwordForEmail.classList.remove('hidden');
    if (googleReauthEmail) googleReauthEmail.classList.add('hidden');
  } else if (hasGoogleProvider) {
    if (passwordForEmail) passwordForEmail.classList.add('hidden');
    if (googleReauthEmail) googleReauthEmail.classList.remove('hidden');
  }
  
  // Show/hide change password section
  const changePasswordSection = document.getElementById('changePasswordSection');
  const googlePasswordInfo = document.getElementById('googlePasswordInfo');
  
  if (hasPasswordProvider) {
    if (changePasswordSection) changePasswordSection.classList.remove('hidden');
    if (googlePasswordInfo) googlePasswordInfo.classList.add('hidden');
  } else {
    if (changePasswordSection) changePasswordSection.classList.add('hidden');
    if (googlePasswordInfo) googlePasswordInfo.classList.remove('hidden');
  }
}

/**
 * Populate the preferences section
 * @param {Object} userDoc - User document from Firestore
 */
function populatePreferencesSection(userDoc) {
  const preferredNameInput = document.getElementById('preferredName');
  if (preferredNameInput && userDoc.preferredName) {
    preferredNameInput.value = userDoc.preferredName;
  }
}

/**
 * Fetch billing configuration from server
 */
/**
 * Initialize Stripe.js if not already initialized
 */
async function initializeStripeIfNeeded() {
  if (!stripe) {
    try {
      stripe = await initializeStripe();
      console.log('✅ Stripe initialized in account view');
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      // Show user-friendly error
      showToast('Failed to initialize payment system. Some features may not be available.', 'error');
    }
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Event listeners setup
  
  // Resend verification
  const resendVerificationBtn = document.getElementById('resendVerificationBtn');
  if (resendVerificationBtn) {
    resendVerificationBtn.addEventListener('click', handleResendVerification);
  }
  
  // Billing buttons
  const upgradeBtn = document.getElementById('upgradeBtn');
  const manageBillingBtn = document.getElementById('manageBillingBtn');
  const manageBillingBtn2 = document.getElementById('manageBillingBtn2');
  const downgradePlan = document.getElementById('downgradePlan');
  
  if (upgradeBtn) upgradeBtn.addEventListener('click', handleUpgrade);
  if (manageBillingBtn) manageBillingBtn.addEventListener('click', handleManageBilling);
  if (manageBillingBtn2) manageBillingBtn2.addEventListener('click', handleManageBilling);
  if (downgradePlan) downgradePlan.addEventListener('click', handleManageBilling);
  
  // Security buttons
  const changeEmailBtn = document.getElementById('changeEmailBtn');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  
  if (changeEmailBtn) changeEmailBtn.addEventListener('click', handleChangeEmail);
  if (changePasswordBtn) changePasswordBtn.addEventListener('click', handleChangePassword);
  
  // Preferences button
  const savePreferencesBtn = document.getElementById('savePreferencesBtn');
  if (savePreferencesBtn) {
    savePreferencesBtn.addEventListener('click', handleSavePreferences);
  }
  
  // Manual plan refresh button (optional)
  const refreshPlanBtn = document.getElementById('refreshPlanBtn');
  if (refreshPlanBtn) {
    refreshPlanBtn.addEventListener('click', () => refreshPlan());
  }
}

/**
 * Handle upgrade button click - New Stripe.js implementation
 */
async function handleUpgrade() {
  console.log('🚀 Upgrade button clicked');
  console.log('  Current user:', !!currentUser);
  console.log('  Is loading:', isLoading);
  console.log('  Stripe initialized:', !!stripe);
  
  const billingConfig = getBillingConfig();
  console.log('  Price ID:', billingConfig?.priceId);
  
  if (!currentUser) {
    showToast('Please sign in to upgrade your account.', 'error');
    return;
  }
  
  if (isLoading) {
    console.log('Already loading, ignoring click');
    return;
  }
  
  if (!stripe) {
    console.log('Stripe not initialized, trying to initialize...');
    try {
      await initializeStripeIfNeeded();
      if (!stripe) {
        showToast('Unable to initialize payment system. Please try again.', 'error');
        return;
      }
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      showToast('Unable to initialize payment system. Please try again.', 'error');
      return;
    }
  }
  
  // billingConfig already declared above - just validate it
  if (!billingConfig || !billingConfig.priceId) {
    showToast('Billing configuration not loaded. Please refresh the page and try again.', 'error');
    return;
  }
  
  const upgradeBtn = document.querySelector('[data-testid="upgrade-btn"]') || 
                    document.getElementById('upgradeBtn');
  showPaymentProcessing(upgradeBtn, 'Initializing...');
  
  try {
    // Check if payment element container exists, create if needed
    let paymentContainer = document.getElementById('stripe-payment-element');
    if (!paymentContainer) {
      // Create payment modal/container dynamically
      createPaymentModal();
      paymentContainer = document.getElementById('stripe-payment-element');
    }
    
    const idToken = await getIdToken(currentUser);
    
    // Create payment element with modern billing client
    console.log('🔧 Creating payment element...');
    paymentElementData = await createPaymentElement('stripe-payment-element', {
      uid: currentUser.uid,
      email: currentUser.email,
      idToken: idToken
    });
    console.log('✅ Payment element created:', !!paymentElementData);
    
    // Show the payment modal
    showPaymentModal();
    
    // Reset button to show it's ready for payment
    resetPaymentUI(upgradeBtn, 'Enter Payment Details');
    
  } catch (error) {
    console.error('Upgrade error:', error);
    showToast('Failed to initialize payment. Please try again.', 'error');
    resetPaymentUI(upgradeBtn);
  }
}

/**
 * Create payment modal dynamically
 */
function createPaymentModal() {
  // Remove existing modal if present
  const existingModal = document.getElementById('payment-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'payment-modal';
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Upgrade to Budget Buckets Plus</h3>
          <button class="modal-close" id="close-payment-modal">×</button>
        </div>
        <div class="modal-body">
          <p>Complete your payment to unlock all Plus features:</p>
          <ul style="margin: 16px 0; padding-left: 20px;">
            <li>Unlimited budgets</li>
            <li>Advanced analytics</li>
            <li>Export capabilities</li>
            <li>Priority support</li>
          </ul>
          <div id="stripe-payment-element" style="margin: 20px 0;"></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="cancel-payment">Cancel</button>
            <button class="btn btn-primary" id="complete-payment" data-testid="complete-payment-btn" disabled>Enter Payment Details</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add styles
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: none;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    .modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-content {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 20px 0;
    }
    .modal-header h3 {
      margin: 0;
      color: var(--text);
    }
    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      color: var(--text);
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-body {
      padding: 20px;
    }
    .modal-body p {
      color: var(--text);
      margin: 0 0 8px 0;
    }
    .modal-body ul {
      color: var(--muted);
      font-size: 14px;
    }
    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }
    .modal-actions .btn {
      flex: 1;
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('close-payment-modal').addEventListener('click', hidePaymentModal);
  document.getElementById('cancel-payment').addEventListener('click', hidePaymentModal);
  document.getElementById('complete-payment').addEventListener('click', handleCompletePayment);
}

/**
 * Show payment modal
 */
function showPaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Hide payment modal and reset state
 */
function hidePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
  
  const upgradeBtn = document.getElementById('upgradeBtn');
  resetPaymentUI(upgradeBtn);
  
  // Reset payment element data
  paymentElementData = null;
}

/**
 * Handle complete payment button click
 */
async function handleCompletePayment() {
  console.log('🔧 handleCompletePayment called');
  console.log('  paymentElementData:', !!paymentElementData);
  console.log('  currentUser:', !!currentUser);
  
  if (!paymentElementData || !currentUser) {
    console.error('❌ Missing required data:', { paymentElementData: !!paymentElementData, currentUser: !!currentUser });
    return;
  }
  
  const completeBtn = document.getElementById('complete-payment');
  showPaymentProcessing(completeBtn);
  
  try {
    const idToken = await getIdToken(currentUser);
    const billingConfig = getBillingConfig();
    
    const result = await processSubscriptionPayment({
      uid: currentUser.uid,
      customerId: paymentElementData.customerId,
      priceId: paymentElementData.priceId || billingConfig.priceId,
      idToken: idToken
    });
    
    if (result.success) {
      hidePaymentModal();
      showToast('Subscription activated successfully! Updating your plan...', 'success');
      
      // Refresh auth token to get updated custom claims
      console.log('🔄 Refreshing auth token to get updated plan...');
      await getIdTokenResult(currentUser, true);
      
      // Wait a bit for webhook to process and update claims
      setTimeout(async () => {
        try {
          // Force refresh token again to get latest claims
          const tokenResult = await getIdTokenResult(currentUser, true);
          console.log('🔍 Token claims after refresh:', tokenResult.claims);
          
          // Refresh the plan data and update UI
          await refreshPlan();
          
          // Update the account view to show new plan
          await loadUserData();
          updatePlanUI();
          
          showToast('✅ Welcome to Budget Buckets Plus!', 'success');
        } catch (error) {
          console.error('Error refreshing plan data:', error);
          showToast('Payment successful! Please refresh the page to see your Plus features.', 'info');
        }
      }, 3000);
    } else {
      showToast(result.error || 'Payment failed. Please try again.', 'error');
      resetPaymentUI(completeBtn, 'Complete Payment - $3.99/mo');
    }
    
  } catch (error) {
    console.error('Payment completion error:', error);
    showToast('Payment failed. Please try again.', 'error');
    resetPaymentUI(completeBtn, 'Complete Payment - $3.99/mo');
  }
}

/**
 * Update plan UI elements without page reload
 */
function updatePlanUI() {
  console.log('🔄 Updating plan UI elements...');
  
  // Update plan badge
  const planBadge = document.querySelector('[data-testid="plan-badge"]') || 
                   document.querySelector('.plan-badge');
  if (planBadge) {
    planBadge.textContent = 'Plus';
    planBadge.className = 'plan-badge plus';
  }
  
  // Hide upgrade button, show manage billing button
  const upgradeBtn = document.querySelector('[data-testid="upgrade-btn"]') || 
                    document.getElementById('upgradeBtn');
  const manageBillingBtn = document.querySelector('[data-testid="manage-billing-btn"]') || 
                          document.getElementById('manageBillingBtn');
  
  if (upgradeBtn) {
    upgradeBtn.style.display = 'none';
  }
  
  if (manageBillingBtn) {
    manageBillingBtn.style.display = 'inline-block';
    manageBillingBtn.textContent = 'Manage Billing';
  }
  
  // Update any plan-specific UI elements
  const planStatus = document.querySelector('.plan-status');
  if (planStatus) {
    planStatus.innerHTML = `
      <div class="plan-info">
        <span class="plan-badge plus">Plus</span>
        <span class="plan-features">Unlimited budgets • Priority support</span>
      </div>
    `;
  }
  
  console.log('✅ Plan UI updated to Plus');
}

/**
 * Handle manage billing button click
 */
async function handleManageBilling() {
  if (!currentUser || isLoading) return;
  
  const buttons = [
    document.getElementById('manageBillingBtn'),
    document.getElementById('manageBillingBtn2')
  ].filter(Boolean);
  
  // Disable buttons and show loading
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span>Loading...';
  });
  
  try {
    const idToken = await getIdToken(currentUser);
    
    const response = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 400 && errorData.error?.includes('No billing account found')) {
        showToast('No billing account found. Please upgrade to Plus first.', 'error');
      } else {
        throw new Error(errorData.error || 'Failed to access billing portal');
      }
      return;
    }
    
    const data = await response.json();
    
    if (data.url) {
      location.assign(data.url);
    } else {
      throw new Error('No portal URL returned');
    }
    
  } catch (error) {
    console.error('Billing portal error:', error);
    showToast('Failed to access billing portal. Please try again.', 'error');
  } finally {
    // Re-enable buttons
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.textContent = 'Manage Billing';
    });
  }
}

/**
 * Handle resend verification button click
 */
async function handleResendVerification() {
  if (!currentUser || isLoading) return;
  
  const resendBtn = document.getElementById('resendVerificationBtn');
  if (resendBtn) {
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';
  }
  
  try {
    await sendEmailVerification(currentUser);
    showToast('Verification email sent successfully', 'success');
    
  } catch (error) {
    console.error('Resend verification error:', error);
    showToast('Failed to send verification email', 'error');
  } finally {
    if (resendBtn) {
      resendBtn.disabled = false;
      resendBtn.textContent = 'Resend Verification';
    }
  }
}

/**
 * Handle change email button click
 */
async function handleChangeEmail() {
  if (!currentUser || isLoading) return;
  
  const newEmailInput = document.getElementById('newEmail');
  const currentPasswordInput = document.getElementById('currentPasswordEmail');
  const changeEmailBtn = document.getElementById('changeEmailBtn');
  
  if (!newEmailInput || !changeEmailBtn) return;
  
  const newEmail = newEmailInput.value.trim();
  if (!newEmail) {
    showToast('Please enter a new email address', 'error');
    return;
  }
  
  if (newEmail === currentUser.email) {
    showToast('New email must be different from current email', 'error');
    return;
  }
  
  changeEmailBtn.disabled = true;
  changeEmailBtn.innerHTML = '<span class="loading-spinner"></span>Updating...';
  
  try {
    // Reauthenticate user
    const hasPasswordProvider = currentUser.providerData.some(p => p.providerId === 'password');
    const hasGoogleProvider = currentUser.providerData.some(p => p.providerId === 'google.com');
    
    if (hasPasswordProvider) {
      const currentPassword = currentPasswordInput?.value;
      if (!currentPassword) {
        showToast('Please enter your current password', 'error');
        return;
      }
      
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
    } else if (hasGoogleProvider) {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(currentUser, provider);
    }
    
    // Update email
    await updateEmail(currentUser, newEmail);
    
    // Send verification email
    await sendEmailVerification(currentUser);
    
    showToast(`Email updated successfully. Verification sent to ${newEmail}`, 'success');
    
    // Clear form
    newEmailInput.value = '';
    if (currentPasswordInput) currentPasswordInput.value = '';
    
  } catch (error) {
    console.error('Change email error:', error);
    
    let errorMessage = 'Failed to change email';
    if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid current password';
    } else if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email address is already in use';
    } else if (error.code === 'auth/requires-recent-login') {
      errorMessage = 'Please sign out and sign back in, then try again';
    }
    
    showToast(errorMessage, 'error');
    
  } finally {
    changeEmailBtn.disabled = false;
    changeEmailBtn.textContent = 'Change Email';
  }
}

/**
 * Handle change password button click
 */
async function handleChangePassword() {
  if (!currentUser || isLoading) return;
  
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  
  if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput || !changePasswordBtn) {
    return;
  }
  
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Validate inputs
  if (!currentPassword) {
    showToast('Please enter your current password', 'error');
    return;
  }
  
  if (!newPassword) {
    showToast('Please enter a new password', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showToast('New password must be at least 6 characters long', 'error');
    return;
  }
  
  changePasswordBtn.disabled = true;
  changePasswordBtn.innerHTML = '<span class="loading-spinner"></span>Updating...';
  
  try {
    // Reauthenticate with current password
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    
    // Update password
    await updatePassword(currentUser, newPassword);
    
    showToast('Password updated successfully', 'success');
    
    // Clear form
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
    
  } catch (error) {
    console.error('Change password error:', error);
    
    let errorMessage = 'Failed to change password';
    if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid current password';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'New password is too weak';
    } else if (error.code === 'auth/requires-recent-login') {
      errorMessage = 'Please sign out and sign back in, then try again';
    }
    
    showToast(errorMessage, 'error');
    
  } finally {
    changePasswordBtn.disabled = false;
    changePasswordBtn.textContent = 'Change Password';
  }
}

/**
 * Handle save preferences button click
 */
async function handleSavePreferences() {
  if (!currentUser || isLoading) return;
  
  const preferredNameInput = document.getElementById('preferredName');
  const saveBtn = document.getElementById('savePreferencesBtn');
  
  if (!preferredNameInput || !saveBtn) return;
  
  const preferredName = preferredNameInput.value.trim();
  
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="loading-spinner"></span>Saving...';
  
  try {
    // Update Firestore document
    const userDocRef = doc(db, 'users', currentUser.uid);
    await setDoc(userDocRef, { preferredName }, { merge: true });
    
    showToast('Preferences saved successfully', 'success');
    
    // Update local userDoc
    if (userDoc) {
      userDoc.preferredName = preferredName;
    }
    
  } catch (error) {
    console.error('Save preferences error:', error);
    showToast('Failed to save preferences', 'error');
    
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Preferences';
  }
}

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type ('success' or 'error')
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Remove toast after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  }, 4000);
}

/**
 * Mask customer ID for display
 * @param {string} customerId - Stripe customer ID
 * @returns {string} Masked customer ID
 */
function maskCustomerId(customerId) {
  if (!customerId || customerId.length < 8) return customerId;
  return customerId.substring(0, 4) + '****' + customerId.slice(-4);
}

// Handle Escape key to hide account view (if desired)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const accountView = document.getElementById('accountView');
    if (accountView && !accountView.hidden) {
      hideAccountView();
    }
  }
});