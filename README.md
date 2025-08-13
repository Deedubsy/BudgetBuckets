# Budget Buckets

A personal budgeting application with cloud authentication and storage. Track your income, expenses, and savings goals with real-time syncing across devices.

## Features

- **Cloud Authentication**: Email/password and Google Sign-In via Firebase Auth
- **Cloud Storage**: All budget data synced to Firestore
- **Responsive Design**: Works on desktop and mobile with dark theme
- **Savings Goals**: Set targets and track progress with visual indicators
- **Color Customization**: Personalize bucket colors for easy organization
- **Frequency Flexibility**: Support for Weekly, Fortnightly, Monthly, and Yearly budgets
- **Data Export/Import**: JSON backup and restore functionality
- **Auto-Migration**: Seamlessly imports existing localStorage data to cloud

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (framework-free)
- **Authentication**: Firebase Authentication
- **Database**: Cloud Firestore
- **Hosting**: Firebase Hosting (optional)
- **Development**: Firebase Emulators

## Project Structure

```
├── auth/                          # Authentication modules
│   ├── login.html                 # Sign in/register page
│   ├── styles.css                 # Auth page styling
│   ├── auth.js                    # Authentication flows
│   ├── guard.js                   # Route protection
│   ├── profile.js                 # User profile management
│   └── firebase-config.sample.js  # Firebase config template
├── app/                           # Main application
│   ├── index.html                 # App dashboard
│   ├── styles.css                 # App styling
│   ├── app.js                     # Core app logic
│   └── cloud-store.js             # Firestore data layer
├── migrations/
│   └── import-local.js            # localStorage → Firestore migration
├── firebase.json                  # Firebase project config
├── firestore.rules               # Security rules
├── firestore.indexes.json        # Database indexes
└── README.md                      # This file
```

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication:
   - Go to Authentication → Sign-in method
   - Enable "Email/Password" provider
   - Enable "Google" provider (add your domain to authorized domains)
4. Create Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Rules will be deployed automatically

### 2. Configure Firebase

1. In Firebase Console, go to Project Settings → General
2. Scroll to "Your apps" and add a Web app
3. Copy the Firebase configuration object
4. Create `auth/firebase-config.js` from the sample:

```bash
cp auth/firebase-config.sample.js auth/firebase-config.js
```

5. Replace the config in `auth/firebase-config.js` with your values:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

### 3. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 4. Deploy Security Rules

```bash
# Login to Firebase
firebase login

# Initialize the project (if not already done)
firebase init

# Deploy Firestore rules and indexes
firebase deploy --only firestore
```

## Development

### Local Development with Emulators

For local development, you can use Firebase Emulators:

1. **Set emulator flag** in `auth/firebase-config.js`:
```javascript
const USE_EMULATORS = true;
```

2. **Start emulators**:
```bash
firebase emulators:start
```

This starts:
- Auth Emulator: http://localhost:9099
- Firestore Emulator: http://localhost:8080
- Emulator UI: http://localhost:4000

