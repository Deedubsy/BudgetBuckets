---
title: "ADR: Technology Stack Selection"
status: "accepted"
date: "2025-08-20"
owner: "engineering"
tags: ["adr", "technology", "architecture"]
---

# ADR: Technology Stack Selection

## Status
**Status:** accepted  
**Date:** 2025-08-20  
**Owner:** engineering

## Context

Budget Buckets needed a technology stack that would support:
- Personal finance data with strong security requirements
- Real-time synchronization across devices
- Offline functionality for user convenience
- Simple deployment and maintenance
- Cost-effective hosting for individual users

Key considerations:
- **Security**: Financial data requires robust authentication and access controls
- **Simplicity**: Minimal build complexity and dependencies
- **Performance**: Fast loading and responsive interactions
- **Scalability**: Handle individual users efficiently without over-engineering
- **Cost**: Sustainable hosting costs for a personal finance app

## Decision

We chose a **Firebase-first, framework-free** technology stack:

**Backend:**
- Node.js Express server for static file serving
- Firebase App Hosting for deployment
- Cloud Firestore for data storage
- Firebase Authentication for user management

**Frontend:**
- Vanilla HTML/CSS/JavaScript (no framework)
- ES6 modules for code organization
- Firebase v10+ modular SDK

**Development:**
- Firebase Emulators for local development
- No build step or compilation required

## Consequences

### Positive
- **Security**: Firebase provides enterprise-grade security with minimal configuration
- **Real-time sync**: Firestore handles multi-device synchronization automatically
- **Offline support**: Firebase offline persistence works out of the box
- **No build complexity**: Direct browser execution without compilation
- **Fast development**: Rapid iteration without build/deploy cycles
- **Cost efficiency**: Firebase pricing scales with usage
- **Maintenance**: Minimal server-side code to maintain

### Negative
- **Framework benefits lost**: No reactive UI updates, state management, or component reusability
- **Manual DOM manipulation**: More verbose UI code compared to modern frameworks
- **Limited ecosystem**: Fewer third-party libraries designed for vanilla JS
- **Firebase lock-in**: Switching away from Firebase would require significant refactoring

### Neutral
- **Learning curve**: Team needs Firebase expertise rather than framework knowledge
- **Code organization**: Requires discipline to maintain clean vanilla JS architecture

## Alternatives Considered

### React + Firebase
- **Pros**: Modern development experience, component reusability, large ecosystem
- **Cons**: Build complexity, larger bundle size, overkill for simple budgeting UI
- **Decision**: Rejected due to unnecessary complexity for this use case

### Vue.js + Firebase  
- **Pros**: Lighter than React, good developer experience
- **Cons**: Still requires build process, additional dependency
- **Decision**: Rejected for same reasons as React

### Node.js + PostgreSQL
- **Pros**: Full control over data layer, SQL familiarity
- **Cons**: Complex infrastructure management, authentication implementation, real-time sync complexity
- **Decision**: Rejected due to operational overhead

### Static Site + Supabase
- **Pros**: PostgreSQL with real-time features, good documentation
- **Cons**: Less mature than Firebase, requires more manual configuration
- **Decision**: Rejected due to Firebase's superior ecosystem and documentation

## Implementation Evidence

The decision is validated by current implementation:

```javascript
// Simple, direct Firebase integration (auth/firebase.js:46-54)
const firebaseConfig = {
  apiKey: "AIzaSyAyQnI3I5IRm2MZ16ttVaaA-8bneE3lWeo",
  authDomain: "budgetbuckets-79b3b.firebaseapp.com",
  projectId: "budgetbuckets-79b3b",
  // ... other config
};

// No build step required - direct ES6 imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
```

```javascript
// Simple Express server (server.js:12-16)
const app = express();
const PORT = process.env.PORT || 8080;
// Static file serving with security headers
```

## References

- [Firebase Documentation](https://firebase.google.com/docs)
- [Budget Buckets Architecture Overview](../architecture/system-overview.md)
- [Performance Benchmarks](../planning/optimization-recommendations.md)