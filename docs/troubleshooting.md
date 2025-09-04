# Troubleshooting Guide

Common issues, error messages, and solutions for Budget Buckets development and production deployment.

## 1. Authentication Issues

### 1.1 Google Sign-In Problems

#### "Popup blocked" Error
**Symptoms**: Google sign-in popup doesn't appear, error in console
```
Error: auth/popup-blocked
```

**Solutions**:
1. **Allow popups** for your domain in browser settings
2. **Disable popup blockers** temporarily
3. **Check CSP headers** - ensure Google domains are allowed:
   ```javascript
   // server.js - Required CSP for Google Auth
   scriptSrc: [
     "'self'",
     "https://apis.google.com",
     "https://www.googleapis.com"
   ]
   ```

#### "Popup closed by user" Error
**Symptoms**: User closes Google popup before completing sign-in
```
Error: auth/popup-closed-by-user
```

**Solutions**:
- This is normal user behavior
- App shows retry message: "Sign-in cancelled. Please try again."
- No technical fix needed

#### "Firebase: No Firebase App '[DEFAULT]'"
**Symptoms**: Firebase not initialized properly
```
Error: Firebase: No Firebase App '[DEFAULT]' has been created
```

**Solutions**:
1. **Check firebase config**:
   ```javascript
   // auth/firebase.js - Verify config
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     // ... other config
   };
   ```

2. **Verify initialization order**:
   ```javascript
   // Initialize Firebase before using auth
   const app = initializeApp(firebaseConfig);
   const auth = getAuth(app);
   ```

### 1.2 Email Verification Issues

#### Verification Email Not Received
**Symptoms**: User doesn't receive email verification

**Solutions**:
1. **Check spam folder**
2. **Verify email template** in Firebase Console → Authentication → Templates
3. **Check SMTP configuration** in Firebase project settings
4. **Test with different email provider** (Gmail, Outlook, etc.)

#### "I've Verified" Button Not Working
**Symptoms**: Banner doesn't disappear after email verification

**Solutions**:
1. **Force user reload**:
   ```javascript
   // app/app-init.js - Force reload before checking
   await currentUser.reload();
   if (currentUser.emailVerified) {
     banner.style.display = 'none';
   }
   ```

2. **Check banner CSS**:
   ```css
   /* Use display: none instead of hidden attribute */
   .verification-banner {
     display: none; /* More reliable than hidden attribute */
   }
   ```

### 1.3 Token & Claims Issues

#### Plan Not Updating After Upgrade
**Symptoms**: User upgraded but still sees Free plan features

**Solutions**:
1. **Force token refresh**:
   ```javascript
   // app/lib/plan.js - Force refresh
   const tokenResult = await user.getIdTokenResult(true); // true = force refresh
   const plan = tokenResult.claims.plan || 'free';
   ```

2. **Check webhook processing**:
   ```bash
   # Check server logs for webhook events
   tail -f /var/log/app/server.log | grep webhook
   ```

3. **Verify custom claims in Firebase Console**:
   - Go to Authentication → Users
   - Check custom claims on user record

#### "Token expired" on Billing API
**Symptoms**: 401 errors when calling billing endpoints

**Solutions**:
1. **Refresh token before API calls**:
   ```javascript
   // app/account.js - Fresh token for billing
   const user = auth.currentUser;
   const token = await user.getIdToken(true); // Force fresh token
   ```

2. **Check token expiry**:
   ```javascript
   // Debug token expiry
   const tokenResult = await user.getIdTokenResult();
   console.log('Token expires:', new Date(tokenResult.expirationTime));
   ```

## 2. Billing Integration Issues

### 2.1 Stripe Configuration Problems

#### "Billing service not configured" Error
**Symptoms**: 503 error when trying to upgrade

**Solutions**:
1. **Check environment variables**:
   ```bash
   # Local development
   cat .env | grep STRIPE
   
   # Production (Google Cloud)
   gcloud secrets versions access latest --secret="stripe-secret-key"
   ```

2. **Verify server initialization**:
   ```javascript
   // server.js - Check Stripe initialization
   console.log('Stripe initialized:', !!stripe);
   ```

3. **Check apphosting.yaml**:
   ```yaml
   # Ensure secrets are properly referenced
   env:
     - variable: STRIPE_SECRET_KEY
       secret: stripe-secret-key
       availability:
         - RUNTIME
   ```

#### "Webhook signature verification failed"
**Symptoms**: Webhooks not processing, 400 errors in Stripe logs

