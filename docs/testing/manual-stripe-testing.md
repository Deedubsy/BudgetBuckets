# Manual Stripe Testing Guide

This guide covers manual testing scenarios for the Budget Buckets Stripe integration after the confirmSetup fixes.

## Prerequisites

1. **Development Environment Running**
   ```bash
   npm run dev
   # Server should be running on http://localhost:8080
   ```

2. **Test Stripe Keys Configured**
   - Ensure `.env` has real Stripe test keys (not placeholders)
   - Verify `/api/billing/config` returns valid keys

3. **Test User Account**
   - Have a Firebase test user account ready
   - User should be on Free plan initially

## Test Cards

Use these Stripe test cards for different scenarios:

| Card Number | Description | Expected Behavior |
|-------------|-------------|-------------------|
| `4242 4242 4242 4242` | Basic successful card | No 3DS, immediate success |
| `4000 0000 0000 3220` | 3DS authentication required | Shows 3DS challenge iframe |
| `4000 0000 0000 0002` | Card declined | Shows decline error message |
| `4000 0000 0000 9995` | Insufficient funds | Shows insufficient funds error |

**For all cards:**
- **Expiry**: Any future date (e.g., `12/25`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any valid ZIP (e.g., `12345`)

## Test Scenarios

### 1. Basic Payment Flow (No 3DS)

**Steps:**
1. Navigate to `http://localhost:8080/app`
2. Sign in with test user account
3. Verify "Upgrade to Plus" button is visible with `data-testid="upgrade-btn"`
4. Click "Upgrade to Plus" button
5. Verify payment modal opens with payment form
6. Enter test card: `4242 4242 4242 4242`
7. Fill out form completely
8. Verify "Complete Payment" button becomes enabled
9. Click "Complete Payment - $3.99/mo"
10. Wait for processing (should complete without redirect)

**Expected Results:**
- ✅ Payment form loads without errors
- ✅ Button becomes enabled when form is complete  
- ✅ Payment processes successfully
- ✅ Success message appears
- ✅ Page reloads showing Plus plan
- ✅ "Manage Billing" button replaces "Upgrade" button

**Console Logs to Verify:**
```
✅ Stripe initialized successfully
🔧 Creating payment element...
✅ Payment element created: true
🔧 Starting payment confirmation...
✅ Form validation passed
🔧 Confirming setup intent...
✅ Setup intent confirmed: succeeded  
🔧 Creating subscription...
✅ Subscription created successfully
```

### 2. 3DS Authentication Flow

**Steps:**
1. Follow steps 1-6 from Basic Payment Flow
2. Enter 3DS test card: `4000 0000 0000 3220`
3. Fill out form completely  
4. Click "Complete Payment - $3.99/mo"
5. **CRITICAL**: 3DS challenge iframe should appear
6. Complete the 3DS challenge (click "Complete authentication")
7. Wait for processing to complete

**Expected Results:**
- ✅ 3DS iframe appears from `hooks.stripe.com`
- ✅ No CSP errors in console about blocked frames
- ✅ 3DS challenge completes successfully
- ✅ Payment processes after 3DS completion
- ✅ Success flow same as basic payment

**Critical Verification:**
- Network tab should show requests to:
  - `https://api.stripe.com` (API calls)
  - `https://hooks.stripe.com` (3DS iframe)
- No CSP violation errors in console

### 3. Declined Card Flow

**Steps:**
1. Follow steps 1-6 from Basic Payment Flow
2. Enter declined card: `4000 0000 0000 0002`
3. Fill out form and click "Complete Payment"

**Expected Results:**
- ✅ Clear error message displayed
- ✅ "Complete Payment" button resets to clickable state
- ✅ User can retry with different card
- ✅ No subscription created

### 4. Subscription Management

**After successful payment (Plus user):**

**Steps:**
1. Verify "Manage Billing" button visible with `data-testid="manage-billing-btn"`
2. Click "Manage Billing" 
3. Should redirect to Stripe Customer Portal
4. Test cancellation in portal
5. Return to app
6. Verify plan reverts to Free after webhook processing

**Expected Results:**
- ✅ Customer Portal loads successfully
- ✅ Can cancel subscription in portal
- ✅ Webhook updates plan back to Free
- ✅ UI updates to show Free plan within 30 seconds

## Technical Verification

### Network Requests

Monitor these requests in browser dev tools:

1. **Billing Config**: `GET /api/billing/config`
   - Should return `{ publishableKey: "pk_test_...", priceId: "price_..." }`

2. **Setup Intent**: `POST /api/billing/setup-intent`
   - Should return `{ clientSecret: "seti_...", customerId: "cus_..." }`
   - Must include `Authorization: Bearer <firebase-token>` header

3. **Create Subscription**: `POST /api/billing/create-subscription`
   - Should return subscription data or SCA requirement
   - Must include `Authorization: Bearer <firebase-token>` header

### Console Verification

Check for these key log messages:

```javascript
// Initialization
✅ Stripe initialized successfully  
✅ Payment element created: true

// Payment flow
🔧 Starting payment confirmation...
✅ Form validation passed
🔧 Confirming setup intent...
✅ Setup intent confirmed: succeeded
🔧 Creating subscription...

// SCA handling (if required)
🔧 First invoice requires SCA - confirming payment...
✅ First invoice SCA completed
```

### Error Scenarios to Test

1. **No Payment Details**: Try clicking "Complete Payment" without entering card
   - Should show validation error

2. **Network Timeout**: Disable network mid-payment
   - Should show appropriate error message

3. **Invalid Card**: Enter obviously invalid card number
   - Should show validation error before submission

## Post-Deployment Verification

After deploying to production:

1. **CSP Verification**: 
   - Open browser console on production site
   - Trigger payment flow
   - Verify no CSP violations for Stripe domains

2. **3DS Testing**:
   - Use 3DS test card in production environment
   - Verify iframe loads from `hooks.stripe.com`
   - Complete 3DS challenge successfully

3. **Webhook Testing**:
   - Complete test payment
   - Verify webhook receives events in server logs
   - Verify user plan updates correctly

## Troubleshooting Common Issues

### "Stripe not initialized" Error
- Check `/api/billing/config` returns valid data
- Verify no CSP errors blocking Stripe.js loading
- Check console for specific initialization errors

### "confirmSetup hangs" Issue  
- Should be resolved by fixes, but if it occurs:
- Check for CSP frame-src blocking `hooks.stripe.com`
- Verify no Promise.race timeout interfering with 3DS
- Check network tab for failed requests

### 3DS Challenge Not Appearing
- Verify CSP includes `frame-src https://hooks.stripe.com`  
- Check for iframe blocking browser extensions
- Verify using 3DS test card (`4000 0000 0000 3220`)

### Webhook Not Updating Plan
- Check server logs for webhook signature verification
- Verify webhook endpoint configured in Stripe Dashboard
- Check Firebase custom claims are being set correctly

## Success Criteria Checklist

- [ ] Basic payment flow completes successfully
- [ ] 3DS challenge appears and completes for 3DS cards
- [ ] Declined cards show appropriate error messages
- [ ] Network requests include proper authorization headers
- [ ] CSP allows all required Stripe domains
- [ ] Subscription creation handles SCA requirements
- [ ] Customer Portal integration works
- [ ] Plan status updates correctly via webhooks
- [ ] UI updates reflect plan changes without full page reload
- [ ] No console errors during payment flow
- [ ] All test IDs present for automated testing

## Environment Variables Check

Before testing, verify these environment variables are set:

```bash
# Required for testing
STRIPE_SECRET_KEY=sk_test_...         # Real test secret key
STRIPE_PUBLISH_KEY=pk_test_...        # Real test publishable key  
STRIPE_WEBHOOK_SECRET=whsec_...       # Real webhook secret
PRICE_ID_MONTHLY=price_...            # Real Stripe price ID

# Firebase project
GOOGLE_CLOUD_PROJECT=budgetbuckets-79b3b

# Node environment
NODE_ENV=development
```

All keys should be **real Stripe test keys**, not placeholders.