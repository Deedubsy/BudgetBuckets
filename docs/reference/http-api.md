---
title: "Budget Buckets - HTTP API Reference"
owner: "engineering"  
status: "active"
last_review: "2025-08-20"
tags: ["api", "reference", "express"]
---

# HTTP API Reference

## Base Information

- **Base URL**: `https://budgetbucket.app` (production) / `http://localhost:8080` (development)
- **Protocol**: HTTPS only in production
- **Authentication**: Firebase session cookies / tokens
- **Content-Type**: `text/html`, `application/javascript`, `text/css`, `application/json`

## Route Reference

| Method | Route | Summary | Auth | Request | Response | Source |
|--------|-------|---------|------|---------|----------|---------|
| GET | `/` | Home page redirect | No | - | HTML (home.html) | server.js:99 |
| GET | `/home` | Main landing page | No | - | HTML (home.html) | server.js:119 |
| GET | `/auth/login.html` | Login/register page | No | - | HTML (auth UI) | server.js:107 |
| GET | `/app` | Budget application | Yes* | - | HTML (app/index.html) | server.js:111 |
| GET | `/pricing` | Pricing page | No | - | HTML (pricing.html) | server.js:148 |
| GET | `/calculators` | Budget calculators | No | - | HTML (calculators.html) | server.js:127 |
| GET | `/guide` | Budget method guide | No | - | HTML (Method.html) | server.js:143 |
| GET | `/privacy` | Privacy policy | No | - | HTML (privacy.html) | server.js:157 |
| GET | `/terms` | Terms of service | No | - | HTML (terms.html) | server.js:165 |
| GET | `/support` | Support page | No | - | HTML (support.html) | server.js:173 |
| GET | `/sitemap.xml` | SEO sitemap | No | - | XML | server.js:186 |
| GET | `/robots.txt` | SEO robots file | No | - | Text | server.js:191 |
| GET | `/__/health` | Health check | No | - | JSON status | server.js:94 |

*\*Authentication checked client-side via route guard*

## Special Routes

### SPA Fallback Routes

| Pattern | Destination | Purpose | Source |
|---------|-------------|---------|---------|
| `/app/*` | `/app/index.html` | Budget app SPA routing | server.js:214 |
| `/auth/*` | `/auth/login.html` | Auth flow routing | server.js:223 |
| `/test/*` | `/test.html` | Test page routing | server.js:232 |

### Test & Diagnostic Routes

| Method | Route | Summary | Purpose | Source |
|--------|-------|---------|---------|---------|
| GET | `/test/smoke-test.html` | Comprehensive system test | Firebase + auth validation | server.js:201 |
| GET | `/test/network-diagnostic.html` | Network connectivity test | Debug connectivity issues | server.js:205 |
| GET | `/test/debug-firestore.html` | Firestore debug tools | Database operation testing | server.js:209 |
| GET | `/environment` | Environment switcher | Toggle emulator/production | server.js:196 |

## Security Headers

All responses include comprehensive security headers:

```javascript
// From server.js:19-60
{
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff", 
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "interest-cohort=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com https://www.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.gstatic.com; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com; frame-src 'self' https://budgetbucket.app https://accounts.google.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
}
```

## Cache Control

### Static Assets
```javascript
// From server.js:83-85
"Cache-Control": "public, max-age=31536000" // 1 year for JS/CSS
```

### Auth Pages
```javascript  
// From server.js:40-44
"Cache-Control": "no-store" // No caching for auth pages
"X-Robots-Tag": "noindex, nofollow, noarchive, noimageindex"
```

## Client-Side API (Firebase)

The application uses Firebase client-side APIs for data operations:

### Authentication API
```javascript
// From auth/firebase.js:240-270
// Sign in with email/password
await signInWithEmailAndPassword(auth, email, password);

// Sign in with Google popup/redirect  
await signInWithPopup(auth, provider);
await signInWithRedirect(auth, provider);

// Password reset
await sendPasswordResetEmail(auth, email);

// Sign out
await signOut(auth);
```

### Firestore API
```javascript
// From app/cloud-store.js:150-400
// Get user budgets
const budgets = await getDocs(query(
  collection(db, `users/${uid}/budgets`),
  orderBy('createdAt', 'desc'),
  limit(100)
));

// Save budget
await setDoc(doc(db, `users/${uid}/budgets/${budgetId}`), budgetData);

// Delete budget  
await deleteDoc(doc(db, `users/${uid}/budgets/${budgetId}`));

// Batch operations
const batch = writeBatch(db);
batch.set(docRef1, data1);
batch.update(docRef2, data2);
await batch.commit();
```

## Error Responses

### Client-Side Error Handling
```javascript
// From auth/firebase.js:300-350
const errorMessages = {
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password', 
  'auth/too-many-requests': 'Too many failed attempts. Try again later',
  'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again',
  'permission-denied': 'You don't have permission to access this data',
  'unavailable': 'Service temporarily unavailable. Please try again',
  'failed-precondition': 'Operation failed due to invalid state'
};
```

### HTTP Error Responses

| Status | Response | Trigger | Source |
|--------|----------|---------|---------|
| 404 | "File not found" | Missing static file | server.js:236 |
| 404 | HTML error page | Unknown path | server.js:240-250 |
| 500 | JSON error | Server exception | server.js:253-259 |

## Rate Limiting

- **Firebase Auth**: Built-in rate limiting for sign-in attempts
- **Firestore**: 1 write per second per document (Firebase limit)
- **Express Server**: No explicit rate limiting implemented

## Development vs Production

### Environment Detection
```javascript
// From auth/firebase.js:57-70
function determineEnvironment() {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'emulator';
  }
  
  return 'production';
}
```

### Emulator Endpoints
- **Auth Emulator**: `http://localhost:9099`
- **Firestore Emulator**: `http://localhost:8080`  
- **Emulator UI**: `http://localhost:4000`

This API design prioritizes security, performance, and developer experience while maintaining simplicity through static file serving and client-side Firebase integration.