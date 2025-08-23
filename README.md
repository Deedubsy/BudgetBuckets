# Budget Buckets

A personal budgeting application with Firebase authentication, Firestore database, and Stripe billing. Track your expenses using the "bucket method" with real-time syncing across devices.

![Budget Buckets Screenshot](./assets/app-screenshot.png)
*Expense tracking with visual bucket progress indicators*

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/Deedubsy/BudgetBuckets.git
cd BudgetBuckets
npm install

# Local development with billing
cp .env.example .env
# Edit .env with your Stripe test keys (see LOCAL_BILLING_SETUP.md)

# Start development server
npm run dev:full
```

Access the app at: http://localhost:8080

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (framework-free)
- **Authentication**: Firebase Auth v10 (Google SSO + Email/Password)
- **Database**: Cloud Firestore with security rules
- **Billing**: Stripe Checkout + Customer Portal + Webhooks
- **Hosting**: Firebase App Hosting with Express server
- **Runtime**: Node.js 20+ with Express

## ✨ Features

### Free Plan (≤ 5 buckets)
- ✅ Email & Google sign-in with email verification
- ✅ Up to 5 expense buckets
- ✅ Real-time sync across devices
- ✅ Visual progress tracking with allocation rings
- ✅ Basic overspend alerts and notes
- ✅ Data export/import (JSON backup)

### Plus Plan ($3.99 AUD/month)
- ✅ **Unlimited buckets**
- ✅ Priority email support
- 🚧 Collaboration features (coming soon)
- 🚧 Custom themes (coming soon)

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| **[Setup Firebase Auth](./docs/setup-firebase-auth.md)** | Configure Google SSO, email verification |
| **[Setup Stripe Billing](./docs/setup-stripe.md)** | Products, webhooks, test keys |
| **[App Hosting Deploy](./docs/app-hosting-deploy.md)** | Firebase deployment with secrets |
| **[Firestore Rules & Limits](./docs/firestore-rules-and-limits.md)** | Security rules, bucket limits |
| **[Auth & Billing Flows](./docs/auth-and-billing-flows.md)** | User journeys, token refresh |
| **[Troubleshooting](./docs/troubleshooting.md)** | Common errors and fixes |

## 🔧 Development Commands

```bash
npm start                 # Production server (port 8080)
npm run dev               # Development server with dev logs  
npm run dev:full          # Full server with billing (uses .env)

# Firebase
firebase emulators:start  # Start Firestore emulators
firebase deploy --only firestore:rules  # Deploy security rules
firebase hosting:channel:deploy preview  # Preview deployment
```

## 🌐 Routes

### Public Routes
- `/` - Landing page
- `/pricing` - Pricing plans (Free vs Plus)
- `/calculator` - Budget calculator tool
- `/guide/budget-buckets-method` - Methodology guide
- `/privacy`, `/terms`, `/support` - Legal pages

### App Routes  
- `/auth/login` - Login/signup page
- `/app` - Main budgeting application (authenticated)

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │   Express API    │    │   External      │
│                 │    │                  │    │   Services      │
│ • Vanilla JS    │◄──►│ • Static files   │◄──►│ • Firebase Auth │
│ • Firebase SDK  │    │ • Billing API    │    │ • Firestore     │
│ • Auth state    │    │ • CSP headers    │    │ • Stripe API    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Files
- `server.js` - Express routes, billing endpoints, CSP headers
- `firestore.rules` - Database security with bucket limits
- `apphosting.yaml` - Deployment config with Stripe secrets
- `app/lib/plan.js` - Plan management with custom claims
- `app/lib/bucket-store.js` - Firestore operations with batching

## 🔐 Security

- **CSP Headers**: Strict Content Security Policy via Helmet
- **Firebase Security Rules**: Owner-only access with plan enforcement
- **Stripe Webhooks**: Signature verification for billing events
- **Environment Variables**: Secrets via Firebase Secret Manager
- **Token Validation**: Firebase ID token verification on billing endpoints

## 🧪 Testing

```bash
# Smoke test checklist
open http://localhost:8080/test/smoke-test.html

# Test billing flows (requires Stripe test keys)
# 1. Sign up → email verification → app access
# 2. Create 5 buckets → hit free limit
# 3. Upgrade via Checkout → Plus access → unlimited buckets
# 4. Cancel via Portal → revert to Free → 5 bucket limit
```

Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline)

## 🚀 Deployment

Deploy to Firebase App Hosting:

```bash
# Set up secrets in Google Cloud Secret Manager
gcloud secrets create stripe-secret-key --data="sk_live_..."
gcloud secrets create stripe-webhook-secret --data="whsec_..."

# Deploy with secrets
firebase deploy --only apphosting
```

Environment variables are managed in `apphosting.yaml` with references to Secret Manager.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes following our patterns (see `docs/contributing.md`)
4. Test locally with `npm run dev:full`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

- **Plus Users**: Priority email support via [support page](/support)
- **Free Users**: Community support via GitHub Issues
- **Documentation**: Full guides in `/docs/` directory

---

**Last updated: 21 Aug 2025 (AEST)**  
Budget Buckets – Take control of your finances with cloud-powered budgeting.