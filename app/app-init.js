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
onAuthStateChanged(auth, async (user) => {
  if (navAccount) {
    navAccount.style.display = user ? 'inline-block' : 'none';
  }
  
  // Enhanced auth gate - enforce the complete flow
  await enforceAuthFlow(user);
  
  // Handle upgrade success - refresh token to get updated plan claims
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('upgrade') === 'success' && user) {
    console.log('🎉 Upgrade successful! Refreshing user token to get updated plan...');
    try {
      // Force token refresh to get updated custom claims from webhook
      await user.getIdToken(true);
      
      // Clean up URL
      urlParams.delete('upgrade');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      history.replaceState(null, '', newUrl);
      
      console.log('✅ Token refreshed after upgrade success');
    } catch (error) {
      console.error('❌ Failed to refresh token after upgrade:', error);
    }
  }
  
  handleEmailVerification(user);
  updateBucketCounter();
});

// Enhanced authentication gate
async function enforceAuthFlow(user) {
  if (!user) {
    // No user signed in, redirect to login
    location.assign('/auth/login');
    return;
  }

  // Check if this is a password provider and email is not verified
  const isPasswordProvider = user.providerData.some(p => p.providerId === 'password');
  if (isPasswordProvider && !user.emailVerified) {
    console.log('Email not verified, redirecting to verification');
    await auth.signOut();
    location.assign(`/auth/verify?email=${encodeURIComponent(user.email)}`);
    return;
  }

  try {
    // Check user document and plan status
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      console.log('User document missing, redirecting to plan selection');
      location.assign('/auth/choose-plan');
      return;
    }
    
    const userData = userDocSnap.data();
    
    // Check if plan was just selected (prevents race condition)
    const planJustSelected = sessionStorage.getItem('planJustSelected');
    if (planJustSelected) {
      console.log('Plan was just selected:', planJustSelected, '- allowing access');
      sessionStorage.removeItem('planJustSelected'); // Clear the flag
      return;
    }
    
    if (!userData.planType || userData.planType === 'free_pending') {
      console.log('Plan not selected, redirecting to plan selection');
      location.assign('/auth/choose-plan');
      return;
    }
    
    console.log('✅ Authentication flow complete, user can access app');
  } catch (error) {
    console.error('Error checking user status:', error);
    // On error, allow access but log the issue
  }
}

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

// Back to Budgets button
const backToBudgetsBtn = document.getElementById('backToBudgetsBtn');
if (backToBudgetsBtn) {
  backToBudgetsBtn.addEventListener('click', () => {
    // Show main content and hide account view
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.display = 'block';
    
    accountRoot.hidden = true;
    if (typeof hideAccountView === 'function') hideAccountView();
    
    // Update URL
    history.replaceState(null, '', window.location.pathname);
  });
}

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
    if (banner) {
      banner.style.display = 'none';
      banner.hidden = true;
    }
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
  
  if (shouldShow) {
    console.log('📧 Showing verification banner');
    banner.style.display = 'block';
    banner.hidden = false;
  } else {
    console.log('📧 Hiding verification banner (user verified or not password provider)');
    banner.style.display = 'none';
    banner.hidden = true;
  }
  
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
      // Action code settings for email verification
      const actionCodeSettings = {
        url: `${location.origin}/auth/verify`,
        handleCodeInApp: false
      };
      
      if (window.firebase?.authHelpers?.sendEmailVerification) {
        console.log('📧 Using authHelpers.sendEmailVerification...');
        await window.firebase.authHelpers.sendEmailVerification(currentUser, actionCodeSettings);
      } else {
        console.log('📧 Using direct Firebase import...');
        const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
        await sendEmailVerification(currentUser, actionCodeSettings);
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
        console.log('📧 Banner element before hiding:', banner);
        console.log('📧 Banner current styles:', {
          display: banner.style.display,
          hidden: banner.hidden,
          className: banner.className
        });
        
        banner.style.display = 'none';
        banner.hidden = true;
        
        console.log('📧 Banner styles after hiding:', {
          display: banner.style.display,
          hidden: banner.hidden
        });
        
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

// =====================================================
// MICRO-INTERACTIONS & ANIMATIONS
// =====================================================

/**
 * Animate numerical values with smooth counting effect
 * @param {HTMLElement} element - Element containing the number to animate
 * @param {number} targetValue - Final value to animate to
 * @param {string} prefix - Text prefix (e.g., '$', '')
 * @param {string} suffix - Text suffix (e.g., '%', '')
 * @param {number} duration - Animation duration in milliseconds
 */
function animateNumber(element, targetValue, prefix = '', suffix = '', duration = 1000) {
    if (!element || typeof targetValue !== 'number') return;
    
    const startValue = 0;
    const startTime = performance.now();
    
    // Add animation class for visual effect
    element.classList.add('animate-count-up');
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use cubic-bezier easing function
        const easedProgress = progress < 0.5 
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        const currentValue = startValue + (targetValue - startValue) * easedProgress;
        
        // Format the number appropriately
        const formattedValue = prefix + Math.round(currentValue) + suffix;
        element.textContent = formattedValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            // Ensure final value is exact
            element.textContent = prefix + targetValue + suffix;
            element.classList.remove('animate-count-up');
        }
    }
    
    requestAnimationFrame(updateNumber);
}

