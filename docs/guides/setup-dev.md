---
title: "Budget Buckets - Development Setup"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["guide", "setup", "development"]
---

# Development Setup

Complete guide to set up Budget Buckets development environment from a clean machine.

## Prerequisites

### Required Software

1. **Node.js 20+**
   ```bash
   # Check version
   node --version  # Should be >= 20.0.0
   
   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 20
   nvm use 20
   ```

2. **Git**
   ```bash
   # Check installation
   git --version
   
   # Configure (first time)
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

3. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   
   # Verify installation
   firebase --version
   ```

### Optional Tools

- **VS Code** with extensions:
  - Firebase (for rules syntax)
  - Live Server (for local development)
  - ESLint (for code quality)

## Project Setup

### 1. Clone Repository

```bash
git clone https://github.com/Deedubsy/BudgetBuckets.git
cd BudgetBuckets
```

### 2. Firebase Project Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "budget-buckets-dev")
4. Enable Google Analytics (optional)
5. Create project

#### Enable Services
1. **Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password" provider
   - Enable "Google" provider
   - Add `localhost` to authorized domains

2. **Firestore Database**:
   - Go to Firestore Database
   - Create database in test mode (for development)
   - Choose region closest to you

#### Get Configuration
1. Go to Project Settings → General
2. Scroll to "Your apps" → Add Web app
3. Register app with nickname "Budget Buckets Web"
4. Copy the Firebase configuration object

### 3. Configure Application

#### Firebase Configuration
```bash
# Copy sample config
cp auth/firebase-config.sample.js auth/firebase-config.js

# Edit the configuration file
vim auth/firebase-config.js  # or your preferred editor
```

Replace the configuration with your project values:
```javascript
// auth/firebase-config.js
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789",
  measurementId: "G-XXXXXXXXXX"  // Optional
};
```

#### Environment Detection
The app automatically detects development vs production:
```javascript
// Runs emulators on localhost, production Firebase elsewhere
const environment = window.location.hostname === 'localhost' ? 'emulator' : 'production';
```

## Development Workflow

### 1. Start Firebase Emulators

```bash
# Initialize Firebase (first time only)
firebase login
firebase init

# Select these services:
# - Firestore
# - Functions (optional)
# - Hosting (optional)
# - Emulators

# Start emulators
firebase emulators:start
```

Emulator URLs:
- **Firestore**: http://localhost:8080
- **Auth**: http://localhost:9099  
- **Emulator UI**: http://localhost:4000

### 2. Start Development Server

```bash
# Option 1: Express server (recommended)
npm run dev

# Option 2: Static server
npx serve .

# Option 3: VS Code Live Server
# Right-click on index.html → "Open with Live Server"
```

### 3. Access Application

- **Home**: http://localhost:8080/
- **Login**: http://localhost:8080/auth/login.html
- **App**: http://localhost:8080/app/index.html
- **Tests**: http://localhost:8080/test/smoke-test.html

## Development Tools

### Firebase Emulator UI

Access at http://localhost:4000 for:
- **Authentication**: Manage test users
- **Firestore**: Browse database documents
- **Logs**: View emulator logs
- **Network**: Monitor API calls

### Environment Switcher

Use http://localhost:8080/environment to:
- Toggle between emulator/production
- Clear local storage
- Reset authentication state

### Test Suite

Comprehensive testing tools:

1. **Smoke Test**: http://localhost:8080/test/smoke-test.html
   - Tests Firebase connection
   - Validates authentication flow
   - Checks Firestore permissions

2. **Network Diagnostic**: http://localhost:8080/test/network-diagnostic.html
   - Tests connectivity to Firebase services
   - Diagnoses network issues

3. **Firestore Debug**: http://localhost:8080/test/debug-firestore.html
   - Direct Firestore operations
   - Rules testing
   - Data validation

## Creating Test Data

### Seed Users (Emulator)

```javascript
// In browser console on auth page
firebase.auth().createUserWithEmailAndPassword('test@example.com', 'password123');
firebase.auth().createUserWithEmailAndPassword('user2@example.com', 'password456');
```

### Sample Budget Data

Use the app interface to create test budgets, or import sample data:

```javascript
// Sample budget structure
const sampleBudget = {
  name: "Test Budget",
  settings: {
    incomeAmount: 5000,
    incomeFrequency: "Monthly",
    currency: "AUD"
  },
  expenses: [
    {
      id: "housing",
      name: "Housing",
      bankAccount: "Main Account", 
      include: true,
      color: "#3b82f6",
      items: [
        { id: "rent", name: "Rent", amount: 1500, include: true },
        { id: "utilities", name: "Utilities", amount: 300, include: true }
      ]
    }
  ],
  savings: [
    {
      id: "emergency",
      name: "Emergency Fund",
      bankAccount: "Savings Account",
      include: true,
      goalEnabled: true,
      goalAmount: 10000,
      color: "#10b981",
      items: [
        { id: "monthly", name: "Monthly Contribution", amount: 500, include: true }
      ]
    }
  ]
};
```

## Common Development Tasks

### Deploy Security Rules

```bash
# Deploy rules to emulator (automatic)
firebase emulators:start

# Deploy rules to production
firebase deploy --only firestore:rules
```

### View Logs

```bash
# Emulator logs
firebase emulators:start --debug

# Production logs (if using Firebase Hosting)
firebase functions:log
```

### Reset Development Environment

```bash
# Clear browser data
# In browser console:
localStorage.clear();
sessionStorage.clear();

# Restart emulators with clean data
firebase emulators:start --import=./emulator-data --export-on-exit
```

## Troubleshooting

### Common Issues

1. **Firebase not initialized**
   - Check `auth/firebase-config.js` exists and has correct values
   - Verify Firebase project is active
   - Check browser console for import errors

2. **Permission denied errors**
   - Ensure user is authenticated
   - Check Firestore rules match user UID
   - Verify emulators are running

3. **Emulator connection failed**
   - Check ports 8080, 9099, 4000 are not in use
   - Restart emulators: `firebase emulators:start`
   - Clear browser cache and storage

4. **Google Sign-in not working**
   - Add `localhost` to Firebase Auth authorized domains
   - Check popup blocker settings
   - Try redirect flow if popup fails

### Getting Help

1. Run smoke test: http://localhost:8080/test/smoke-test.html
2. Check network diagnostic: http://localhost:8080/test/network-diagnostic.html
3. Review [troubleshooting guide](./troubleshooting.md)
4. Check Firebase Emulator UI at http://localhost:4000

## Next Steps

Once development environment is running:

1. Review [System Architecture](../architecture/system-overview.md)
2. Understand [Data Flow](../architecture/dataflow.md)  
3. Read [API Reference](../reference/http-api.md)
4. Check [Deployment Guide](./deploy.md) for production deployment

## Production Considerations

When ready for production:

1. Create production Firebase project
2. Update configuration for production
3. Deploy Firestore rules: `firebase deploy --only firestore`
4. Set up custom domain in Firebase Hosting
5. Enable security headers and HTTPS

See the [Deployment Guide](./deploy.md) for complete production setup instructions.