3. **Serve the app** (any static server):
```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

4. **Access the app**: 
   - Login: http://localhost:8080/auth/login.html
   - App: http://localhost:8080/app/index.html

### Seeding Test Data

To add test users in the Auth emulator:

1. Open Emulator UI: http://localhost:4000
2. Go to Authentication tab
3. Add users manually, or:

```javascript
// In browser console on login page
firebase.auth().createUserWithEmailAndPassword('test@example.com', 'password123')
```

### Production vs Emulator

Toggle between production and emulator by changing `USE_EMULATORS` in `firebase-config.js`:

- `USE_EMULATORS = false` → Production Firebase
- `USE_EMULATORS = true` → Local emulators

## Data Model

### User Profile (`users/{uid}`)

```javascript
{
  email: "user@example.com",
  displayName: "User Name",
  photoURL: "https://...",
  createdAt: timestamp,
  lastLoginAt: timestamp,
  defaultFrequency: "Fortnightly",
  currency: "AUD"
}
```

### Budget (`users/{uid}/budgets/{budgetId}`)

```javascript
{
  name: "My Budget",
  createdAt: timestamp,
  updatedAt: timestamp,
  settings: {
    incomeAmount: 2000,
    incomeFrequency: "Fortnightly",
    currency: "AUD"
  },
  expenses: [
    {
      id: "bucket_id",
      name: "Housing",
      bankAccount: "Main Account",
      include: true,
      color: "#2d3748",
      items: [
        {
          id: "item_id",
          name: "Rent",
          amount: 800,
          include: true
        }
      ]
    }
  ],
  savings: [
    {
      id: "bucket_id",
      name: "Emergency Fund",
      bankAccount: "Savings Account",
      include: true,
      goalEnabled: true,
      goalAmount: 5000,
      color: "#065f46",
      items: [
        {
          id: "item_id", 
          name: "Monthly contribution",
          amount: 200,
          include: true
        }
      ]
    }
  ]
}
```

## Usage

### Authentication

1. **Sign Up**: Create account with email/password or Google
2. **Sign In**: Access existing account
3. **Password Reset**: Email-based password recovery

### Budget Management

1. **Income Setup**: Set your income amount and frequency
2. **Add Buckets**: Create expense and savings categories
3. **Add Items**: Break down buckets into specific line items
4. **Color Coding**: Customize bucket colors for organization
5. **Goals**: Set savings targets with progress tracking
6. **Bank Accounts**: Track which account each bucket uses

### Data Migration

- **First Login**: Existing localStorage data is automatically imported
- **Manual Import**: Use Import button for JSON files
- **Export**: Download budget as JSON for backup

## Security

- **Authentication Required**: All budget data requires sign-in
- **User Isolation**: Users can only access their own data
- **Firestore Rules**: Server-side security prevents unauthorized access
- **Data Validation**: Client and server-side validation

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## Troubleshooting

### Quick Diagnostic

Run the **Smoke Test** to validate your setup:
```
http://localhost:8080/test/smoke-test.html?autorun=true
```

This comprehensive test validates:
- Firebase SDK initialization 
- Authentication state
- Firestore read/write permissions
- Data validation and security rules

### Common Issues

**"Firebase not initialized" or Module Import Errors**
```javascript
// Check auth/firebase.js exists and uses modular v10+ SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
```
- Ensure you're using the modern modular SDK, not the compat version
- Verify all script imports use `type="module"`
- Check browser console for specific import errors

**"Permission denied" in Firestore**
```bash
# Deploy updated security rules
firebase deploy --only firestore:rules

# Check rules in Firebase Console
# Firestore Database → Rules tab
```
- Verify user is authenticated: `authHelpers.waitForAuth()`
- Check Firestore rules match user UID: `request.auth.uid == uid`
- Run smoke test to validate auth+write flow

### Critical Production Issue: Firestore Permission Errors

**Problem**: `FirebaseError: Missing or insufficient permissions` errors in production, preventing all budget read/write operations.

**Root Cause**: Firestore rules in the Firebase Console contained a deny-all block at the end:
```javascript
match /{document=**} {
  allow read, write: if false;
}
```
This overrode all intended user-scoped rules, blocking legitimate operations.

**Symptoms**:
- All Firestore operations failed in production with permission errors
- Local emulators worked correctly (different rule set)
- Budget creation, saving, and loading all returned permission denied
- User authentication was successful but data access was blocked

**Solution**: 
1. **Identified mismatch** between local `firestore.rules` file and deployed console rules
2. **Replaced deny-all rules** with proper user-scoped permissions:
   ```javascript
   match /users/{uid} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
     match /{document=**} {
       allow read, write: if request.auth != null && request.auth.uid == uid;
     }
   }
   ```
3. **Deployed correct rules** via Firebase Console Rules editor
4. **Verified deployment** matched local firestore.rules file

**Verification Steps**:
- ✅ Confirmed correct rules were active in Firebase Console
- ✅ Tested with Firestore Rules Playground using actual user UIDs
- ✅ Verified production app could create and read `users/{uid}/budgets` documents
- ✅ Used debug tool (`/test/debug-firestore.html`) to validate all operations

**Lessons Learned**:
- **Always verify console rules** match local `firestore.rules` before production deploy
- **Check Firebase project ID** in app config matches the project in Firebase Console  
- **Test rules with Playground** using real user UIDs, not test data
- **Use debug tools** to isolate permission vs authentication issues
- **Deploy rules via CLI** (`firebase deploy --only firestore:rules`) for consistency

**Preventative Steps**:
- Keep local `firestore.rules` as single source of truth
- Use `firebase deploy` instead of manual console editing
- Add rule deployment to CI/CD pipeline
- Test rule changes in emulator before production deploy

**Network/Connection Issues**
```javascript
// Enable offline persistence and retry logic
// Already included in auth/firebase.js