/**
 * Implement page load sequence with staggered animations
 */
function initializePageLoadSequence() {
    const sequence = [
        { selector: 'header', delay: 0, duration: 300, animation: 'fadeIn' },
        { selector: '.budget-health-summary', delay: 100, duration: 300, animation: 'fadeInUp' },
        { selector: '.sticky-totals', delay: 400, duration: 300, animation: 'fadeInUp' },
        { selector: '.expenses-section', delay: 600, duration: 300, animation: 'fadeInUp' },
        { selector: '.savings-section', delay: 700, duration: 300, animation: 'fadeInUp' },
        { selector: '.debt-section', delay: 800, duration: 300, animation: 'fadeInUp' }
    ];
    
    sequence.forEach(({ selector, delay, animation }) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = animation === 'fadeInUp' ? 'translateY(20px)' : 'none';
            
            setTimeout(() => {
                element.classList.add(`animate-${animation.toLowerCase().replace('up', '-up')}`);
            }, delay + (index * 50));
        });
    });
}

/**
 * Add enhanced hover interactions to interactive elements
 */
function enhanceInteractiveElements() {
    // Add hover effects to cards and buttons
    const interactiveElements = document.querySelectorAll('.card, .btn, .add-bucket-btn, .bucket-card');
    
    interactiveElements.forEach(element => {
        if (!element.classList.contains('interactive-hover')) {
            element.classList.add('interactive-hover');
        }
    });
    
    // Add button hover effects to specific buttons
    const buttons = document.querySelectorAll('button:not(.bucket-toggle)');
    buttons.forEach(button => {
        if (!button.classList.contains('button-hover')) {
            button.classList.add('button-hover');
        }
    });
    
    // Add special focus effects
    const focusableElements = document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusableElements.forEach(element => {
        element.addEventListener('focus', function() {
            this.style.outline = '2px solid var(--accent)';
            this.style.outlineOffset = '2px';
            this.style.borderRadius = '4px';
        });
        
        element.addEventListener('blur', function() {
            this.style.outline = '';
            this.style.outlineOffset = '';
        });
    });
}

/**
 * Add smooth transitions to all elements that change
 */
function addSmoothTransitions() {
    // Add transitions to monetary values
    const monetaryElements = document.querySelectorAll('.monetary-value, .total-value, .health-value');
    monetaryElements.forEach(element => {
        element.style.transition = 'color 300ms ease, transform 300ms ease';
    });
    
    // Add transitions to progress bars
    const progressBars = document.querySelectorAll('.progress-bar');
    progressBars.forEach(bar => {
        bar.style.transition = 'width 500ms cubic-bezier(0.4, 0, 0.2, 1), background 300ms ease';
    });
    
    // Add transitions to badges
    const badges = document.querySelectorAll('.badge, .warning-badge');
    badges.forEach(badge => {
        badge.style.transition = 'all 200ms ease-out';
    });
}

// Initialize page load sequence when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializePageLoadSequence, 100);
        enhanceInteractiveElements();
        addSmoothTransitions();
    });
} else {
    setTimeout(initializePageLoadSequence, 100);
    enhanceInteractiveElements();
    addSmoothTransitions();
}

// Enhanced app initialization
window.addEventListener('load', () => {
    // Add final polish animations
    setTimeout(() => {
        document.body.classList.add('app-loaded');
    }, 1000);
});

// Expose animation functions globally
window.animateNumber = animateNumber;