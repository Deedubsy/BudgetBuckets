---
title: "Budget Buckets - System Overview"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["architecture", "c4", "components"]
---

# System Overview

## C4 Context Diagram

```mermaid
C4Context
    title Budget Buckets - System Context

    Person(user, "User", "Individual managing personal finances")
    
    System(budgetbuckets, "Budget Buckets", "Personal budgeting web application")
    
    System_Ext(firebase, "Firebase", "Authentication, database, and hosting platform")
    System_Ext(browser, "Web Browser", "Chrome, Firefox, Safari, Edge")
    
    Rel(user, browser, "Uses")
    Rel(browser, budgetbuckets, "HTTPS requests")
    Rel(budgetbuckets, firebase, "API calls")
    
    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

## C4 Container Diagram

```mermaid
C4Container
    title Budget Buckets - Container Diagram

    Person(user, "User")
    
    Container_Boundary(app, "Budget Buckets Application") {
        Container(web, "Web Server", "Node.js Express", "Serves static files and handles routing")
        Container(spa, "Single Page App", "Vanilla JS", "Budget management interface")
        Container(auth, "Auth Module", "Firebase Auth JS", "User authentication")
        Container(store, "Data Store", "Firestore JS", "Cloud data operations")
    }
    
    System_Ext(firebase_auth, "Firebase Auth", "User authentication service")
    System_Ext(firestore, "Cloud Firestore", "NoSQL document database")
    System_Ext(firebase_hosting, "Firebase Hosting", "Static file hosting and CDN")
    
    Rel(user, web, "HTTPS")
    Rel(web, spa, "Serves")
    Rel(spa, auth, "Uses")
    Rel(spa, store, "Uses")
    Rel(auth, firebase_auth, "API calls")
    Rel(store, firestore, "API calls")
    Rel(web, firebase_hosting, "Deployed to")
```

## Component Overview

### Core Components

| Component | Description | Source Location |
|-----------|-------------|-----------------|
| **Express Server** | Static file server with security headers | `server.js` |
| **Firebase Auth** | User authentication and session management | `auth/firebase.js` |
| **Cloud Store** | Firestore data operations with validation | `app/cloud-store.js` |
| **Budget App** | Main budgeting logic and UI | `app/app.js` |
| **Route Guard** | Authentication protection for routes | `auth/guard.js` |

### Supporting Components

| Component | Description | Source Location |
|-----------|-------------|-----------------|
| **Login UI** | Authentication forms and flows | `auth/login.html`, `auth/auth.js` |
| **Migration** | localStorage to Firestore data migration | `migrations/import-local.js` |
| **Test Suite** | Smoke tests and diagnostics | `test/smoke-test.html` |
| **Environment Switcher** | Development/production toggle | `environment-switcher.html` |

### Configuration

| Component | Description | Source Location |
|-----------|-------------|-----------------|
| **Firebase Config** | Project settings and API keys | `firebase.json` |
| **Security Rules** | Firestore access control | `firestore.rules` |
| **Express Security** | CSP and security headers | `server.js:19-60` |

## Architecture Principles

1. **Framework-free**: Vanilla JavaScript for simplicity and performance
2. **Security-first**: Comprehensive CSP, HTTPS, and user-scoped data access
3. **Offline-capable**: Firebase offline persistence and local storage fallbacks
4. **Progressive**: Works on all modern browsers without build steps
5. **Cloud-native**: Firebase services for authentication, database, and hosting

## Data Flow Overview

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant E as Express Server
    participant F as Firebase Auth
    participant D as Firestore

    U->>B: Access application
    B->>E: GET /auth/login.html
    E->>B: Login page
    U->>B: Enter credentials
    B->>F: signInWithEmailAndPassword()
    F->>B: User token
    B->>E: GET /app/index.html
    E->>B: Budget app
    B->>D: Get user budgets
    D->>B: Budget data
    B->>U: Display budget interface
```

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.18+
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Database**: Cloud Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Firebase App Hosting
- **Security**: Helmet.js, CSP headers