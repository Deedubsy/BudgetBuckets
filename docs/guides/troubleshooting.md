---
title: "Budget Buckets - Troubleshooting Guide"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["guide", "troubleshooting", "debugging"]
---

# Troubleshooting Guide

Common issues and solutions for Budget Buckets development and production.

## Quick Diagnostic Tools

### 1. Smoke Test
**URL**: http://localhost:8080/test/smoke-test.html?autorun=true

Tests:
- Firebase SDK initialization
- Authentication state
- Firestore read/write permissions
- Data validation and security rules

### 2. Network Diagnostic  
**URL**: http://localhost:8080/test/network-diagnostic.html

Tests:
- Connectivity to Firebase services
- DNS resolution
- Network latency

### 3. Firestore Debug
**URL**: http://localhost:8080/test/debug-firestore.html

Tests:
- Direct Firestore operations
- Security rules validation
- Document structure

## Authentication Issues

### "Firebase not initialized" or Module Import Errors

**Symptoms:**
```
Uncaught (in promise) FirebaseError: Firebase: No Firebase App '[DEFAULT]' has been created
TypeError: Failed to resolve module specifier
```

**Solutions:**
1. **Check Firebase configuration exists:**
   ```bash
   ls -la auth/firebase-config.js  # Should exist
   ```

2. **Verify configuration format:**
   ```javascript
   // auth/firebase-config.js should contain:
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     // ... other config
   };
   ```

3. **Check module imports:**
   ```javascript
   // Ensure using modular v10+ SDK
   import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
   ```

4. **Verify script type:**
   ```html
   <!-- All Firebase scripts must be modules -->
   <script type="module" src="./firebase.js"></script>
   ```

**Source**: auth/firebase.js:1-10

### Google Sign-In Problems

**Symptoms:**
```
auth/popup-closed-by-user
auth/popup-blocked
Error: Sign-in popup was closed. Please try again.
```

**Solutions:**
1. **Check authorized domains:**
   - Firebase Console → Authentication → Settings → Authorized domains
   - Add: `localhost`, `127.0.0.1`, your production domain

2. **Disable popup blockers:**
   - Check browser popup blocker settings
   - Try incognito mode

3. **Use redirect fallback:**
   ```javascript
   // App automatically falls back to redirect
   // From auth/firebase.js:253-264
   try {
     await signInWithPopup(auth, provider);
   } catch (popupError) {
     await signInWithRedirect(auth, provider);
   }
   ```

**Source**: auth/firebase.js:240-270

### "Permission denied" in Firestore

**Symptoms:**
```
FirebaseError: Missing or insufficient permissions
permission-denied: You don't have permission to access this data
```

**Solutions:**
1. **Verify user authentication:**
   ```javascript
   // In browser console
   const user = await authHelpers.waitForAuth();
   console.log('User:', user);  // Should not be null
   ```

2. **Check Firestore rules:**
   ```bash
   # Deploy latest rules
   firebase deploy --only firestore:rules
   ```

3. **Verify user UID matches:**
   ```javascript
   // From firestore.rules
   match /users/{uid} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
   }
   ```

4. **Test with Rules Playground:**
   - Firebase Console → Firestore → Rules → Playground
   - Use actual user UID from your auth

**Source**: firestore.rules, app/cloud-store.js:200-220

## Development Environment Issues

