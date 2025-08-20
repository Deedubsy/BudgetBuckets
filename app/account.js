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

// Price ID will be fetched from server
let PRICE_ID_MONTHLY = null;

let auth, db, currentUser = null, userDoc = null;
let isLoading = false;

/**
 * Mount the account view and set up event listeners
 * @param {HTMLElement} rootEl - The root element to mount to
 * @param {Object} options - Auth and DB instances
 */
export function mountAccountView(rootEl, { auth: authInstance, db: dbInstance }) {
  auth = authInstance;
  db = dbInstance;
  
  // Fetch billing configuration
  fetchBillingConfig();
  
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
  const manageAccountBtn = document.getElementById('manageAccountBtn');
  
  if (signInPrompt) signInPrompt.classList.remove('hidden');
  if (accountContent) accountContent.classList.add('hidden');
  if (manageAccountBtn) manageAccountBtn.hidden = true;
}

/**
 * Show account content for authenticated users
 */
function showAccountContent() {
  const signInPrompt = document.getElementById('signInPrompt');
  const accountContent = document.getElementById('accountContent');
  const manageAccountBtn = document.getElementById('manageAccountBtn');
  
  if (signInPrompt) signInPrompt.classList.add('hidden');
  if (accountContent) accountContent.classList.remove('hidden');
  if (manageAccountBtn) manageAccountBtn.hidden = false;
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
async function fetchBillingConfig() {
  try {
    const response = await fetch('/api/billing/config');
    if (response.ok) {
      const config = await response.json();
      PRICE_ID_MONTHLY = config.priceId;
    } else {
      console.error('Failed to fetch billing config');
    }
  } catch (error) {
    console.error('Error fetching billing config:', error);
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Header manage billing button
  const manageAccountBtn = document.getElementById('manageAccountBtn');
  if (manageAccountBtn) {
    manageAccountBtn.addEventListener('click', handleManageBilling);
  }
  
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
 * Handle upgrade button click
 */
async function handleUpgrade() {
  if (!currentUser || isLoading) return;
  
  if (!PRICE_ID_MONTHLY) {
    showToast('Billing configuration not loaded. Please try again.', 'error');
    return;
  }
  
  const upgradeBtn = document.getElementById('upgradeBtn');
  if (upgradeBtn) {
    upgradeBtn.disabled = true;
    upgradeBtn.innerHTML = '<span class="loading-spinner"></span>Processing...';
  }
  
  try {
    const idToken = await getIdToken(currentUser);
    
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        uid: currentUser.uid,
        email: currentUser.email,
        priceId: PRICE_ID_MONTHLY
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }
    
    const data = await response.json();
    
    if (data.url) {
      location.assign(data.url);
    } else {
      throw new Error('No checkout URL returned');
    }
    
  } catch (error) {
    console.error('Upgrade error:', error);
    showToast('Failed to process upgrade. Please try again.', 'error');
    
    if (upgradeBtn) {
      upgradeBtn.disabled = false;
      upgradeBtn.textContent = 'Upgrade to Plus — $3.99/mo';
    }
  }
}

/**
 * Handle manage billing button click
 */
async function handleManageBilling() {
  if (!currentUser || isLoading) return;
  
  const buttons = [
    document.getElementById('manageAccountBtn'),
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
      throw new Error('Failed to access billing portal');
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