// Check for network errors in cloud-store.js
if (isNetworkError(error)) {
    // Auto-retry with exponential backoff
}
```
- Use `withRetry()` wrapper for flaky operations
- Check browser Network tab for failed Firebase calls
- Verify internet connectivity to Firebase servers

**Emulator Connection Issues**
```bash
# Start all emulators
firebase emulators:start

# Check emulator status
curl http://localhost:9099  # Auth Emulator
curl http://localhost:8080  # Firestore Emulator
```
- Ensure `USE_EMULATORS = true` in auth/firebase.js
- Clear browser storage: `localStorage.clear()`
- Check emulator UI at http://localhost:4000

**Google Sign-In Problems**
```bash
# In Firebase Console → Authentication → Settings → Authorized domains
# Add your domains:
localhost
127.0.0.1
your-domain.com
```
- For development: Add `http://localhost:8080` 
- For production: Add your actual domain
- Check popup blocker settings in browser

**Data Validation Errors**
```javascript
// Use defensive validation in cloud-store.js
const cleanData = scrubUndefined(budgetData);
const validated = validateBudgetData(cleanData);
```
- All data is automatically scrubbed of `undefined` values
- Budget data must match Firestore rules structure
- Check browser console for detailed validation errors

### Advanced Debugging

**Enable Firebase Debug Logging**
```javascript
// Add to auth/firebase.js for detailed logs
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
// Add ?debug=true to URL for extra logging
```

**Manual Auth State Testing**
```javascript
// In browser console
const user = await authHelpers.waitForAuth();
console.log('User:', user);
const token = await authHelpers.getIdToken();
console.log('Token:', token?.substring(0, 50));
```

**Direct Firestore Testing**
```javascript
// In browser console (after auth)
const result = await cloudStore.healthCheck();
console.log('Health check:', result);

// Test specific operations
const budgets = await cloudStore.listBudgets(user.uid);
console.log('User budgets:', budgets);
```

**Security Rules Testing**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Test rules locally
firebase emulators:start --only firestore
# Then use Firestore Rules Playground in emulator UI
```

### Performance Issues

**Slow Loading**
- Enable offline persistence (already configured)
- Use batch operations for multiple updates
- Limit query results with `.limit(100)`
- Check Network tab for slow requests

**Memory Issues**
- Budget buckets limited to 50 per user
- Items limited to 200 per bucket  
- Auto-cleanup of temporary documents
- Use pagination for large datasets

### Development Tips

**Debugging Workflow**
1. Check browser console for errors
2. Run smoke test: `/test/smoke-test.html`
3. Use Firebase Emulator UI for data inspection
4. Test auth flow in incognito mode
5. Check Network tab for Firebase API responses

**Testing with Clean State**
```javascript
// Clear all local data
localStorage.clear();
sessionStorage.clear();

// Sign out and back in
await authHelpers.signOut();
// Navigate to login page
```

**Production vs Development**
```javascript
// In auth/firebase.js
const USE_EMULATORS = window.location.hostname === 'localhost';

// Automatic detection based on:
// - hostname (localhost, 127.0.0.1)
// - port (5000 for Firebase Hosting preview)
// - URL parameter (?emulator=true)
```

### Support

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Auth](https://firebase.google.com/docs/auth)

---

**Budget Buckets** - Take control of your finances with cloud-powered budgeting.