### Emulator Connection Failed

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:9099
Emulator connection failed (may already be connected)
```

**Solutions:**
1. **Start emulators:**
   ```bash
   firebase emulators:start
   ```

2. **Check port availability:**
   ```bash
   # Check if ports are in use
   lsof -i :8080  # Firestore emulator
   lsof -i :9099  # Auth emulator
   lsof -i :4000  # Emulator UI
   ```

3. **Clear browser storage:**
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

4. **Reset emulator data:**
   ```bash
   # Stop emulators and restart with clean data
   firebase emulators:start --import=./emulator-data --export-on-exit
   ```

**Source**: auth/firebase.js:90-115

### Build/Server Issues

**Symptoms:**
```
Error: Cannot find module 'express'
Port 8080 is already in use
```

**Solutions:**
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Check port usage:**
   ```bash
   # Kill existing server
   lsof -ti:8080 | xargs kill -9
   
   # Or use different port
   PORT=3000 npm run dev
   ```

3. **Verify Node.js version:**
   ```bash
   node --version  # Should be >= 20.0.0
   ```

**Source**: package.json:11, server.js:16

## Data/Performance Issues

### Slow Loading or Timeouts

**Symptoms:**
- Budget data takes >5 seconds to load
- Firebase operations timeout
- UI becomes unresponsive

**Solutions:**
1. **Check network connectivity:**
   - Run network diagnostic: http://localhost:8080/test/network-diagnostic.html
   - Test Firebase service connectivity

2. **Enable offline persistence:**
   ```javascript
   // Already enabled in auth/firebase.js:125-135
   await enableMultiTabIndexedDbPersistence(db);
   ```

3. **Check query efficiency:**
   ```javascript
   // Ensure queries use indexes
   const budgets = await getDocs(query(
     collection(db, `users/${uid}/budgets`),
     orderBy('createdAt', 'desc'),
     limit(100)  // Limit results
   ));
   ```

4. **Use batch operations:**
   ```javascript
   // From app/cloud-store.js:350-380
   const batch = writeBatch(db);
   // Add multiple operations
   await batch.commit();
   ```

**Source**: app/cloud-store.js:120-150

### Data Validation Errors

**Symptoms:**
```
Budget name is required
Invalid amount in expense Housing item 1
```

**Solutions:**
1. **Check data format:**
   ```javascript
   // From app/cloud-store.js:30-80
   function validateBudgetData(budget) {
     // Validates required fields, amounts, etc.
   }
   ```

2. **Remove undefined values:**
   ```javascript
   // Data is automatically scrubbed
   const cleanData = scrubUndefined(budgetData);
   ```

3. **Check field constraints:**
   - Budget name: 1-100 characters
   - Amounts: 0-999999.99
   - Frequency: Weekly/Fortnightly/Monthly/Yearly

**Source**: app/cloud-store.js:30-100

## Production Issues

### HTTPS/Security Errors

**Symptoms:**
```
Mixed Content: The page was loaded over HTTPS but requested an insecure resource
Content Security Policy violations
```

**Solutions:**
1. **Verify CSP configuration:**
   ```javascript
   // From server.js:27-58
   "Content-Security-Policy": "default-src 'self'; script-src 'self' https://..."
   ```

2. **Check HTTPS enforcement:**
   - All production URLs should use https://
   - Verify SSL certificate validity

3. **Update authorized domains:**
   - Firebase Console → Authentication → Settings
   - Use production domain, not localhost

**Source**: server.js:19-60

### Performance Issues in Production

**Symptoms:**
- Slow initial page load
- High memory usage
- Poor Core Web Vitals scores

**Solutions:**
1. **Enable compression:**
   ```javascript
   // Already enabled in server.js:63
   app.use(compression());
   ```

2. **Check cache headers:**
   ```javascript
   // From server.js:83-85
   "Cache-Control": "public, max-age=31536000"  // For static assets
   ```

3. **Monitor bundle size:**
   - Current: ~50KB total JavaScript
   - Target: <100KB for good performance

**Source**: server.js:60-90

## Error Code Reference

### Firebase Auth Errors

| Code | Meaning | Solution |
|------|---------|----------|
| `auth/user-not-found` | No account with this email | Check email or create account |
| `auth/wrong-password` | Incorrect password | Reset password or retry |
| `auth/too-many-requests` | Rate limited | Wait and retry |
| `auth/popup-closed-by-user` | OAuth popup closed | Try redirect flow |

### Firestore Errors

| Code | Meaning | Solution |
|------|---------|----------|
| `permission-denied` | Security rules block access | Check auth state and rules |
| `unavailable` | Service temporarily down | Retry with backoff |
| `failed-precondition` | Document state invalid | Check document exists |
| `deadline-exceeded` | Operation timeout | Check network connectivity |

**Source**: auth/firebase.js:300-350

## Getting Help

### Debug Information to Collect

1. **Browser Console Output:**
   ```javascript
   // Enable debug mode
   localStorage.setItem('debug', 'true');
   // Reload page and copy console output
   ```

2. **Firebase Project Info:**
   ```javascript
   // In browser console
   console.log('Project ID:', firebase.app().options.projectId);
   console.log('Auth Domain:', firebase.app().options.authDomain);
   ```

3. **User State:**
   ```javascript
   // Current user info
   const user = await authHelpers.waitForAuth();
   console.log('User UID:', user?.uid);
   console.log('Email:', user?.email);
   ```

### Support Resources

1. **Run Diagnostics**: http://localhost:8080/test/smoke-test.html
2. **Check Documentation**: [System Overview](../architecture/system-overview.md)
3. **Review Setup**: [Development Setup](./setup-dev.md)
4. **Firebase Documentation**: https://firebase.google.com/docs

### Escalation Process

1. Check this troubleshooting guide
2. Run diagnostic tools
3. Check Firebase status page
4. Review recent code changes
5. Contact development team with debug information

## Preventive Measures

### Development Best Practices

1. **Always run smoke tests** before committing changes
2. **Test in both emulator and production** environments
3. **Use defensive coding** with error handling
4. **Validate data** before Firestore operations
5. **Monitor performance** with browser DevTools

### Monitoring Setup

1. **Enable Firebase Performance Monitoring** (optional)
2. **Set up error tracking** (Sentry or similar)
3. **Monitor Core Web Vitals** in production
4. **Track authentication errors** and success rates

This guide covers the most common issues. For complex problems, refer to the [Development Setup](./setup-dev.md) and [System Architecture](../architecture/system-overview.md) documentation.