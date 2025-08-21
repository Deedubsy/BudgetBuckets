# Firebase Auth Setup Guide

Complete guide to configure Firebase Authentication for Budget Buckets with Google SSO, email/password, and email verification.

## Prerequisites

- Firebase project created
- Firebase CLI installed: `npm install -g firebase-tools`
- Admin access to Firebase Console

## 1. Enable Authentication Providers

### Google Sign-In Provider

1. Go to [Firebase Console](https://console.firebase.google.com/) → your project
2. Navigate to **Authentication** → **Sign-in method**
3. Click **Google** provider
4. **Enable** the provider
5. Set **Project support email** (required for Google OAuth)
6. Click **Save**

### Email/Password Provider

1. In the same **Sign-in method** tab
2. Click **Email/Password** provider  
3. **Enable** Email/Password (first option)
4. **Enable** Email link sign-in (second option) ✅
5. Click **Save**

## 2. Configure Authorized Domains

Add your domains for production and development:

1. In **Authentication** → **Settings** → **Authorized domains**
2. Add these domains:
   ```
   localhost (already present)
   your-domain.app
   your-domain.web.app (Firebase hosting)
   your-custom-domain.com (if using custom domain)
   ```

## 3. Email Verification Setup

### Email Template Customization

1. Go to **Authentication** → **Templates**
2. Select **Email address verification**
3. Customize the template:
   ```
   Subject: Verify your Budget Buckets email
   
   Hi,
   
   To complete your Budget Buckets setup, please verify your email address.
   
   %LINK%
   
   This link expires in 1 hour. If you didn't sign up for Budget Buckets, you can ignore this email.
   
   — Budget Buckets Team
   ```
4. Set **Continue URL**: `https://your-domain.app/app`
5. Click **Save**

### Email Verification Banner Flow

Our app implements a verification banner in `/app/index.html`:

```javascript
// Email verification check (from app-init.js)
if (currentUser && !currentUser.emailVerified) {
  // Show banner with resend button
  const banner = document.getElementById('emailVerifyBanner');
  banner.style.display = 'block';
  
  // Handle "I've verified" button
  document.getElementById('checkVerified').onclick = async () => {
    await currentUser.reload();
    if (currentUser.emailVerified) {
      banner.style.display = 'none';
    }
  };
}
```

## 4. Authentication Configuration

### Client-Side Config

The app uses Firebase CDN v10 imports:

```javascript
// auth/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

### Environment Detection

The app automatically detects production vs emulator environment:

```javascript
// auth/firebase.js - Environment detection
function determineEnvironment() {
  // For local development, use production Firebase by default
  // Only use emulators if explicitly requested
  return window.location.search.includes('emulator=true');
}

if (determineEnvironment()) {
  // Use Firebase emulators
  connectAuthEmulator(auth, "http://localhost:9099");
}
```

## 5. Error Handling

### Common Auth Errors

The app handles these Firebase Auth errors:

| Error Code | User Message | Resolution |
|------------|--------------|------------|
| `auth/popup-closed-by-user` | "Sign-in cancelled" | Retry with popup |
| `auth/email-already-in-use` | "Email already registered" | Sign in instead |
| `auth/weak-password` | "Password too weak" | Require 6+ characters |
| `auth/user-not-found` | "Account not found" | Sign up instead |
| `auth/wrong-password` | "Incorrect password" | Reset password option |
| `auth/network-request-failed` | "Network error" | Check connection |

### Popup vs Redirect

Budget Buckets uses popup-based auth with fallback:

```javascript
// auth/auth.js - Popup with fallback
async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      // User closed popup - show retry message
      showMessage('Sign-in cancelled. Please try again.');
    } else if (error.code === 'auth/popup-blocked') {
      // Fallback to redirect (could implement if needed)
      throw new Error('Popup blocked. Please allow popups for this site.');
    }
    throw error;
  }
}
```

## 6. Security Configuration

### CSP Headers

The Express server includes auth-compatible CSP headers:

```javascript
// server.js - CSP for Firebase Auth
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "https://www.gstatic.com",           // Firebase SDK
      "https://apis.google.com",           // Google Auth
      "https://www.googleapis.com"         // Google APIs
    ],
    connectSrc: [
      "'self'",
      "https://identitytoolkit.googleapis.com",  // Firebase Auth
      "https://securetoken.googleapis.com",      // Token refresh
      "https://www.googleapis.com"               // Google APIs
    ]
  }
}
```

### Custom Claims for Plans

After successful Stripe subscription, the webhook sets custom claims:

```javascript
// server.js - Webhook handler
await admin.auth().setCustomUserClaims(firebaseUid, { 
  plan: status === 'active' ? 'plus' : 'free' 
});
```

Client-side plan detection:

```javascript
// app/lib/plan.js - Plan detection
const tokenResult = await currentUser.getIdTokenResult(true);
const plan = tokenResult.claims.plan || 'free';
```

## 7. Testing Checklist

✅ **Google Sign-In Flow**
- [ ] Click "Sign in with Google" button
- [ ] Google popup opens successfully  
- [ ] Can select Google account
- [ ] Redirects to `/app` after successful sign-in
- [ ] User data appears in Firebase Console

✅ **Email/Password Flow**
- [ ] Can sign up with email + password
- [ ] Verification email sent automatically
- [ ] Email verification banner appears in app
- [ ] "Resend verification" button works
- [ ] "I've verified" button hides banner after verification
- [ ] Can sign in with verified email

✅ **Error Handling**
- [ ] Popup blocked → helpful error message
- [ ] Network error → retry suggestion
- [ ] Weak password → clear requirements
- [ ] Email in use → sign in suggestion

✅ **Security**
- [ ] Auth state persists across page reloads
- [ ] Token refresh works automatically
- [ ] CSP headers don't block auth flows
- [ ] Emulators work for local development

## 8. Local Development

### Using Firebase Emulators

```bash
# Start auth emulator
firebase emulators:start --only auth

# Access with emulator flag
http://localhost:8080/?emulator=true
```

### Production vs Emulator

- **Production** (default): Real Firebase project
- **Emulator**: Add `?emulator=true` to URL for local auth

## 9. Troubleshooting

### "Permission denied" in app

**Cause**: User not authenticated or email not verified  
**Fix**: Check auth state and email verification banner

### Google Sign-in popup blocked

**Cause**: Browser popup blocker  
**Fix**: Add site to popup exceptions or use redirect mode

### "Firebase: No Firebase App" error

**Cause**: Firebase not initialized properly  
**Fix**: Check `auth/firebase.js` config and imports

### Email verification not working

**Cause**: Email template issues or SMTP config  
**Fix**: Check **Authentication** → **Templates** settings

---

**Last updated: 21 Aug 2025 (AEST)**