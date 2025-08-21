# Stripe Setup Guide

Complete guide to configure Stripe billing for Budget Buckets with Checkout, Customer Portal, and webhook integration.

## Prerequisites

- Stripe account (test and live environments)
- Firebase project with App Hosting enabled
- Google Cloud Secret Manager access

## 1. Create Stripe Product & Price

### 1.1 Create Product

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Click **+ Add product**
3. Fill in product details:
   ```
   Name: Budget Buckets Plus
   Description: Unlimited buckets and priority support
   Statement descriptor: BUDGETBUCKETS
   ```
4. Click **Save product**

### 1.2 Create Monthly Price

1. In your product, click **+ Add price**
2. Configure the price:
   ```
   Price model: Standard pricing
   Price: $3.99 AUD
   Billing period: Monthly
   Price description: Monthly Plus Plan
   ```
3. Click **Save price**
4. **Copy the Price ID** (starts with `price_`) - you'll need this for environment variables

## 2. Configure Customer Portal

### 2.1 Portal Settings

1. Go to [Customer Portal settings](https://dashboard.stripe.com/test/settings/billing/portal)
2. **Enable** Customer Portal
3. Configure business information:
   ```
   Business name: Budget Buckets
   Privacy policy: https://budgetbucket.app/privacy
   Terms of service: https://budgetbucket.app/terms
   ```

### 2.2 Portal Features

Enable these features for customers:
- ✅ **Subscription cancellation** (immediate)
- ✅ **Subscription pausing** (optional)
- ✅ **Payment method updates**
- ✅ **Invoice history**
- ❌ **Subscription changes** (we only have one plan)

## 3. API Keys & Secrets

### 3.1 Get API Keys

1. Go to [API Keys](https://dashboard.stripe.com/test/apikeys)
2. Copy these keys:
   - **Publishable key** (starts with `pk_test_`) - for client-side (not used in our server-only setup)
   - **Secret key** (starts with `sk_test_`) - for server-side API calls

### 3.2 Create Webhook Endpoint

1. Go to [Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **+ Add endpoint**
3. Configure webhook:
   ```
   Endpoint URL: https://your-domain.app/api/billing/webhook
   Events to send:
   - customer.subscription.created
   - customer.subscription.updated  
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
   ```
4. Click **Add endpoint**
5. **Copy the webhook signing secret** (starts with `whsec_`)

## 4. Environment Configuration

### 4.1 Local Development (.env)

Create `.env` file for local testing:

```bash
# Copy example and fill with your test keys
cp .env.example .env
```

Edit `.env`:
```env
# Stripe Test Configuration
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here  
PRICE_ID_MONTHLY=price_your_price_id_here

# Firebase Project
GOOGLE_CLOUD_PROJECT=your-project-id
NODE_ENV=development
```

### 4.2 Production Secrets (Firebase App Hosting)

Set up secrets in Google Cloud Secret Manager:

```bash
# Create secrets (replace with your live keys)
gcloud secrets create stripe-secret-key --data="sk_live_your_live_secret_key"
gcloud secrets create stripe-webhook-secret --data="whsec_your_live_webhook_secret"

# Verify secrets were created
gcloud secrets list --filter="name:stripe"
```

### 4.3 App Hosting Configuration

Your `apphosting.yaml` should reference these secrets:

```yaml
# apphosting.yaml
env:
  - variable: NODE_ENV
    value: production

  # Price ID (safe to store as plain env var)  
  - variable: PRICE_ID_MONTHLY
    value: price_your_live_price_id_here
    availability:
      - RUNTIME

  # Stripe secrets (stored in Secret Manager)
  - variable: STRIPE_SECRET_KEY
    secret: stripe-secret-key
    availability:
      - RUNTIME

  - variable: STRIPE_WEBHOOK_SECRET  
    secret: stripe-webhook-secret
    availability:
      - RUNTIME
```

## 5. Server Implementation

### 5.1 Billing API Endpoints

Our Express server implements these Stripe endpoints:

```javascript
// server.js - Stripe initialization
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Checkout session creation
app.post('/api/billing/checkout', async (req, res) => {
  // 1. Verify Firebase ID token
  // 2. Create/find Stripe customer
  // 3. Create Checkout session
  // 4. Store customer ID in Firestore
  // 5. Return checkout URL
});

// Customer Portal access
app.post('/api/billing/portal', async (req, res) => {
  // 1. Verify Firebase ID token  
  // 2. Get customer ID from Firestore
  // 3. Create Portal session
  // 4. Return portal URL
});

// Webhook handler
app.post('/api/billing/webhook', async (req, res) => {
  // 1. Verify webhook signature
  // 2. Handle subscription events
  // 3. Update Firestore + Firebase custom claims
});
```

### 5.2 Environment Variable Support

The server supports both naming conventions:

```javascript
// server.js - Flexible environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env['stripe-secret-key'];
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env['stripe-webhook-secret'];
```

This allows:
- **Local development**: `STRIPE_SECRET_KEY` (underscore)  
- **App Hosting**: `stripe-secret-key` (hyphen) from Secret Manager

## 6. Webhook Implementation

### 6.1 Subscription Events

```javascript
// server.js - Webhook event handling
switch (event.type) {
  case 'customer.subscription.created':
  case 'customer.subscription.updated':
    const subscription = event.data.object;
    const status = subscription.status;
    const firebaseUid = subscription.metadata?.firebase_uid;
    
    // Update Firestore user document
    await db.collection('users').doc(firebaseUid).set({
      subscriptionId: subscription.id,
      subscriptionStatus: status,
      planType: status === 'active' ? 'plus' : 'free',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Set custom claims for plan access
    await admin.auth().setCustomUserClaims(firebaseUid, {
      plan: status === 'active' ? 'plus' : 'free'
    });
    break;
    
  case 'customer.subscription.deleted':
    // Revert to free plan
    await admin.auth().setCustomUserClaims(firebaseUid, { plan: 'free' });
    break;
}
```

### 6.2 Security

```javascript
// server.js - Webhook signature verification
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
```

## 7. Client-Side Integration

### 7.1 Checkout Flow

```javascript
// app/account.js - Upgrade to Plus
async function upgradeToPlus() {
  const user = auth.currentUser;
  const token = await user.getIdToken();
  
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uid: user.uid,
      email: user.email,
      priceId: PRICE_ID_MONTHLY
    })
  });
  
  const { url } = await response.json();
  window.location.href = url; // Redirect to Stripe Checkout
}
```

### 7.2 Portal Access

```javascript
// app/account.js - Manage billing
async function manageBilling() {
  const user = auth.currentUser;
  const token = await user.getIdToken();
  
  const response = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const { url } = await response.json();
  window.location.href = url; // Redirect to Customer Portal
}
```

### 7.3 Plan State Management

```javascript
// app/lib/plan.js - Plan change detection
export function watchPlan(onChange) {
  const auth = getAuth();
  
  // Listen for token changes (after webhook updates claims)
  onIdTokenChanged(auth, async (user) => {
    if (user) {
      const tokenResult = await user.getIdTokenResult(true);
      const plan = tokenResult.claims.plan || 'free';
      onChange(plan);
    }
  });
  
  // Refresh on billing returns
  if (urlParams.has('upgraded') || urlParams.has('billing')) {
    setTimeout(() => refreshPlan(), 500);
  }
}
```

## 8. Testing

### 8.1 Test Cards

Use these test card numbers:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0027 6000 3184` | 3D Secure authentication |

Any future expiry date and any 3-digit CVC will work.

### 8.2 Local Testing with Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://github.com/stripe/stripe-cli

# Login to your Stripe account  
stripe login

# Forward webhooks to local server
stripe listen --forward-to http://localhost:8080/api/billing/webhook

# Copy the webhook secret (whsec_...) to your .env file
```

### 8.3 Test Flow

1. **Upgrade Flow**:
   - Sign in to app → Account page
   - Click "Upgrade $3.99/mo" → Stripe Checkout
   - Use test card `4242 4242 4242 4242`
   - Complete payment → Return to app
   - Verify Plus plan active

2. **Cancel Flow**:
   - Click "Manage Billing" → Customer Portal
   - Cancel subscription → Return to app  
   - Verify reverted to Free plan (may take a few seconds)

## 9. Production Checklist

✅ **Stripe Dashboard**
- [ ] Product created with correct price (AUD $3.99/month)
- [ ] Customer Portal enabled with business info
- [ ] Webhook endpoint configured with all required events
- [ ] Live API keys generated (starts with `sk_live_`)

✅ **Google Cloud Secret Manager**
- [ ] `stripe-secret-key` secret created with live key
- [ ] `stripe-webhook-secret` secret created
- [ ] Firebase service account has access to secrets

✅ **App Hosting Configuration**  
- [ ] `apphosting.yaml` references correct secrets
- [ ] `PRICE_ID_MONTHLY` set to live price ID
- [ ] Webhook URL points to production domain

✅ **Testing**
- [ ] Live webhook receives events from Stripe
- [ ] Subscription creation → Plus plan activated
- [ ] Subscription cancellation → Free plan restored
- [ ] Customer Portal functions work correctly

## 10. Troubleshooting

### "Billing service not configured" error

**Cause**: Missing `STRIPE_SECRET_KEY` environment variable  
**Fix**: Check secret configuration in Google Cloud Secret Manager

### Webhook signature verification failed

**Cause**: Wrong webhook secret or modified payload  
**Fix**: Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard

### "No billing account found" when accessing Portal

**Cause**: User hasn't upgraded yet (no Stripe customer created)  
**Fix**: This is expected - only show Portal for Plus users

### Payment succeeded but plan not updated

**Cause**: Webhook not receiving events or Firebase claims not refreshing  
**Fix**: Check webhook logs and ensure client calls `getIdTokenResult(true)`

---

**Last updated: 21 Aug 2025 (AEST)**