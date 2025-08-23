# Local Billing Setup for Development

> **⚠️ Note**: This is a quick setup guide for local development. For comprehensive documentation, see:
> - **[Setup Stripe Billing](./docs/setup-stripe.md)** - Complete Stripe configuration
> - **[App Hosting Deploy](./docs/app-hosting-deploy.md)** - Production deployment
> - **[Troubleshooting](./docs/troubleshooting.md)** - Common issues and fixes

## Quick Start

### 1. Get Stripe Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Secret key** (starts with `sk_test_`)

### 2. Create Local Environment File

```bash
# Copy example file
cp .env.example .env

# Edit with your test keys
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
PRICE_ID_MONTHLY=price_your_price_id_here
```

### 3. Create Stripe Product & Price

1. In [Stripe Dashboard](https://dashboard.stripe.com/test/products), create a product
2. Add a price: **$3.99 AUD monthly recurring**
3. Copy the Price ID (starts with `price_`) to your `.env` file

### 4. Start Development Server

```bash
npm run dev:full
```

✅ **Success indicators**:
```
🔧 Environment check:
  STRIPE_SECRET_KEY: SET
  STRIPE_WEBHOOK_SECRET: SET  
  PRICE_ID_MONTHLY: SET
✅ Stripe initialized
```

## Testing Flows

### Complete Test Sequence

1. **Sign up** → Email verification → App access
2. **Create 5 buckets** → Hit free limit → Upgrade prompt
3. **Upgrade to Plus** → Stripe Checkout → Unlimited buckets
4. **Manage billing** → Customer Portal → Cancel subscription
5. **Verify downgrade** → Back to Free plan → 5 bucket limit

### Test Cards

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Decline |
| `4000 0027 6000 3184` | 🔐 3D Secure |

*Any future expiry date and 3-digit CVC works*

## Webhook Testing (Optional)

For local webhook testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local server
stripe listen --forward-to http://localhost:8080/api/billing/webhook

# Copy the webhook secret (whsec_...) to your .env file
```

## Environment Overview

| Environment | Stripe Keys | Configuration |
|-------------|-------------|---------------|
| **Local Development** | Test keys from `.env` | This guide |
| **Firebase App Hosting** | Live keys from Secret Manager | [Deploy Guide](./docs/app-hosting-deploy.md) |

## Need Help?

- **Setup Issues**: See [Setup Stripe Guide](./docs/setup-stripe.md)
- **Deployment Problems**: See [App Hosting Deploy](./docs/app-hosting-deploy.md)  
- **Errors & Debugging**: See [Troubleshooting Guide](./docs/troubleshooting.md)
- **Complete Documentation**: See [README.md](./README.md)

---

**Last updated: 21 Aug 2025 (AEST)**