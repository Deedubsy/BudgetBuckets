// Modern Stripe.js Payment Integration
let stripe = null;
let elements = null;
let paymentElement = null;

/**
 * Initialize Stripe.js with publishable key
 */
export async function initializeStripe() {
  try {
    // Load Stripe.js library
    if (!window.Stripe) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      document.head.appendChild(script);
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    }
    
    // Get publishable key from server
    const response = await fetch('/api/billing/stripe-key');
    if (!response.ok) {
      throw new Error('Failed to get Stripe publishable key');
    }
    
    const { publishableKey } = await response.json();
    
    // Initialize Stripe
    stripe = window.Stripe(publishableKey);
    
    return stripe;
    
  } catch (error) {
    console.error('Error initializing Stripe:', error);
    throw error;
  }
}

/**
 * Create and mount payment element for subscription
 */
export async function createPaymentElement(containerId, options = {}) {
  if (!stripe) {
    throw new Error('Stripe not initialized. Call initializeStripe() first.');
  }
  
  try {
    // Get setup intent client secret from server
    const response = await fetch('/api/billing/setup-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.idToken}`
      },
      body: JSON.stringify({
        uid: options.uid,
        email: options.email,
        priceId: options.priceId
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create setup intent');
    }
    
    const { clientSecret, customerId } = await response.json();
    
    // Create elements instance
    elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#00cdd6',
          colorBackground: '#0f1720',
          colorText: '#ffffff',
          colorDanger: '#ff6b6b',
          borderRadius: '8px'
        }
      }
    });
    
    // Create payment element
    paymentElement = elements.create('payment', {
      layout: 'tabs'
    });
    
    // Mount to container
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with ID "${containerId}" not found`);
    }
    
    paymentElement.mount(`#${containerId}`);
    
    return { elements, paymentElement, clientSecret, customerId };
    
  } catch (error) {
    console.error('Error creating payment element:', error);
    throw error;
  }
}

/**
 * Process subscription payment
 */
export async function processSubscriptionPayment(options = {}) {
  if (!stripe || !elements) {
    throw new Error('Stripe or Elements not initialized');
  }
  
  try {
    // Confirm setup intent with payment method
    const { error: setupError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/app?upgrade=success`
      },
      redirect: 'if_required'
    });
    
    if (setupError) {
      throw setupError;
    }
    
    // If setup successful, create subscription
    const response = await fetch('/api/billing/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.idToken}`
      },
      body: JSON.stringify({
        uid: options.uid,
        customerId: options.customerId,
        paymentMethodId: setupIntent.payment_method,
        priceId: options.priceId
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create subscription');
    }
    
    const subscription = await response.json();
    
    return {
      success: true,
      subscription,
      setupIntent
    };
    
  } catch (error) {
    console.error('Error processing payment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Show payment processing UI
 */
export function showPaymentProcessing(buttonEl) {
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.innerHTML = '<span class="loading-spinner"></span>Processing...';
  }
}

/**
 * Reset payment UI
 */
export function resetPaymentUI(buttonEl, originalText = 'Upgrade to Plus — $3.99/mo') {
  if (buttonEl) {
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
  }
}

/**
 * Handle payment result and show feedback
 */
export function handlePaymentResult(result, options = {}) {
  const { onSuccess, onError } = options;
  
  if (result.success) {
    if (onSuccess) {
      onSuccess(result);
    } else {
      // Default success handling
      showToast('Subscription activated successfully!', 'success');
      
      // Refresh page or update UI
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  } else {
    if (onError) {
      onError(result.error);
    } else {
      // Default error handling
      showToast(result.error || 'Payment failed. Please try again.', 'error');
    }
  }
}

/**
 * Utility function to show toast notifications
 * (matches the existing pattern in account.js)
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