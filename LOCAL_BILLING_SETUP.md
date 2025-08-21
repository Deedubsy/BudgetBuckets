# Local Billing Setup for Development

## Overview
To test billing functionality locally, you need to configure Stripe test environment variables.

## Setup Steps

### 1. Get Stripe Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** and **Secret key** (both should start with `pk_test_` and `sk_test_`)

### 2. Create Local Environment File

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace the placeholder values:
   ```env
   # Replace these with your actual Stripe test keys
   STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   PRICE_ID_MONTHLY=price_your_price_id_here
   ```

### 3. Create Stripe Price

1. In [Stripe Dashboard](https://dashboard.stripe.com/test/products), create a product
2. Add a price: **$3.99 AUD monthly recurring**
3. Copy the Price ID (starts with `price_`) to your `.env` file

### 4. Set Up Webhook (Optional for Local Testing)

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to http://localhost:8080/api/billing/webhook
   ```
4. Copy the webhook secret (starts with `whsec_`) to your `.env` file

### 5. Start Development Server

```bash
npm run dev:full
```

You should see:
```
🔧 Environment check:
  STRIPE_SECRET_KEY: SET
  STRIPE_WEBHOOK_SECRET: SET  
  PRICE_ID_MONTHLY: SET
✅ Stripe initialized
```

## Testing Billing Flows

### Upgrade Flow
1. Login to the app
2. Go to Account page
3. Click "Upgrade $3.99/mo"
4. Use test card: `4242 4242 4242 4242`
5. Complete checkout → should return to app with Plus plan

### Manage Billing Flow  
1. Click "Manage Billing" 
2. Cancel subscription in Stripe portal
3. Return to app → should revert to Free plan

## Test Cards

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`

Any future expiry date and any 3-digit CVC will work.

## Production vs Development

- **Local Development**: Uses test Stripe keys from `.env`
- **Firebase App Hosting**: Uses production Stripe keys from Firebase Secret Manager

The `.env` file is gitignored and won't be deployed to production.