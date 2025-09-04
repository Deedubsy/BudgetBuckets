---
title: "Budget Buckets - Data Flow"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["architecture", "dataflow", "authentication"]
---

# Data Flow

## Authentication Flow

### Initial Login

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant G as Route Guard
    participant A as Firebase Auth
    participant C as Cloud Store
    participant D as Firestore

    U->>B: Navigate to /app
    B->>G: Check auth state
    G->>A: authHelpers.waitForAuth()
    A->>G: null (not authenticated)
    G->>B: Redirect to /auth/login.html
    
    U->>B: Enter email/password
    B->>A: signInWithEmailAndPassword()
    A->>B: User object + token
    B->>C: Initialize user profile
    C->>D: Check users/{uid} exists
    D->>C: Profile data or null
    
    alt Profile exists
        C->>B: Profile loaded
    else First login
        C->>D: Create user profile
        D->>C: Profile created
        C->>B: New profile loaded
    end
    
    B->>U: Redirect to /app
```

### Session Management

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as Firebase Auth
    participant L as Local Storage
    participant G as Route Guard

    Note over B,G: Page Load / Refresh
    
    B->>A: initializeAuth()
    A->>L: Check persistence token
    
    alt Valid token found
        A->>B: onAuthStateChanged(user)
        B->>G: setAuthState(authenticated)
    else No/invalid token
        A->>B: onAuthStateChanged(null)
        B->>G: setAuthState(anonymous)
        G->>B: Redirect to login
    end
```

## Budget Management Flow

### Loading User Budgets

```mermaid
sequenceDiagram
    participant U as User
    participant A as Budget App
    participant C as Cloud Store
    participant D as Firestore
    participant V as Validation

    U->>A: Access budget app
    A->>C: cloudStore.listBudgets(uid)
    C->>D: Query users/{uid}/budgets
    D->>C: Budget documents
    C->>V: validateBudgetData(data)
    V->>C: Validated budgets
    C->>A: Budget list
    A->>U: Render budget interface
```

### Creating/Updating Budgets

```mermaid
sequenceDiagram
    participant U as User
    participant A as Budget App
    participant C as Cloud Store
    participant V as Validation
    participant D as Firestore

    U->>A: Modify budget (add bucket, change amount)
    A->>V: validateBudgetData(budgetData)
    V->>A: Validation result
    
    alt Validation passes
        A->>C: cloudStore.saveBudget(uid, budgetData)
        C->>V: scrubUndefined(budgetData)
        V->>C: Clean data
        C->>D: Set users/{uid}/budgets/{budgetId}
        D->>C: Success
        C->>A: Save confirmed
        A->>U: UI updated
    else Validation fails
        A->>U: Show error message
    end
```

## Error Handling Flow

### Network Error Recovery

```mermaid
sequenceDiagram
    participant A as App
    participant C as Cloud Store
    participant R as Retry Logic
    participant D as Firestore
    participant O as Offline Storage

    A->>C: Save budget data
    C->>D: Firestore API call
    D-->>C: Network error
    C->>R: withRetry() wrapper
    
    loop Retry attempts (3x)
        R->>D: Retry API call
        D-->>R: Still failing
    end
    
    R->>O: Store offline for sync
    O->>A: Offline saved
    A->>A: Show offline indicator
    
    Note over A,O: When network recovers
    O->>D: Sync pending changes
    D->>O: Sync complete
    O->>A: Remove offline indicator
```

### Authentication Error Handling

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant E as Error Handler
    participant L as Login

    A->>A: API call fails
    A->>E: Check error type
    
    alt auth/unauthenticated
        E->>L: Redirect to login
        L->>U: Show login form
    else auth/permission-denied
        E->>U: Show permission error
    else network error
        E->>A: Trigger retry logic
    else validation error
        E->>U: Show field-specific errors
    end
```

## Data Migration Flow

### localStorage to Firestore Migration

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant M as Migration
    participant L as localStorage
    participant C as Cloud Store
    participant D as Firestore

    U->>A: First login after auth
    A->>M: Check for local data
    M->>L: Get budget data
    L->>M: Local budget JSON
    
    alt Local data exists
        M->>C: Check existing cloud data
        C->>D: Query users/{uid}/budgets
        D->>C: Existing budgets (if any)
        
        alt No cloud data
            M->>C: Import all local data
        else Cloud data exists
            M->>U: Show import options
            U->>M: Choose merge/replace
            M->>C: Execute chosen action
        end
        
        C->>D: Save imported data
        D->>C: Save complete
        C->>M: Migration success
        M->>L: Clear local data
        M->>U: Show success message
    else No local data
        M->>A: Skip migration
    end
```

## Real-time Sync Flow

### Multi-tab Synchronization

```mermaid
sequenceDiagram
    participant T1 as Tab 1
    participant T2 as Tab 2
    participant D as Firestore
    participant L as Local Cache

    T1->>D: Update budget data
    D->>D: Document updated
    D->>T2: onSnapshot() trigger
    T2->>L: Update local cache
    T2->>T2: Re-render UI
    
    Note over T1,T2: Both tabs now show updated data
```

## Performance Optimizations

### Batch Operations

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant B as Batch Handler
    participant D as Firestore

    U->>A: Multiple rapid changes
    A->>B: Queue operations
    B->>B: Debounce (300ms)
    B->>D: writeBatch() with all changes
    D->>B: Batch committed
    B->>A: All changes saved
    A->>U: UI reflects final state
```

This data flow architecture ensures reliable, secure, and performant budget management while maintaining real-time synchronization across devices and handling offline scenarios gracefully.