**Solutions**:
1. **Verify webhook secret**:
   ```bash
   # Check secret value
   gcloud secrets versions access latest --secret="stripe-webhook-secret"
   ```

2. **Check endpoint URL** in Stripe Dashboard:
   ```
   Correct: https://your-domain.app/api/billing/webhook
   Wrong: https://your-domain.app/webhook
   ```

3. **Raw body requirement**:
   ```javascript
   // server.js - Webhook needs raw body
   app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
   ```

### 2.2 Customer Portal Issues

#### "No billing account found" Error
**Symptoms**: Can't access Customer Portal

**Solutions**:
1. **Check if user has Stripe customer**:
   ```javascript
   // Check Firestore for stripeCustomerId
   const userDoc = await db.collection('users').doc(uid).get();
   const customerId = userDoc.data()?.stripeCustomerId;
   ```

2. **Create customer during checkout**:
   ```javascript
   // server.js - Ensure customer created on first purchase
   const customers = await stripe.customers.list({ email, limit: 1 });
   if (customers.data.length === 0) {
     customer = await stripe.customers.create({ email });
   }
   ```

#### Portal Redirect Loop
**Symptoms**: Portal redirects back immediately

**Solutions**:
1. **Check return URL**:
   ```javascript
   // server.js - Ensure correct return URL
   const session = await stripe.billingPortal.sessions.create({
     customer: customerId,
     return_url: `${req.headers.origin}/app` // Must be absolute URL
   });
   ```

2. **Verify domain in Stripe**:
   - Go to Stripe Dashboard → Settings → Customer Portal
   - Check business settings and return URL domains

## 3. Firestore & Database Issues

### 3.1 Permission Denied Errors

#### "Permission denied" on Bucket Creation
**Symptoms**: Can't create buckets, security rules blocking

**Solutions**:
1. **Check plan limits**:
   ```javascript
   // Free users hitting 5-bucket limit
   if (plan === 'free' && bucketCount >= 5) {
     throw new Error('Free plan limited to 5 buckets');
   }
   ```

2. **Verify custom claims**:
   ```javascript
   // firestore.rules - Check getUserPlan function
   function getUserPlan() {
     return request.auth.token.plan != null ? request.auth.token.plan : 'free';
   }
   ```

3. **Check atomic operations**:
   ```javascript
   // Ensure counter and bucket created atomically
   await runTransaction(db, async (transaction) => {
     transaction.set(bucketRef, bucketData);
     transaction.set(counterRef, { total: currentCount + 1 });
   });
   ```

#### "Missing or insufficient permissions"
**Symptoms**: General Firestore access denied

**Solutions**:
1. **Verify authentication**:
   ```javascript
   // Check auth state
   const user = auth.currentUser;
   if (!user) {
     throw new Error('Please sign in to access buckets');
   }
   ```

2. **Check security rules ownership**:
   ```javascript
   // firestore.rules - Verify isOwner function
   function isOwner(uid) {
     return request.auth != null && request.auth.uid == uid;
   }
   ```

### 3.2 Data Consistency Issues

#### Bucket Counter Out of Sync
**Symptoms**: Counter doesn't match actual bucket count

**Solutions**:
1. **Recalculate counter**:
   ```javascript
   // Utility function to fix counter
   async function fixBucketCounter(userId) {
     const bucketsRef = collection(db, 'users', userId, 'budgets');
     const snapshot = await getDocs(bucketsRef);
     const actualCount = snapshot.size;
     
     const counterRef = doc(db, 'users', userId, 'meta', 'bucketCounts');
     await setDoc(counterRef, { total: actualCount }, { merge: true });
   }
   ```

2. **Prevent counter drift**:
   ```javascript
   // Always use transactions for bucket operations
   await runTransaction(db, async (transaction) => {
     // Read, modify, write atomically
   });
   ```

## 4. Deployment & Hosting Issues

### 4.1 App Hosting Deployment Failures

#### "Build failed: Module not found"
**Symptoms**: Deployment fails with missing modules

**Solutions**:
1. **Check package.json**:
   ```bash
   # Ensure all dependencies listed
   npm install --save express helmet compression
   ```

2. **Verify import paths**:
   ```javascript
   // Use relative paths for local modules
   const auth = require('./auth/firebase.js'); // Wrong
   import { auth } from './auth/firebase.js'; // Correct
   ```

#### "Permission denied" accessing secrets
**Symptoms**: Runtime errors about missing environment variables

