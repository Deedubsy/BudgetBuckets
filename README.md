# Budget Buckets

A personal budgeting application with cloud authentication and storage. Track your income, expenses, and savings goals with real-time syncing across devices.

## 📚 Documentation

For comprehensive documentation, see our **[Documentation Index](./docs/INDEX.md)**:

- **[Setup & Development Guide](./docs/guides/setup-and-development.md)** - Complete installation and development instructions
- **[Project Structure](./docs/architecture/project-structure.md)** - Codebase organization and architecture
- **[Optimization Recommendations](./docs/planning/optimization-recommendations.md)** - Performance improvements and roadmap

## Quick Start

1. **Clone and Setup**:
   ```bash
   git clone <repository-url>
   cd BudgetBuckets
   npm install -g firebase-tools
   ```

2. **Configure Firebase**:
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
   - Copy config to `auth/firebase-config.js`
   - Deploy security rules: `firebase deploy --only firestore`

3. **Start Development**:
   ```bash
   firebase emulators:start  # Start local emulators
   npx serve .              # Serve the app
   ```

4. **Access the App**:
   - Login: http://localhost:8080/auth/login.html
   - App: http://localhost:8080/app/index.html

For detailed setup instructions, see the **[Setup & Development Guide](./docs/guides/setup-and-development.md)**.

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details

---

**Budget Buckets** - Take control of your finances with cloud-powered budgeting.
