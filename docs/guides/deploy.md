---
title: "Budget Buckets - Deployment Guide"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["guide", "deployment", "production"]
---

# Deployment Guide

Complete guide to deploy Budget Buckets to production using Firebase App Hosting.

## Prerequisites

### Required Accounts
1. **Firebase Project** with Blaze plan (for production use)
2. **GitHub Repository** with source code
3. **Custom Domain** (optional but recommended)

### Required Tools
```bash
# Firebase CLI (latest version)
npm install -g firebase-tools

# Verify installation
firebase --version  # Should be >= 13.0.0
```

## Production Environment Setup

### 1. Firebase Project Configuration

#### Create Production Project
```bash
# Login to Firebase
firebase login

# Create new project (or use existing)
firebase projects:create budget-buckets-prod

# Set as default project
firebase use budget-buckets-prod
```

#### Enable Required Services
1. **Authentication**:
   ```bash
   # Enable Auth via console or CLI
   firebase auth:export users.json  # Will prompt to enable if needed
   ```

2. **Firestore Database**:
   ```bash
   # Deploy rules (will create database)
   firebase deploy --only firestore:rules
   ```

3. **App Hosting** (via Firebase Console):
   - Go to App Hosting in Firebase Console
   - Click "Get started"
   - Connect GitHub repository
   - Select branch for deployment

### 2. Domain and DNS Configuration

#### Custom Domain Setup
1. **Add Domain in Firebase Console**:
   - Go to App Hosting → Settings
   - Click "Add custom domain"
   - Enter your domain (e.g., `budgetbucket.app`)
   - Follow DNS verification steps

2. **DNS Configuration**:
   ```bash
   # Add these records to your DNS provider:
   # Type: A, Name: @, Value: [Firebase IP from console]
   # Type: A, Name: www, Value: [Firebase IP from console]
   # Type: TXT, Name: @, Value: [Verification string from console]
   ```

#### SSL Certificate
Firebase automatically provisions SSL certificates for custom domains.

## Deployment Configuration

### 1. Firebase Configuration Files

#### firebase.json
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "source": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "test/**",
      "docs/**"
    ],
    "headers": [
      {
        "source": "**/*.@(html|js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      },
      {
        "source": "**/*.html",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options", 
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      }
    ]
  }
}
```

#### .firebaserc
```json
{
  "projects": {
    "default": "budget-buckets-prod",
    "development": "budget-buckets-dev",
    "production": "budget-buckets-prod"
  },
  "targets": {}
}
```

### 2. Environment-Specific Configuration

#### Production Firebase Config
Update `auth/firebase-config.js` with production values:

```javascript
// auth/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyC_your_production_api_key",
  authDomain: "budget-buckets-prod.firebaseapp.com", 
  projectId: "budget-buckets-prod",
  storageBucket: "budget-buckets-prod.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789",
  measurementId: "G-XXXXXXXXXX"
};
```

#### OAuth Provider Configuration
1. **Google OAuth**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services → Credentials
   - Update authorized domains to include production domain
   - Add redirect URIs for production

2. **Firebase Authentication**:
   - Go to Authentication → Settings → Authorized domains
   - Add production domain: `budgetbucket.app`
   - Remove `localhost` for production

## Deployment Process

### 1. Pre-deployment Checklist

```bash
# 1. Run tests locally
npm test

# 2. Verify Firebase configuration
firebase projects:list
firebase use production

# 3. Test Firebase rules
firebase emulators:start --only firestore
# Run test suite at http://localhost:8080/test/smoke-test.html

# 4. Lint and validate
npm run lint  # If available
firebase firestore:rules:validate
```

### 2. Deploy Security Rules

```bash
# Deploy Firestore rules first
firebase deploy --only firestore:rules

# Verify rules in Firebase Console
# Test with Rules Playground using production user IDs
```

### 3. Deploy Application

#### Option A: GitHub Integration (Recommended)
```bash
# Push to main branch
git add .
git commit -m "Production deployment"
git push origin main

# Firebase App Hosting will automatically deploy
# Monitor progress in Firebase Console → App Hosting
```

#### Option B: Firebase CLI Deploy
```bash
# Deploy hosting only
firebase deploy --only hosting

# Deploy everything
firebase deploy

# Monitor deployment
firebase hosting:channel:list
```

### 4. Post-deployment Verification

```bash
# 1. Test production URL
curl -I https://budgetbucket.app
# Should return 200 OK with security headers

# 2. Test authentication
# Visit https://budgetbucket.app/auth/login.html
# Verify Google OAuth works

# 3. Test database connection
# Visit https://budgetbucket.app/test/smoke-test.html?autorun=true
# All tests should pass

