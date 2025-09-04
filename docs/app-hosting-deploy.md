# Firebase App Hosting Deployment Guide

Complete guide to deploy Budget Buckets to Firebase App Hosting with environment variables, secrets, and Express server configuration.

## Prerequisites

- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with App Hosting enabled
- Google Cloud CLI: `gcloud auth login`
- Stripe live keys and webhook endpoint configured

## 1. App Hosting Configuration

### 1.1 apphosting.yaml Setup

Our deployment configuration in `apphosting.yaml`:

```yaml
# Firebase App Hosting configuration for Budget Buckets

# Build settings
env:
  - variable: NODE_ENV
    value: production

  # Public price ID (safe for server-side only)
  - variable: PRICE_ID_MONTHLY
    value: price_1ABCDEFGHijklmnop123456  # Your live Stripe price ID
    availability:
      - RUNTIME

  # Stripe secrets (stored in Google Cloud Secret Manager)
  - variable: STRIPE_SECRET_KEY
    secret: stripe-secret-key
    availability:
      - RUNTIME

  - variable: STRIPE_WEBHOOK_SECRET
    secret: stripe-webhook-secret
    availability:
      - RUNTIME

# Runtime configuration
runConfig:
  runtime: nodejs20
  minInstances: 0      # Scale to zero when not in use
  maxInstances: 10     # Scale up under load
  concurrency: 100     # Requests per instance
  cpu: 1               # 1 vCPU
  memoryMiB: 512       # 512MB RAM

# Additional secrets (if needed)
secrets: []
```

### 1.2 Runtime Settings Explained

| Setting | Value | Purpose |
|---------|-------|---------|
| `runtime: nodejs20` | Node.js 20 | Latest LTS with ES modules support |
| `minInstances: 0` | Scale to zero | Cost optimization for low traffic |
| `maxInstances: 10` | Scale limit | Prevent runaway costs |
| `concurrency: 100` | Requests/instance | Handle multiple connections |
| `cpu: 1` | 1 vCPU | Sufficient for Express + Stripe APIs |
| `memoryMiB: 512` | 512MB RAM | Efficient for stateless server |

## 2. Secret Management

### 2.1 Google Cloud Secret Manager

Create secrets for sensitive Stripe data:

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project your-firebase-project-id

# Create Stripe secret key (live)
gcloud secrets create stripe-secret-key --data="sk_live_your_stripe_secret_key_here"

# Create Stripe webhook secret  
gcloud secrets create stripe-webhook-secret --data="whsec_your_webhook_secret_here"

# Verify secrets were created
gcloud secrets list --filter="name:stripe"
```

### 2.2 Secret Access Permissions

Ensure Firebase service account can access secrets:

```bash
# Get your Firebase project's service account
gcloud projects get-iam-policy your-firebase-project-id

# Grant secret access (if needed)
gcloud projects add-iam-policy-binding your-firebase-project-id \
  --member="serviceAccount:firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2.3 Environment Variable Priority

The server supports flexible environment variable naming:

```javascript
// server.js - Environment variable resolution
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env['stripe-secret-key'];
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env['stripe-webhook-secret'];
```

This enables:
- **Local development**: `STRIPE_SECRET_KEY` (underscore naming)
- **App Hosting**: `stripe-secret-key` (hyphen naming from Secret Manager)

## 3. Express Server Configuration

### 3.1 Production Optimizations

Our `server.js` includes production-ready features:

```javascript
// server.js - Production configuration
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');

// Enable gzip compression
app.use(compression());

// Security headers with CSP
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.gstatic.com", "https://apis.google.com"],
      connectSrc: ["'self'", "https://firestore.googleapis.com", "https://identitytoolkit.googleapis.com"]
    }
  }
}));

// Static file serving with caching
app.use(express.static(__dirname, {
  maxAge: '1h',
  setHeaders: (res, filepath) => {
    if (filepath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));
```

### 3.2 Health Check Endpoint

App Hosting requires a health check:

```javascript
// server.js - Health check
app.get('/__/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'budget-buckets' });
});
```

### 3.3 Clean URL Routing

Express handles clean URLs without `.html` extensions:

```javascript
// server.js - Clean URL routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, 'pricing.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.html'));
});

// SPA fallback for /app/* routes
app.get('/app/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});
```

## 4. Deployment Process

### 4.1 Pre-deployment Checklist

✅ **Environment Setup**
- [ ] Stripe live keys in Google Cloud Secret Manager
- [ ] `PRICE_ID_MONTHLY` updated to live price ID
- [ ] Webhook endpoint pointing to production domain
- [ ] Firebase project billing enabled

✅ **Code Preparation**  
- [ ] All environment variables referenced in `apphosting.yaml`
- [ ] Secret names match Google Cloud Secret Manager
- [ ] Express routes configured for production
- [ ] CSP headers allow required external domains

