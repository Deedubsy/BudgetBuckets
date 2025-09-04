# CLAUDE.md

## Project rules (must follow)
- Runtime: Firebase **App Hosting** running an **Express** server. Entry = `server.js`.
- **Do not** read/edit `firebase.json`. All routing/rewrites happen in `server.js`.
- Prefer `helmet`, `compression`, `static public/`, and SPA fallback to `public/index.html`.
- Firestore + Google Auth used on the **client**; Admin SDK on server only when needed.
- For CI or emulator tasks, propose steps first.

## Docs to prioritise
- Start with: `/docs/INDEX.md`
- Then skim: `/docs/architecture/system-overview.md`, `/docs/architecture/data-model.md`, `/docs/reference/http-api.md`

## Commands
- Start: `npm start` → `node server.js`
- Dev: `npm run dev` → `nodemon server.js`
- Emulators: `firebase emulators:start --only firestore,auth`

## Style
- JS/TS: modern syntax, minimal comments, small pure functions.
- Git: conventional commits.

## Architecture Overview
- **Frontend**: Vanilla JavaScript with ES6 modules (no framework)
- **Authentication**: Firebase Auth (email/password + Google OAuth)
- **Database**: Firestore with user-scoped security rules
- **Hosting**: Firebase App Hosting with custom domain (budgetbucket.app)
- **Build**: No build step - direct browser execution

## Key File Structure
```
/
├── server.js              # Express server entry point
├── auth/
│   ├── firebase.js        # Auth helpers & Firebase config
│   ├── firebase-config.js # Firebase project configuration
│   └── login.html         # Authentication pages
├── app/
│   ├── app.js            # Main application logic
│   ├── cloud-store.js    # Firestore operations
│   └── index.html        # Budget management interface
├── test/
│   ├── smoke-test.html   # Comprehensive test suite
│   └── network-diagnostic.html
└── docs/                 # Complete technical documentation
```

## Security Considerations
- User data isolation via Firestore security rules: `users/{uid}/*`
- Content Security Policy configured in server.js
- All authentication client-side, no server-side auth state
- Input validation on both client and Firestore rules

## Database Schema
```javascript
// Firestore structure
users/{uid}/
├── profile/              # User profile data
└── budgets/{budgetId}/   # Budget documents
    ├── name: string
    ├── settings: { incomeAmount, incomeFrequency, currency }
    ├── expenses: [{ id, name, color, items: [{ name, amount }] }]
    └── savings: [{ id, name, color, items: [{ name, amount }] }]
```

## Development Workflow
1. **Setup**: Follow `/docs/guides/setup-dev.md` for complete environment setup
2. **Testing**: Always run `/test/smoke-test.html?autorun=true` before commits
3. **Emulators**: Use Firebase emulators for all development (never production data)
4. **Validation**: All user inputs must be validated client-side + Firestore rules

## Common Patterns
```javascript
// Authentication check
const user = await authHelpers.waitForAuth();
if (!user) return redirectToLogin();

// Firestore operations  
const docRef = doc(db, `users/${uid}/budgets/${budgetId}`);
await setDoc(docRef, scrubUndefined(budgetData));

// Error handling
try {
  await operation();
} catch (error) {
  console.error('Operation failed:', error);
  showUserFriendlyError(error);
}
```

## Testing Strategy
- **Manual**: Smoke test suite covers Firebase init, auth, and CRUD operations
- **Validation**: All user flows tested manually before deployment
- **Cross-browser**: Chrome, Firefox, Safari, Edge supported
- **Performance**: Page load < 3s, calculations < 100ms

## Deployment
- **Staging**: Automatic via GitHub push to main branch
- **Production**: Firebase App Hosting with custom domain
- **Monitoring**: Built-in health checks and error tracking
- **Rollback**: Firebase Hosting version management

## Troubleshooting
- **Auth issues**: Check `/docs/guides/troubleshooting.md#authentication-issues`
- **Database errors**: Verify security rules and user UID matching
- **Performance**: Use network diagnostic test page
- **Emulator issues**: Restart with `firebase emulators:start --import=./emulator-data`

## Quick Commands Reference
```bash
# Development
npm run dev                    # Start dev server with nodemon
firebase emulators:start       # Start Firebase emulators

# Testing  
open test/smoke-test.html      # Run test suite
open test/network-diagnostic.html # Network connectivity test

# Deployment
git push origin main           # Auto-deploy via Firebase App Hosting

# Maintenance
firebase firestore:export gs://backup-bucket/$(date +%Y%m%d)  # Backup data
firebase deploy --only firestore:rules                        # Deploy rules
```

## Emergency Procedures
- **Service outage**: Follow `/docs/runbooks/incident-playbook.md`
- **Security incident**: Follow `/docs/runbooks/rotate-secrets.md`
- **Data issues**: See `/docs/guides/database-migrations.md`

## Resource Links
- [System Documentation](./docs/INDEX.md)
- [Development Setup](./docs/guides/setup-dev.md)  
- [API Reference](./docs/reference/http-api.md)
- [Troubleshooting](./docs/guides/troubleshooting.md)
- [Contributing Guide](./docs/contributing.md)