# 4. Test key user flows
# - Sign up new user
# - Create budget
# - Save and reload data
```

## Production Configuration

### 1. Security Headers

Configured in `server.js:27-58` for Express server or `firebase.json` for static hosting:

```javascript
// Security headers (from server.js)
"Content-Security-Policy": "default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com; frame-src 'self' https://*.firebaseapp.com; connect-src 'self' https://*.googleapis.com https://*.firestore.googleapis.com;",
"X-Content-Type-Options": "nosniff",
"X-Frame-Options": "DENY", 
"X-XSS-Protection": "1; mode=block",
"Strict-Transport-Security": "max-age=31536000; includeSubDomains"
```

### 2. Performance Optimization

```javascript
// Compression enabled (server.js:63)
app.use(compression());

// Cache headers for static assets
"Cache-Control": "public, max-age=31536000"  // 1 year for JS/CSS
"Cache-Control": "public, max-age=3600"      // 1 hour for HTML
```

### 3. Error Monitoring

```javascript
// Optional: Add error tracking service
// Sentry, LogRocket, or Firebase Crashlytics
window.addEventListener('error', (event) => {
  // Report to monitoring service
  console.error('Production error:', event.error);
});
```

## Monitoring and Maintenance

### 1. Health Checks

Set up monitoring URLs:
- **Health Check**: https://budgetbucket.app/test/smoke-test.html?autorun=true
- **Network Diagnostic**: https://budgetbucket.app/test/network-diagnostic.html
- **Firebase Status**: https://status.firebase.google.com/

### 2. Performance Monitoring

```javascript
// Optional: Firebase Performance Monitoring
import { getPerformance } from 'firebase/performance';
const perf = getPerformance(app);
```

### 3. Analytics Setup

```javascript
// Google Analytics (if measurementId provided)
// Automatically configured via Firebase config
// Track key events: sign-up, budget creation, etc.
```

## Rollback Procedures

### 1. Quick Rollback (Firebase Hosting)
```bash
# View deployment history
firebase hosting:releases:list

# Rollback to previous version
firebase hosting:clone SOURCE_SITE_ID:SOURCE_VERSION_ID TARGET_SITE_ID

# Or redeploy previous git commit
git checkout PREVIOUS_COMMIT_SHA
firebase deploy --only hosting
```

### 2. Database Rollback
```bash
# Export current data (backup)
firebase firestore:export gs://your-bucket/backup-$(date +%Y%m%d)

# Restore from previous backup if needed
firebase firestore:import gs://your-bucket/backup-YYYYMMDD
```

## Scaling Considerations

### 1. Database Scaling
- **Firestore** automatically scales
- Monitor usage in Firebase Console
- Consider composite indexes for complex queries

### 2. Hosting Scaling
- **Firebase Hosting** scales automatically
- CDN distribution included
- No server capacity planning needed

### 3. Cost Management
```bash
# Set up budget alerts in Google Cloud Console
# Monitor usage in Firebase Console → Usage and billing
# Current costs: ~$5-25/month for small-medium usage
```

## Troubleshooting Deployment

### Common Issues

1. **Build Failures**:
   ```bash
   # Check build logs in Firebase Console
   # Verify all dependencies in package.json
   # Test build locally: npm run build
   ```

2. **Authentication Errors**:
   ```bash
   # Verify authorized domains include production URL
   # Check OAuth redirect URIs
   # Validate Firebase config values
   ```

3. **Database Permission Errors**:
   ```bash
   # Verify Firestore rules deployed correctly
   firebase firestore:rules:get
   # Test rules with Firebase Console Rules Playground
   ```

4. **Custom Domain Issues**:
   ```bash
   # Verify DNS records with dig command
   dig budgetbucket.app
   # Check SSL certificate status in Firebase Console
   ```

## Security Checklist

- [ ] HTTPS enforced on all pages
- [ ] Security headers configured
- [ ] OAuth domains restricted to production
- [ ] Firestore rules limit access to authenticated users only
- [ ] API keys restricted to specific domains
- [ ] Test users removed from production database
- [ ] Monitoring and alerting configured

## Support and Escalation

### Production Issues
1. Check [Troubleshooting Guide](./troubleshooting.md)
2. Review Firebase Console error logs
3. Check Firebase Status page
4. Monitor user-reported issues
5. Escalate to development team with:
   - Error logs and stack traces
   - Steps to reproduce
   - User impact assessment

### Maintenance Schedule
- **Security Updates**: Monthly review of dependencies
- **Performance Review**: Quarterly analysis of Core Web Vitals
- **Backup Verification**: Monthly backup restore test
- **Documentation Update**: After each significant deployment

## References

- [Firebase App Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Security Configuration](../reference/configuration.md)
- [System Architecture](../architecture/system-overview.md)
- [Troubleshooting Guide](./troubleshooting.md)