### 4.2 Deploy Commands

```bash
# Navigate to project directory
cd BudgetBuckets

# Login to Firebase (if not already logged in)
firebase login

# Set Firebase project
firebase use your-firebase-project-id

# Deploy to App Hosting
firebase deploy --only apphosting

# Deploy Firestore rules (if changed)
firebase deploy --only firestore:rules

# Full deployment (if needed)
firebase deploy
```

### 4.3 Preview Deployments

Test changes with preview deployments:

```bash
# Create preview channel
firebase hosting:channel:deploy preview

# Deploy to preview
firebase deploy --only apphosting --preview

# Access preview URL
# https://your-project--preview-xxxxx.web.app
```

## 5. Custom Domain Setup

### 5.1 Add Custom Domain

1. Go to [Firebase Console](https://console.firebase.google.com/) → Hosting
2. Click **Add custom domain**
3. Enter your domain: `budgetbucket.app`
4. Follow DNS verification steps
5. Firebase will provision SSL certificate automatically

### 5.2 DNS Configuration

Add these DNS records to your domain provider:

```
Type: A
Name: @
Value: 151.101.1.195
TTL: 3600

Type: A  
Name: @
Value: 151.101.65.195
TTL: 3600

Type: AAAA
Name: @
Value: 2a04:4e42::645
TTL: 3600

Type: AAAA
Name: @
Value: 2a04:4e42:200::645  
TTL: 3600
```

### 5.3 Redirect Configuration

Set up redirects in `firebase.json`:

```json
{
  "hosting": {
    "redirects": [
      {
        "source": "/home.html",
        "destination": "/",
        "type": 301
      },
      {
        "source": "/pricing.html", 
        "destination": "/pricing",
        "type": 301
      }
    ]
  }
}
```

## 6. Monitoring & Logs

### 6.1 Application Logs

View logs in Firebase Console:

1. Go to **App Hosting** → your deployment
2. Click **Logs** tab  
3. Filter by severity: `INFO`, `WARN`, `ERROR`

### 6.2 Error Monitoring

Monitor common errors:

```javascript
// server.js - Error logging
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
```

### 6.3 Performance Monitoring

Key metrics to monitor:
- **Response time**: < 500ms for static content
- **Memory usage**: < 400MB (within 512MB limit)
- **Error rate**: < 1% of requests
- **Billing API latency**: < 2s for Stripe calls

## 7. Scaling Configuration

### 7.1 Auto-scaling Triggers

App Hosting automatically scales based on:
- **Request volume**: New instances when CPU > 80%
- **Response time**: Scale up if latency > 1s
- **Memory pressure**: Scale up if memory > 400MB

### 7.2 Scale Settings

Adjust scaling in `apphosting.yaml`:

```yaml
runConfig:
  minInstances: 1     # Always warm (faster response)
  maxInstances: 20    # Higher traffic capacity  
  concurrency: 50     # Lower per-instance load
  cpu: 2              # More CPU for complex operations
  memoryMiB: 1024     # More memory for caching
```

## 8. Troubleshooting Deployment

### Build Failures

**"Module not found" errors**
```bash
# Check package.json dependencies
npm install --production

# Verify all imports
node -c server.js
```

**"Permission denied" on secrets**
```bash
# Check secret access permissions
gcloud secrets versions access latest --secret="stripe-secret-key"
```

### Runtime Errors

**"PORT environment variable required"**
```javascript
// server.js - Use App Hosting port
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

**"Webhook signature verification failed"**
- Verify webhook secret in Google Cloud Secret Manager
- Check Stripe webhook endpoint URL matches deployment

### Performance Issues

**High memory usage**
- Monitor logs for memory leaks
- Reduce `concurrency` setting
- Increase `memoryMiB` allocation

**Slow response times**
- Enable compression for static assets
- Optimize Firestore queries
- Add Redis caching (if needed)

## 9. Production Checklist

✅ **Security**
- [ ] All secrets stored in Google Cloud Secret Manager
- [ ] CSP headers configured properly  
- [ ] HTTPS redirects enabled
- [ ] Firebase security rules deployed

✅ **Performance**
- [ ] Compression enabled for static assets
- [ ] Cache headers set for long-term assets
- [ ] Health check endpoint responding
- [ ] Auto-scaling configured appropriately

✅ **Monitoring**
- [ ] Error logging implemented
- [ ] Performance metrics tracked
- [ ] Webhook delivery monitoring
- [ ] Billing API error alerts

✅ **Testing**
- [ ] All routes accessible on production domain
- [ ] Auth flows working (Google + email/password)
- [ ] Billing integration functional
- [ ] Email verification working

---

**Last updated: 21 Aug 2025 (AEST)**