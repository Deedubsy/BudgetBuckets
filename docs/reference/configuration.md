---
title: "Budget Buckets - Configuration Reference"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["configuration", "environment", "firebase"]
---

# Configuration Reference

## Environment Variables

| Key | Development | Staging | Production | Source |
|-----|-------------|---------|------------|---------|
| `PORT` | 8080 | 8080 | ${PLACEHOLDER_TAG} | server.js:16 |
| `NODE_ENV` | development | staging | production | server.js:257 |

*Note: This application primarily uses client-side Firebase configuration rather than server environment variables.*

## Firebase Configuration

### Project Configuration
```javascript
// From auth/firebase.js:46-54
const firebaseConfig = {
  apiKey: "AIzaSyAyQnI3I5IRm2MZ16ttVaaA-8bneE3lWeo",
  authDomain: "budgetbuckets-79b3b.firebaseapp.com",
  projectId: "budgetbuckets-79b3b",
  storageBucket: "budgetbuckets-79b3b.firebasestorage.app", 
  messagingSenderId: "268145092645",
  appId: "1:268145092645:web:cef8d22a972fd3081577cc",
  measurementId: "G-G743JKN6TJ"
};
```

### Environment Detection
```javascript
// From auth/firebase.js:57-80
function determineEnvironment() {
  // Manual override via localStorage
  const manualOverride = localStorage.getItem('firebase-environment');
  if (manualOverride) {
    return manualOverride; // 'emulator' or 'production'
  }
  
  // Auto-detection
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  if (hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      port === '5000') {
    return 'emulator';
  }
  
  return 'production';
}
```

## Emulator Configuration

### Firebase Emulators
```json
// From firebase.json (implied from code usage)
{
  "emulators": {
    "auth": {
      "host": "localhost",
      "port": 9099
    },
    "firestore": {
      "host": "localhost", 
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "host": "localhost",
      "port": 4000
    }
  }
}
```

### Emulator Connection
```javascript
// From auth/firebase.js:90-115
if (environment === 'emulator' && !emulatorsInitialized) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(db, 'localhost', 8080);
    emulatorsInitialized = true;
  } catch (error) {
    console.warn('Emulator connection failed:', error.message);
  }
}
```

## Security Configuration

### Content Security Policy
```javascript
// From server.js:27-58
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "https://www.gstatic.com",           // Firebase SDK
    "https://apis.google.com",           // Google APIs
    "https://www.googleapis.com",        // Google APIs
    "https://www.googletagmanager.com",  // Analytics (optional)
    "https://www.google-analytics.com",  // Analytics (optional)
    "https://cdn.jsdelivr.net"          // tinycolor2 (optional)
  ],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: [
    "'self'",
    "https://firestore.googleapis.com",      // Firestore API
    "https://identitytoolkit.googleapis.com", // Auth API
    "https://securetoken.googleapis.com",     // Auth tokens
    "https://www.googleapis.com",             // Google APIs
    "http://localhost:*",                     // Dev/emulator
    "ws://localhost:*"                        // Dev websockets
  ],
  frameSrc: ["'self'", "https://budgetbucket.app", "https://accounts.google.com"],
  frameAncestors: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"]
};
```

### HTTPS Configuration
```javascript
// From server.js:21-25
const httpsConfig = {
  hsts: { 
    maxAge: 31536000,      // 1 year
    includeSubDomains: true,
    preload: true 
  },
  xssFilter: true,
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
};
```

## Database Configuration

### Firestore Rules
```javascript
// From firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

### Offline Persistence
```javascript
// From auth/firebase.js:125-135
async function configureLongPolling() {
  try {
    if (!USE_EMULATORS) {
      await enableMultiTabIndexedDbPersistence(db);
      console.log('Enabled Firestore offline persistence');
    }
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence only available in one tab');
    } else if (err.code === 'unimplemented') {
      console.warn('Browser does not support persistence');
    }
  }
}
```

## Application Configuration

### Data Validation Limits
```javascript
// From app/cloud-store.js:100-110
const LIMITS = {
  MAX_BUDGETS_PER_USER: 100,
  MAX_BUCKETS_PER_BUDGET: 50,
  MAX_ITEMS_PER_BUCKET: 200,
  MAX_BUDGET_NAME_LENGTH: 100,
  MAX_BUCKET_NAME_LENGTH: 50,
  MAX_AMOUNT: 999999.99,
  MIN_AMOUNT: 0
};
```

### Auto-retry Configuration  
```javascript
// From app/cloud-store.js:120-130
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,      // 1 second
  maxDelay: 10000,      // 10 seconds
  exponentialBase: 2,
  jitter: true
};
```

## Build & Deployment Configuration

### Firebase Hosting
```json
// From firebase.json:2-16
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*", 
      "**/node_modules/**",
      "README.md",
      "auth/firebase-config.sample.js"
    ],
    "cleanUrls": true,
    "trailingSlash": false,
    "rewrites": [
      { "source": "/app/**", "destination": "/app/index.html" }
    ]
  }
}
```

### Cache Control Headers
```javascript
// From firebase.json:32-37
{
  "source": "**/*.@(js|css)",
  "headers": [
    { "key": "Cache-Control", "value": "public, max-age=3600" }
  ]
}
```

## Secret Management

### API Keys
- **Firebase API Key**: Public (client-side), included in source
- **Firebase Service Account**: ${PLACEHOLDER_TAG} - Server-side operations (if needed)
- **Google Analytics**: ${PLACEHOLDER_TAG} - Optional tracking configuration

### Environment-Specific Secrets
- **Development**: Uses Firebase emulators (no production secrets)
- **Production**: Firebase project API keys and configuration
- **Rotation**: ${PLACEHOLDER_TAG} - No automated rotation currently implemented

## Monitoring Configuration

### Logging
```javascript
// From auth/firebase.js:170-180 
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn', 
  INFO: 'info',
  DEBUG: 'debug'
};

// Console logging with timestamps
console.log(`[${new Date().toISOString()}] ${level}: ${message}`);
```

### Performance Monitoring
- **Core Web Vitals**: ${PLACEHOLDER_TAG} - No explicit monitoring configured
- **Firebase Performance**: ${PLACEHOLDER_TAG} - Available but not implemented
- **Error Tracking**: ${PLACEHOLDER_TAG} - No external service integrated

This configuration provides a secure, scalable foundation with clear separation between development and production environments.