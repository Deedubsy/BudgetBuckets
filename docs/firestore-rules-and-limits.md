# Firestore Rules & Limits Guide

Complete guide to Firestore security rules, bucket limits enforcement, and atomic operations for Budget Buckets plan restrictions.

## Overview

Budget Buckets enforces plan limits using:
- **Custom claims**: Plan type stored in Firebase Auth tokens (`plan: 'free'|'plus'`)
- **Firestore rules**: Server-side enforcement of bucket creation limits
- **Atomic operations**: Consistent bucket counting with Firestore transactions
- **Client-side guards**: UI prevention of exceeding limits

## 1. Security Rules Architecture

### 1.1 Rules Structure

```javascript
// firestore.rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function signedIn() { return request.auth != null; }
    function isOwner(uid) { return request.auth != null && request.auth.uid == uid; }
    function getUserPlan() { return request.auth.token.plan != null ? request.auth.token.plan : 'free'; }
    
    // Bucket limit validation
    function validateBucketLimit(counterRef) {
      let currentCount = getAfter(counterRef).data.total;
      let previousCount = get(counterRef).data.total;
      let plan = getUserPlan();
      
      // Allow if Plus plan
      if (plan == 'plus') { return true; }
      
      // For Free plan, check bucket count increment
      return currentCount == previousCount + 1 && currentCount <= 5;
    }
    
    // User data access patterns
    match /users/{uid} {
      allow read, write: if isOwner(uid);
      
      // Bucket counter document
      match /meta/bucketCounts {
        allow read: if isOwner(uid);
        allow write: if isOwner(uid); // Validation in budget rules
      }
      
      // Budget documents with limit enforcement
      match /budgets/{budgetId} {
        allow read: if isOwner(uid);
        allow update: if isOwner(uid);
        
        // Create: increment counter + respect limits
        allow create: if isOwner(uid) && validateBucketLimit(
          /databases/$(database)/documents/users/$(uid)/meta/bucketCounts
        );
        
        // Delete: decrement counter
        allow delete: if isOwner(uid) && validateBucketDecrement(
          /databases/$(database)/documents/users/$(uid)/meta/bucketCounts
        );
      }
    }
  }
}
```

### 1.2 Helper Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `signedIn()` | Check if user authenticated | `boolean` |
| `isOwner(uid)` | Verify user owns resource | `boolean` |
| `getUserPlan()` | Get plan from custom claims | `'free'` or `'plus'` |
| `validateBucketLimit()` | Check bucket creation allowed | `boolean` |
| `validateBucketDecrement()` | Check bucket deletion allowed | `boolean` |

## 2. Plan Enforcement Logic

### 2.1 Custom Claims Integration

Custom claims are set by Stripe webhooks:

```javascript
// server.js - Webhook sets claims
await admin.auth().setCustomUserClaims(firebaseUid, { 
  plan: status === 'active' ? 'plus' : 'free' 
});
```

Rules access claims via `request.auth.token.plan`:

```javascript
// firestore.rules - Plan detection
function getUserPlan() {
  return request.auth.token.plan != null ? request.auth.token.plan : 'free';
}
```

### 2.2 Bucket Limit Enforcement

```javascript
// firestore.rules - Limit validation
function validateBucketLimit(counterRef) {
  let currentCount = getAfter(counterRef).data.total;  // After operation
  let previousCount = get(counterRef).data.total;      // Before operation
  let plan = getUserPlan();
  
  // Plus users: unlimited buckets
  if (plan == 'plus') {
    return true;
  }
  
  // Free users: max 5 buckets
  return currentCount == previousCount + 1 && currentCount <= 5;
}
```

**Logic Breakdown:**
- `getAfter()`: Counter value **after** the transaction
- `get()`: Counter value **before** the transaction  
- Free plan: Allow only if increment by 1 and total ≤ 5
- Plus plan: Allow unlimited creation

## 3. Atomic Counter Operations

### 3.1 Counter Document Structure

