# Secrets Configuration for Firebase App Hosting

## 📋 Required Secrets

Before deploying, configure these secrets in Firebase Secret Manager:

### 1. Stripe Secret Key
```bash
# Create secret in Firebase Console or CLI
firebase secrets:set stripe-secret-key
# Enter your Stripe secret key when prompted: sk_test_...
```

### 2. Stripe Webhook Secret  
```bash
# Create secret in Firebase Console or CLI
firebase secrets:set stripe-webhook-secret
# Enter your Stripe webhook secret when prompted: whsec_...
```

## 🔧 Firebase Console Method

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Build** → **App Hosting** 
4. Go to **Environment** → **Secrets**
5. Add the following secrets:
   - **Name**: `stripe-secret-key`, **Value**: Your Stripe secret key (sk_test_... or sk_live_...)
   - **Name**: `stripe-webhook-secret`, **Value**: Your Stripe webhook secret (whsec_...)

## 🎯 Environment Variable Mapping

The `apphosting.yaml` file references these secrets:

```yaml
env:
  - variable: STRIPE_SECRET_KEY
    secret: stripe-secret-key  # ← Firebase Secret Manager name
    
  - variable: STRIPE_WEBHOOK_SECRET
    secret: stripe-webhook-secret  # ← Firebase Secret Manager name
```

## 🚀 Deployment Notes

- Secrets are automatically injected as environment variables at runtime
- Never commit actual secret values to git
- Use test keys for development, live keys for production
- Rotate secrets periodically for security

## 🔍 Verification

After deployment, verify secrets are loaded:
```javascript
// In server.js - these should be defined
console.log('STRIPE_SECRET_KEY loaded:', !!process.env.STRIPE_SECRET_KEY);
console.log('STRIPE_WEBHOOK_SECRET loaded:', !!process.env.STRIPE_WEBHOOK_SECRET);
```