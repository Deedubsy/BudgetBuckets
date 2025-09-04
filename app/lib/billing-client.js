/**
 * Modern Stripe.js Billing Client
 * Uses loadStripe loader and proper Elements flow
 */

let stripe = null;
let elements = null;
let paymentElement = null;
let billingConfig = null;

/**
 * Initialize Stripe with loadStripe loader
 */
export async function initializeStripe() {
  try {
    console.log('🔧 Initializing Stripe with loadStripe...');
    
    // Fetch billing configuration
    const response = await fetch('/api/billing/config');
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get billing config:', response.status, errorText);
      throw new Error(`Failed to get billing config: ${response.status}`);
    }
    
    billingConfig = await response.json();
    console.log('✅ Billing config loaded:', { 
      hasPublishableKey: !!billingConfig.publishableKey, 
      hasPriceId: !!billingConfig.priceId 
    });
    
    // Load Stripe.js script if not already loaded
    if (!window.Stripe) {
      console.log('Loading Stripe.js script...');
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      document.head.appendChild(script);
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
      console.log('Stripe.js script loaded');
    }
    
    // Initialize Stripe with publishable key
    stripe = window.Stripe(billingConfig.publishableKey);
    
    if (!stripe) {
      throw new Error('Failed to initialize Stripe');
    }
    
    console.log('✅ Stripe initialized successfully');
    return stripe;
    
  } catch (error) {
    console.error('Error initializing Stripe:', error);
    throw error;
  }
}

/**
 * Create and mount payment element for subscription
 */
export async function createPaymentElement(containerId, userOptions = {}) {
  if (!stripe) {
    throw new Error('Stripe not initialized. Call initializeStripe() first.');
  }
  
  if (!billingConfig) {
    throw new Error('Billing config not loaded. Call initializeStripe() first.');
  }
  
  try {
    console.log('🎯 Creating payment element for container:', containerId);
    console.log('Options:', { 
      uid: !!userOptions.uid, 
      email: !!userOptions.email, 
      hasIdToken: !!userOptions.idToken 
    });
    
    // Create setup intent
    const response = await fetch('/api/billing/setup-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userOptions.idToken}`
      },
      body: JSON.stringify({
        uid: userOptions.uid,
        email: userOptions.email,
        priceId: billingConfig.priceId
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Setup intent failed:', response.status, errorData);
      throw new Error(errorData.error || `Failed to create setup intent: ${response.status}`);
    }
    
    const { clientSecret, customerId } = await response.json();
    console.log('✅ Setup intent created:', { 
      hasClientSecret: !!clientSecret, 
      customerId: !!customerId 
    });
    
    // Create elements instance with client secret
    elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#00cdd6',
          colorBackground: '#0f1720',
          colorText: '#ffffff',
          colorDanger: '#ff6b6b',
          borderRadius: '8px',
          spacingUnit: '4px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }
      }
    });
    
    // Create payment element
    paymentElement = elements.create('payment', {
      layout: 'tabs',
      defaultValues: {
        billingDetails: {
          email: userOptions.email
        }
      }
    });
    
    // Mount to container
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with ID "${containerId}" not found`);
    }
    
    paymentElement.mount(`#${containerId}`);
    
    // Add event listeners for UX improvements
    paymentElement.on('ready', () => {
      console.log('✅ Payment element mounted and ready');
      
      // Initially disable the complete payment button until form is filled
      const completePaymentBtn = document.querySelector('[data-testid="complete-payment-btn"]') || 
                               document.getElementById('complete-payment');
      if (completePaymentBtn) {
        completePaymentBtn.disabled = true;
        completePaymentBtn.textContent = 'Enter Payment Details';
        console.log('✅ Complete payment button initialized as disabled');
      }
    });
    
    paymentElement.on('change', (event) => {
      console.log('🔧 Payment element changed:', { 
        complete: event.complete, 
        error: !!event.error,
        errorMessage: event.error?.message 
      });
      
      // Update complete payment button state (in the modal)
      const completePaymentBtn = document.querySelector('[data-testid="complete-payment-btn"]') || 
                               document.getElementById('complete-payment');
      if (completePaymentBtn) {
        const wasDisabled = completePaymentBtn.disabled;
        completePaymentBtn.disabled = !event.complete;
        
        if (event.complete) {
          completePaymentBtn.textContent = 'Complete Payment - $3.99/mo';
        } else {
          completePaymentBtn.textContent = 'Enter Payment Details';
        }
        
        console.log(`🔘 Button updated: ${wasDisabled ? 'disabled' : 'enabled'} → ${completePaymentBtn.disabled ? 'disabled' : 'enabled'}`);
      } else {
        console.warn('⚠️ Complete payment button not found!');
      }
      
      // Show/hide errors
      if (event.error) {
        showPaymentError(event.error.message);
      } else {
        clearPaymentError();
      }
    });
    
    return { 
      elements, 
      paymentElement, 
      clientSecret, 
      customerId,
      priceId: billingConfig.priceId
    };
    
  } catch (error) {
    console.error('Error creating payment element:', error);
    throw error;
  }
}