```javascript
// /users/{uid}/meta/bucketCounts
{
  total: 3,                    // Current bucket count
  lastUpdated: Timestamp,      // Last increment/decrement
  userId: "user-uid-here"      // Owner reference
}
```

### 3.2 Client-Side Atomic Operations

```javascript
// app/lib/bucket-store.js - Atomic bucket creation
import { runTransaction, writeBatch, increment } from "firebase/firestore";

export async function createBucket(bucketData) {
  const db = getFirestore();
  const batch = writeBatch(db);
  
  const userId = auth.currentUser.uid;
  const bucketRef = doc(collection(db, 'users', userId, 'budgets'));
  const counterRef = doc(db, 'users', userId, 'meta', 'bucketCounts');
  
  try {
    // Atomic transaction for bucket + counter
    await runTransaction(db, async (transaction) => {
      // Check current count
      const counterDoc = await transaction.get(counterRef);
      const currentCount = counterDoc.exists() ? counterDoc.data().total : 0;
      
      // Client-side plan check (UI guard)
      const plan = getCurrentPlan(); // From app/lib/plan.js
      if (plan === 'free' && currentCount >= 5) {
        throw new Error('Free plan limited to 5 buckets. Upgrade to Plus for unlimited buckets.');
      }
      
      // Create bucket document
      transaction.set(bucketRef, {
        ...bucketData,
        userId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Increment counter atomically
      transaction.set(counterRef, {
        total: currentCount + 1,
        lastUpdated: serverTimestamp(),
        userId: userId
      }, { merge: true });
    });
    
    return bucketRef.id;
    
  } catch (error) {
    if (error.code === 'permission-denied') {
      throw new Error('Unable to create bucket. Check your plan limits.');
    }
    throw error;
  }
}
```

### 3.3 Bucket Deletion with Counter Decrement

```javascript
// app/lib/bucket-store.js - Atomic bucket deletion
export async function deleteBucket(bucketId) {
  const db = getFirestore();
  const userId = auth.currentUser.uid;
  
  const bucketRef = doc(db, 'users', userId, 'budgets', bucketId);
  const counterRef = doc(db, 'users', userId, 'meta', 'bucketCounts');
  
  try {
    await runTransaction(db, async (transaction) => {
      // Delete bucket document
      transaction.delete(bucketRef);
      
      // Decrement counter
      const counterDoc = await transaction.get(counterRef);
      const currentCount = counterDoc.exists() ? counterDoc.data().total : 0;
      
      transaction.set(counterRef, {
        total: Math.max(0, currentCount - 1), // Prevent negative counts
        lastUpdated: serverTimestamp(),
        userId: userId
      }, { merge: true });
    });
    
  } catch (error) {
    console.error('Failed to delete bucket:', error);
    throw error;
  }
}
```

## 4. Error Handling

### 4.1 Permission Denied Scenarios

| Scenario | Error Code | User Message |
|----------|------------|--------------|
| Free user creates 6th bucket | `permission-denied` | "Free plan limited to 5 buckets. Upgrade to Plus for unlimited buckets." |
| Unauthenticated access | `permission-denied` | "Please sign in to access your buckets." |
| Wrong user accessing data | `permission-denied` | "Access denied. You can only view your own buckets." |

### 4.2 Client-Side Error Handling

```javascript
// app/lib/bucket-store.js - Error handling
export async function createBucket(bucketData) {
  try {
    // ... atomic operation
  } catch (error) {
    switch (error.code) {
      case 'permission-denied':
        if (error.message.includes('bucket') || getCurrentPlan() === 'free') {
          throw new Error('Free plan limited to 5 buckets. Upgrade to Plus for unlimited buckets.');
        }
        throw new Error('Access denied. Please check your permissions.');
        
      case 'unauthenticated':
        throw new Error('Please sign in to create buckets.');
        
      case 'resource-exhausted':
        throw new Error('Service temporarily unavailable. Please try again.');
        
      default:
        console.error('Bucket creation error:', error);
        throw new Error('Failed to create bucket. Please try again.');
    }
  }
}
```

## 5. Plan Upgrade Scenarios

### 5.1 Free to Plus Upgrade

