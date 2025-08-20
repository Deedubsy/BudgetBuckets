import { getAuth, onAuthStateChanged, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import { mountAccountView, showAccountView, hideAccountView } from '/app/account.js';
import { watchPlan, getPlan, isPlus } from '/app/lib/plan.js';

const auth = getAuth();
const db = getFirestore();

const accountRoot = document.getElementById('accountView');
mountAccountView(accountRoot, { auth, db });

// Start plan watching
watchPlan(updatePlanUI);

// Show/hide Account nav link based on auth state
const navAccount = document.getElementById('navAccount');
onAuthStateChanged(auth, (user) => {
  if (navAccount) {
    navAccount.style.display = user ? 'inline-block' : 'none';
  }
  handleEmailVerification(user);
  updateBucketCounter();
});

// Simple nav wiring
if (navAccount) {
  navAccount.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Hide main content and show account view
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.display = 'none';
    
    accountRoot.hidden = false;
    if (typeof showAccountView === 'function') showAccountView();
    history.replaceState(null, '', '#account');
  });
}

// Hash router (open Account on reload)
if (location.hash === '#account') {
  const mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.style.display = 'none';
  
  accountRoot.hidden = false;
  if (typeof showAccountView === 'function') showAccountView();
}

// Handle back navigation or closing account view
window.addEventListener('popstate', () => {
  if (location.hash !== '#account') {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.display = 'block';
    
    accountRoot.hidden = true;
    if (typeof hideAccountView === 'function') hideAccountView();
  }
});

// Plan UI updates
function updatePlanUI(plan) {
  updateBucketCounter();
}

// Update bucket counter display
function updateBucketCounter() {
  const counter = document.getElementById('bucketCounter');
  if (counter && window.getBucketCountForUI) {
    const count = window.getBucketCountForUI();
    const plan = getPlan();
    
    if (plan === 'plus') {
      counter.textContent = `${count} buckets`;
    } else {
      counter.textContent = `${count}/5 buckets`;
    }
    counter.style.display = 'inline';
  }
}

// Email verification banner
function handleEmailVerification(user) {
  console.log('🔍 handleEmailVerification called with user:', user?.uid);
  
  const banner = document.getElementById('verifyBanner');
  const resendBtn = document.getElementById('resendVerification');
  const verifiedBtn = document.getElementById('iveVerified');
  
  console.log('🔍 Email verification elements:', {
    banner: !!banner,
    resendBtn: !!resendBtn,
    verifiedBtn: !!verifiedBtn,
    user: !!user
  });
  
  if (!banner || !user) {
    console.log('⚠️ Missing banner or user, hiding banner');
    if (banner) banner.hidden = true;
    return;
  }
  
  if (!resendBtn || !verifiedBtn) {
    console.error('❌ Missing verification buttons:', { resendBtn: !!resendBtn, verifiedBtn: !!verifiedBtn });
    return;
  }

  // Show banner for unverified email/password users
  const hasPasswordProvider = user.providerData.some(p => p.providerId === 'password');
  const shouldShow = hasPasswordProvider && !user.emailVerified;
  
  console.log('🔍 Email verification logic:', {
    hasPasswordProvider,
    emailVerified: user.emailVerified,
    shouldShow,
    providerData: user.providerData.map(p => p.providerId)
  });
  
  banner.hidden = !shouldShow;
  
  console.log('📎 Attaching event handlers to verification buttons...');

  // Test that buttons are clickable
  resendBtn.addEventListener('click', () => console.log('🔄 Resend button clicked!'), { once: true });
  verifiedBtn.addEventListener('click', () => console.log('✅ Verified button clicked!'), { once: true });

  // Resend verification
  resendBtn.onclick = async () => {
    try {
      console.log('🔄 Attempting to resend verification email...');
      console.log('🔍 Available objects:', {
        'window.firebase': !!window.firebase,
        'window.firebase.authHelpers': !!window.firebase?.authHelpers,
        'auth': !!auth,
        'auth.currentUser': !!auth?.currentUser
      });
      
      resendBtn.disabled = true;
      resendBtn.textContent = 'Sending...';
      
      // Get fresh user instance
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      console.log('📧 User details:', {
        uid: currentUser.uid,
        email: currentUser.email,
        emailVerified: currentUser.emailVerified
      });
      
      // Try direct import method as fallback
      if (window.firebase?.authHelpers?.sendEmailVerification) {
        console.log('📧 Using authHelpers.sendEmailVerification...');
        await window.firebase.authHelpers.sendEmailVerification(currentUser);
      } else {
        console.log('📧 Using direct Firebase import...');
        const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
        await sendEmailVerification(currentUser);
      }
      
      console.log('✅ Verification email sent successfully');
      resendBtn.textContent = 'Email sent!';
      setTimeout(() => {
        resendBtn.textContent = 'Resend verification email';
        resendBtn.disabled = false;
      }, 3000);
      
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      resendBtn.textContent = 'Resend verification email';
      resendBtn.disabled = false;
      
      // Show user-friendly error
      let errorMessage = 'Failed to send verification email';
      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please wait a moment before trying again.';
      } else if (error.code === 'auth/user-token-expired') {
        errorMessage = 'Session expired. Please sign out and sign in again.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      alert(errorMessage + ': ' + error.message);
    }
  };

  // Check verification status
  verifiedBtn.onclick = async () => {
    try {
      console.log('✅ Checking verification status...');
      verifiedBtn.disabled = true;
      verifiedBtn.textContent = 'Checking...';
      
      // Get fresh user instance and reload
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      console.log('📧 Current verification status before reload:', currentUser.emailVerified);
      await currentUser.reload();
      console.log('📧 Current verification status after reload:', currentUser.emailVerified);
      
      if (currentUser.emailVerified) {
        console.log('✅ Email is now verified! Hiding banner...');
        banner.hidden = true;
        alert('Email verified successfully!');
      } else {
        console.log('⚠️ Email still not verified');
        alert('Email not yet verified. Please check your inbox and click the verification link.');
      }
      
      verifiedBtn.textContent = 'I\'ve verified';
      verifiedBtn.disabled = false;
      
    } catch (error) {
      console.error('❌ Failed to check verification status:', error);
      verifiedBtn.textContent = 'I\'ve verified';
      verifiedBtn.disabled = false;
      alert('Failed to check verification status: ' + error.message);
    }
  };
}

// Expose updateBucketCounter globally for app.js to call
window.updateBucketCounter = updateBucketCounter;