/**
 * Process subscription payment with proper SCA handling
 */
export async function processSubscriptionPayment(options = {}) {
  if (!stripe || !elements) {
    throw new Error('Stripe or Elements not initialized');
  }
  
  try {
    console.log('🔧 Starting payment confirmation...');
    
    // Step 1: Submit form for validation
    console.log('🔧 Validating payment form...');
    const { error: submitError } = await elements.submit();
    if (submitError) {
      console.error('Form validation error:', submitError);
      throw submitError;
    }
    console.log('✅ Form validation passed');
    
    // Step 2: Confirm setup intent (no timeout - allow 3DS)
    console.log('🔧 Confirming setup intent...');
    const { error: setupError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/app?upgrade=success`
      },
      redirect: 'if_required'
    });
    
    if (setupError) {
      console.error('Setup confirmation error:', setupError);
      throw setupError;
    }
    
    console.log('✅ Setup intent confirmed:', setupIntent.status);
    
    // Step 3: Create subscription
    console.log('🔧 Creating subscription...');
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
      console.error('Subscription creation failed:', errorData);
      throw new Error(errorData.error || 'Failed to create subscription');
    }
    
    const subscriptionData = await response.json();
    console.log('Subscription response:', { 
      requiresAction: subscriptionData.requiresAction,
      hasSubscription: !!subscriptionData.subscription 
    });
    
    // Step 4: Handle first-invoice SCA if needed
    if (subscriptionData.requiresAction) {
      console.log('🔧 First invoice requires SCA - confirming payment...');
      
      const { error: confirmError } = await stripe.confirmPayment({
        clientSecret: subscriptionData.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/app?upgrade=success`
        },
        redirect: 'if_required'
      });
      
      if (confirmError) {
        console.error('First invoice SCA failed:', confirmError);
        throw confirmError;
      }
      
      console.log('✅ First invoice SCA completed');
    }
    
    return {
      success: true,
      subscription: subscriptionData.subscription,
      setupIntent,
      requiresAction: subscriptionData.requiresAction
    };
    
  } catch (error) {
    console.error('Error processing payment:', error);
    return {
      success: false,
      error: error.message || 'Payment failed'
    };
  }
}

/**
 * Show payment processing UI
 */
export function showPaymentProcessing(buttonEl, text = 'Processing...') {
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <div class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid currentColor; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        ${text}
      </div>
    `;
  }
  
  // Add spinner animation if not already present
  if (!document.getElementById('spinner-styles')) {
    const style = document.createElement('style');
    style.id = 'spinner-styles';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Reset payment UI
 */
export function resetPaymentUI(buttonEl, originalText = 'Complete Payment - $3.99/mo') {
  if (buttonEl) {
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
  }
}

/**
 * Show payment error in UI
 */
function showPaymentError(message) {
  let errorDiv = document.getElementById('payment-error');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'payment-error';
    errorDiv.style.cssText = `
      color: #ff6b6b;
      font-size: 14px;
      margin-top: 8px;
      padding: 8px;
      border: 1px solid #ff6b6b;
      border-radius: 4px;
      background: rgba(255, 107, 107, 0.1);
    `;
    
    const paymentContainer = document.getElementById('stripe-payment-element');
    if (paymentContainer) {
      paymentContainer.appendChild(errorDiv);
    }
  }
  
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

/**
 * Clear payment error
 */
function clearPaymentError() {
  const errorDiv = document.getElementById('payment-error');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

/**
 * Get current billing config
 */
export function getBillingConfig() {
  if (!billingConfig) {
    console.warn('⚠️ Billing config not loaded yet - call initializeStripe() first');
  }
  return billingConfig;
}