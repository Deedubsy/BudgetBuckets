---
title: "Budget Buckets – Overview"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["overview"]
---

# Budget Buckets

A personal budgeting application with cloud authentication and storage. Track your income, expenses, and savings goals with real-time syncing across devices using Firebase.

## 📚 Documentation

For comprehensive documentation, see our **[Documentation Index](./docs/INDEX.md)**:

- **[Setup & Development Guide](./docs/guides/setup-and-development.md)** - Complete installation and development instructions
- **[Project Structure](./docs/architecture/project-structure.md)** - Codebase organization and architecture
- **[Optimization Recommendations](./docs/planning/optimization-recommendations.md)** - Performance improvements and roadmap

## Stack at a Glance

- **Backend**: Node.js Express server with static file serving
- **Frontend**: Vanilla HTML/CSS/JavaScript (framework-free)
- **Database**: Cloud Firestore with Firebase Authentication
- **Hosting**: Firebase App Hosting with custom domain support

## Quickstart

```bash
# Clone and setup
git clone https://github.com/Deedubsy/BudgetBuckets.git
cd BudgetBuckets
npm install -g firebase-tools

# Configure Firebase (see setup guide for details)
cp auth/firebase-config.sample.js auth/firebase-config.js
# Edit firebase-config.js with your Firebase project config

# Start development
firebase emulators:start  # Start Firebase emulators
npm run dev              # Start Express server
```

Access the app:
- Login: http://localhost:8080/auth/login.html
- App: http://localhost:8080/app/index.html

## Common Commands

```bash
npm start                    # Start production server
npm run dev                  # Start development server
npm test                     # Run tests (placeholder)
firebase emulators:start     # Start Firebase emulators
firebase deploy --only firestore  # Deploy Firestore rules
```

## Features

- ✅ **Cloud Authentication** (Email/Google)
- ✅ **Real-time Sync** across devices  
- ✅ **Responsive Design** (mobile & desktop)
- ✅ **Savings Goals** with progress tracking
- ✅ **Data Export/Import** (JSON backup)
- ✅ **Auto-Migration** from localStorage

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript  
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Development**: Firebase Emulators

## Links

- **[📚 Documentation Index](./docs/INDEX.md)** - Complete documentation hub
- **[🏗️ System Architecture](./docs/architecture/system-overview.md)** - C4 diagrams and component overview
- **[📖 Setup Guide](./docs/guides/setup-dev.md)** - Detailed development setup
- **[🔧 API Reference](./docs/reference/http-api.md)** - Express routes and endpoints
- **[📋 Runbooks](./docs/runbooks/)** - Operational procedures

## Badges

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Node Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details

---

**Budget Buckets** - Take control of your finances with cloud-powered budgeting.
