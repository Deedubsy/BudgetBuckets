---
title: "Budget Buckets - Project Structure"
owner: "development-team"
status: "active"
last_review: "2025-08-11"
tags: ["architecture", "project-structure"]
---

# Budget Buckets - Project Structure

```
📦 BudgetBuckets/
├── 🔐 auth/                     # Authentication & Security
│   ├── login.html              # Sign in/register page
│   ├── auth.js                 # Auth form handlers (modular)
│   ├── firebase.js             # Firebase v10+ modular setup
│   ├── guard.js                # Route protection & auth state
│   └── styles.css              # Auth page styling
│
├── 📱 app/                      # Main Application
│   ├── index.html              # Budget dashboard
│   ├── app.js                  # Core app logic (modular)
│   ├── cloud-store.js          # Firestore operations (modular)
│   └── styles.css              # App styling
│
├── 🧪 test/                     # Testing & Diagnostics
│   ├── smoke-test.html         # Auth+Firestore validation
│   └── network-diagnostic.html # Network connectivity tests
│
├── 🔄 migrations/               # Data Migration
│   └── import-local.js         # localStorage→Firestore migration
│
├── 🔧 Configuration Files
│   ├── firebase.json           # Firebase project config
│   ├── firestore.rules         # Security rules
│   ├── firestore.indexes.json  # Database indexes
│   └── README.md               # Documentation
│
└── 🛠 Development Tools
    ├── test.html               # Quick module testing
    └── environment-switcher.html # Emulator/Production toggle

✅ CLEANED UP (Removed):
❌ auth/firebase-config.js      # Old compat config (replaced by firebase.js)
❌ firestore-test.rules         # Dangerous test rules
❌ switch-to-production.js      # Redundant script
❌ start-emulators.md          # Documentation moved to README
```

## File Purposes

### 🔥 Firebase Integration
- **`auth/firebase.js`** - Modern Firebase v10+ modular SDK with auto-retry
- **`firestore.rules`** - Production-ready security rules with data validation
- **`firebase.json`** - Emulator config (Auth:9099, Firestore:8080, UI:4000)

### 🔐 Authentication Flow  
- **`auth/login.html`** - Sign in/register with Google OAuth
- **`auth/auth.js`** - Form validation and Firebase auth methods
- **`auth/guard.js`** - Route protection with loading states

### 📱 Application Logic
- **`app/index.html`** - Budget dashboard with responsive design
- **`app/app.js`** - Core budgeting logic with cloud sync
- **`app/cloud-store.js`** - Firestore CRUD with defensive validation

### 🧪 Testing & Diagnostics
- **`test/smoke-test.html`** - Full auth+Firestore+CRUD validation
- **`test/network-diagnostic.html`** - Network connectivity troubleshooting

### 🔄 Migration & Tools
- **`migrations/import-local.js`** - Import localStorage data to Firestore
- **`environment-switcher.html`** - Toggle between emulators/production