When user upgrades to Plus:

1. **Stripe webhook** updates custom claims:
   ```javascript
   await admin.auth().setCustomUserClaims(uid, { plan: 'plus' });
   ```

2. **Client refreshes token** to get new claims:
   ```javascript
   // app/lib/plan.js - Force token refresh
   const tokenResult = await user.getIdTokenResult(true); // force refresh
   const newPlan = tokenResult.claims.plan || 'free';
   ```

3. **Firestore rules** immediately allow unlimited buckets:
   ```javascript
   // firestore.rules - Plus plan check
   if (plan == 'plus') { return true; } // Unlimited buckets
   ```

### 5.2 Plus to Free Downgrade

When subscription cancelled:

1. **Existing buckets** remain accessible (no data loss)
2. **New bucket creation** blocked if user has > 5 buckets
3. **User must delete** excess buckets to create new ones

```javascript
// app/lib/bucket-store.js - Downgrade handling
const currentCount = await getCurrentBucketCount();
if (plan === 'free' && currentCount >= 5) {
  throw new Error(`Free plan limited to 5 buckets. You currently have ${currentCount} buckets. Please delete ${currentCount - 5} buckets to create new ones, or upgrade to Plus.`);
}
```

## 6. Testing & Validation

### 6.1 Rules Testing

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Test rules locally
firebase emulators:start --only firestore

# Run rules test file
firebase emulators:exec "npm test"
```

### 6.2 Test Scenarios

```javascript
// Test cases for Firestore rules
describe('Bucket limits', () => {
  test('Free user can create up to 5 buckets', async () => {
    // Set custom claims: { plan: 'free' }
    // Create 5 buckets → should succeed
    // Create 6th bucket → should fail with permission-denied
  });
  
  test('Plus user can create unlimited buckets', async () => {
    // Set custom claims: { plan: 'plus' }
    // Create 10+ buckets → should succeed
  });
  
  test('Counter increments atomically', async () => {
    // Create bucket → verify counter incremented
    // Delete bucket → verify counter decremented
  });
});
```

### 6.3 Production Monitoring

Monitor these metrics:

```javascript
// app/lib/bucket-store.js - Error tracking
export async function createBucket(bucketData) {
  try {
    // ... creation logic
    console.log('Bucket created successfully:', bucketRef.id);
  } catch (error) {
    // Track errors for monitoring
    console.error('Bucket creation failed:', {
      error: error.code,
      message: error.message,
      plan: getCurrentPlan(),
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}
```

## 7. Performance Considerations

### 7.1 Counter Document Contention

**Problem**: Multiple rapid bucket creations can cause transaction conflicts

**Solution**: Exponential backoff retry

```javascript
// app/lib/bucket-store.js - Retry logic
async function createBucketWithRetry(bucketData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await createBucket(bucketData);
    } catch (error) {
      if (error.code === 'aborted' && attempt < maxRetries - 1) {
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        continue;
      }
      throw error;
    }
  }
}
```

### 7.2 Rule Complexity

**Current rules complexity**: Moderate (O(1) operations)
- `getUserPlan()`: Token lookup
- `validateBucketLimit()`: Two document reads (`get()` + `getAfter()`)

**Optimization**: Rules are optimized for security over performance

## 8. Deployment Checklist

✅ **Rules Deployment**
- [ ] Rules tested locally with emulators
- [ ] All plan scenarios validated  
- [ ] Error messages user-friendly
- [ ] Performance acceptable (< 200ms rule evaluation)

✅ **Client Integration**
- [ ] Atomic operations implemented for bucket CRUD
- [ ] Error handling covers all permission scenarios
- [ ] Plan state synchronization working
- [ ] UI shows appropriate upgrade prompts

✅ **Production Validation**
- [ ] Free user blocked at 6th bucket creation
- [ ] Plus user can create unlimited buckets  
- [ ] Plan upgrades immediately unlock unlimited buckets
- [ ] Plan downgrades enforce limits on new buckets

---

**Last updated: 21 Aug 2025 (AEST)**