**Solutions**:
1. **Check service account permissions**:
   ```bash
   gcloud projects add-iam-policy-binding your-project \
     --member="serviceAccount:firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

2. **Verify secret names match**:
   ```yaml
   # apphosting.yaml - Check exact names
   env:
     - variable: STRIPE_SECRET_KEY
       secret: stripe-secret-key  # Must match Google Cloud secret name
   ```

### 4.2 CSP Header Issues

#### "Refused to execute inline script"
**Symptoms**: JavaScript not working, CSP violations in console

**Solutions**:
1. **Move inline scripts to external files**:
   ```html
   <!-- Before: inline script -->
   <script>
     // Inline code here
   </script>
   
   <!-- After: external file -->
   <script src="/app/app-init.js" type="module"></script>
   ```

2. **Update CSP headers**:
   ```javascript
   // server.js - Allow required domains
   scriptSrc: [
     "'self'",
     "https://www.gstatic.com",      // Firebase SDK
     "https://cdn.jsdelivr.net"     // External libraries
   ]
   ```

#### "Refused to connect to Firebase"
**Symptoms**: Firebase API calls blocked by CSP

**Solutions**:
```javascript
// server.js - Add Firebase domains to CSP
connectSrc: [
  "'self'",
  "https://firestore.googleapis.com",
  "https://identitytoolkit.googleapis.com", 
  "https://securetoken.googleapis.com"
]
```

## 5. Performance Issues

### 5.1 Slow Loading

#### "Firebase SDK taking too long to load"
**Symptoms**: Long delay before authentication works

**Solutions**:
1. **Use CDN imports** (already implemented):
   ```javascript
   // Faster than npm bundle
   import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
   ```

2. **Lazy load non-critical features**:
   ```javascript
   // Load Chart.js only when needed
   const loadChart = () => import('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js');
   ```

#### "App feels sluggish on mobile"
**Symptoms**: Slow interactions, janky animations

**Solutions**:
1. **Reduce JavaScript bundle size**:
   ```bash
   # Audit bundle size
   npx webpack-bundle-analyzer dist/main.js
   ```

2. **Optimize critical rendering path**:
   ```html
   <!-- Preload critical CSS -->
   <link rel="preload" href="/app/styles.css" as="style">
   
   <!-- Defer non-critical scripts -->
   <script defer src="/app/analytics.js"></script>
   ```

## 6. Testing & Development

### 6.1 Local Development Issues

#### "Firebase emulators not connecting"
**Symptoms**: Can't connect to Firestore emulator

**Solutions**:
1. **Check emulator ports**:
   ```bash
   # Verify emulators running
   firebase emulators:start --only auth,firestore
   
   # Check ports
   lsof -i :8080,9099,8081
   ```

2. **Use emulator flag**:
   ```
   http://localhost:8080/?emulator=true
   ```

#### "Environment variables not loading"
**Symptoms**: Stripe keys not found in development

**Solutions**:
1. **Check .env file**:
   ```bash
   # Verify file exists and has correct format
   ls -la .env
   cat .env | grep STRIPE_SECRET_KEY
   ```

2. **Check dotenv loading**:
   ```javascript
   // server.js - Ensure dotenv loaded
   if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env')) {
     require('dotenv').config();
   }
   ```

### 6.2 Production Debugging

#### "How to check webhook delivery"
**Solutions**:
1. **Stripe Dashboard**:
   - Go to Webhooks → your endpoint
   - Check "Attempts" tab for delivery logs

2. **App Hosting logs**:
   ```bash
   # View logs in Firebase Console
   firebase functions:log --only apphosting
   ```

3. **Test webhook manually**:
   ```bash
   # Use Stripe CLI
   stripe events resend evt_1234567890
   ```

## 7. Emergency Recovery

### 7.1 Complete Auth Failure

**Symptoms**: Nobody can sign in to the app

**Recovery Steps**:
1. **Check Firebase project status**
2. **Verify API keys not expired**
3. **Test with fresh browser/incognito**
4. **Check DNS/domain configuration**
5. **Rollback recent changes if needed**

### 7.2 Billing System Down

**Symptoms**: Upgrades and billing management broken

**Recovery Steps**:
1. **Check Stripe status**: https://status.stripe.com
2. **Verify webhook endpoint responding**
3. **Test with Stripe CLI**
4. **Check Google Cloud Secret Manager**
5. **Failover to maintenance mode if needed**

---

**Last updated: 21 Aug 2025 (AEST)**