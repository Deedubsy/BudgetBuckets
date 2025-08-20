---
title: "Budget Buckets - Database Migration Guide"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["guide", "database", "migrations", "firestore"]
---

# Database Migration Guide

Procedures for safely migrating Budget Buckets Firestore data structures and schema changes.

## Migration Philosophy

Budget Buckets uses **forward-compatible migrations** for Firestore:
- New fields are additive (old clients ignore unknown fields)
- Existing data structures remain readable by current app versions
- Migrations run client-side during user sessions
- No downtime required for most schema changes

## Migration Architecture

### 1. Version Tracking

User documents include version tracking:
```javascript
// User document structure
{
  profile: {
    email: "user@example.com",
    createdAt: "2025-01-15T10:30:00Z",
    schemaVersion: 2,  // Current schema version
    lastMigration: "2025-08-20T14:22:00Z"
  },
  budgets: { /* budget data */ }
}
```

### 2. Migration Functions

Located in `migrations/migration-runner.js`:
```javascript
const CURRENT_SCHEMA_VERSION = 2;
const MIGRATIONS = {
  1: migration_v1_to_v2,
  2: migration_v2_to_v3,
  // Add new migrations here
};

async function runMigrations(uid) {
  const userDoc = await getUserDocument(uid);
  const currentVersion = userDoc.profile?.schemaVersion || 1;
  
  for (let version = currentVersion; version < CURRENT_SCHEMA_VERSION; version++) {
    await MIGRATIONS[version](uid);
    await updateSchemaVersion(uid, version + 1);
  }
}
```

### 3. Migration Triggers

Migrations run automatically:
- **App Load**: Check schema version on authentication
- **Data Access**: Lazy migration when accessing outdated data
- **Manual Trigger**: Admin tools for bulk migrations

## Common Migration Patterns

### 1. Adding New Fields

**Safe Pattern**: Add optional fields with defaults
```javascript
// Migration: Add currency field to budgets
async function migration_v1_to_v2(uid) {
  const budgetsRef = collection(db, `users/${uid}/budgets`);
  const snapshot = await getDocs(budgetsRef);
  
  const batch = writeBatch(db);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    // Add currency if not present
    if (!data.settings?.currency) {
      batch.update(doc.ref, {
        'settings.currency': 'AUD'  // Default value
      });
    }
  });
  
  await batch.commit();
  console.log(`Migration v1→v2 completed for user ${uid}`);
}
```

### 2. Restructuring Data

**Pattern**: Gradual restructure with dual-read support
```javascript
// Migration: Move bank accounts from strings to objects  
async function migration_v2_to_v3(uid) {
  const budgetsRef = collection(db, `users/${uid}/budgets`);
  const snapshot = await getDocs(budgetsRef);
  
  const batch = writeBatch(db);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Convert string bank accounts to objects
    if (data.expenses) {
      const updatedExpenses = data.expenses.map(expense => {
        if (typeof expense.bankAccount === 'string') {
          return {
            ...expense,
            bankAccount: {
              id: generateId(),
              name: expense.bankAccount,
              type: 'checking',  // Default type
              balance: 0  // Unknown balance
            }
          };
        }
        return expense;
      });
      
      batch.update(doc.ref, { expenses: updatedExpenses });
    }
  });
  
  await batch.commit();
  console.log(`Migration v2→v3 completed for user ${uid}`);
}
```

### 3. Data Validation and Cleanup

**Pattern**: Fix inconsistent data during migration
```javascript  
// Migration: Clean up invalid expense amounts
async function migration_v3_to_v4(uid) {
  const budgetsRef = collection(db, `users/${uid}/budgets`);
  const snapshot = await getDocs(budgetsRef);
  
  const batch = writeBatch(db);
  let cleanupCount = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const cleanedExpenses = [];
    
    data.expenses?.forEach(expense => {
      const cleanedItems = expense.items?.map(item => ({
        ...item,
        amount: parseFloat(item.amount) || 0,  // Fix NaN amounts
        include: item.include !== false  // Default to true
      })) || [];
      
      cleanedExpenses.push({
        ...expense,
        items: cleanedItems
      });
    });
    
    if (cleanedExpenses.length > 0) {
      batch.update(doc.ref, { expenses: cleanedExpenses });
      cleanupCount++;
    }
  });
  
  if (cleanupCount > 0) {
    await batch.commit();
    console.log(`Migration v3→v4 cleaned ${cleanupCount} budgets for user ${uid}`);
  }
}
```

## Migration Procedures

### 1. Development and Testing

#### Create Migration
```bash
# 1. Create migration function in migrations/
# migrations/migration-v2-to-v3.js

export async function migration_v2_to_v3(uid) {
  // Migration logic here
}

# 2. Add to migration runner
# migrations/migration-runner.js
import { migration_v2_to_v3 } from './migration-v2-to-v3.js';

const CURRENT_SCHEMA_VERSION = 3;
const MIGRATIONS = {
  1: migration_v1_to_v2,
  2: migration_v2_to_v3,  // Add new migration
};
```

#### Test Migration
```bash
# 1. Start Firebase emulators with test data
firebase emulators:start --import=./test-data

# 2. Run migration test
# http://localhost:8080/test/migration-test.html
# Tests migration with sample data

# 3. Verify data integrity  
# http://localhost:8080/test/data-validation.html
# Validates all data after migration
```

### 2. Production Deployment

#### Pre-deployment Checklist
- [ ] Migration tested in emulator with production data export
- [ ] Rollback plan documented
- [ ] Migration is non-destructive (preserves original data)
- [ ] Performance impact assessed for large datasets
- [ ] Backup created before deployment

#### Deployment Steps
```bash
# 1. Export production data (backup)
firebase firestore:export gs://budget-buckets-backup/pre-migration-$(date +%Y%m%d)

# 2. Deploy migration code
git checkout migration-v2-v3  
firebase deploy --only hosting

# 3. Update schema version constant
# This triggers migrations on next user login

# 4. Monitor migration progress
# Check Firebase Console for error logs
# Monitor user feedback for issues
```

#### Gradual Rollout
```javascript
// Feature flag for gradual migration rollout
const MIGRATION_ROLLOUT_PERCENTAGE = 10;  // Start with 10% of users

function shouldRunMigration(uid) {
  const hash = hashString(uid) % 100;
  return hash < MIGRATION_ROLLOUT_PERCENTAGE;
}
```

### 3. Monitoring and Validation

#### Migration Metrics
```javascript
// Track migration success/failure
function logMigrationResult(uid, version, success, error = null) {
  const logData = {
    uid,
    version,
    success,
    error: error?.message,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  };
  
  // Send to analytics or logging service
  console.log('Migration result:', logData);
}
```

#### Data Validation
```javascript
// Post-migration validation
async function validateUserData(uid) {
  const userDoc = await getUserDocument(uid);
  const validationErrors = [];
  
  // Check required fields
  if (!userDoc.profile?.schemaVersion) {
    validationErrors.push('Missing schema version');
  }
  
  // Validate budget structure
  userDoc.budgets?.forEach(budget => {
    if (!budget.name || budget.name.length === 0) {
      validationErrors.push(`Budget missing name: ${budget.id}`);
    }
    
    budget.expenses?.forEach(expense => {
      expense.items?.forEach(item => {
        if (isNaN(item.amount)) {
          validationErrors.push(`Invalid amount in ${expense.name}: ${item.amount}`);
        }
      });
    });
  });
  
  return validationErrors;
}
```

## Migration Examples

### Example 1: Adding Budget Categories

**Scenario**: Add category field to expense items

```javascript
// Before: 
{
  expenses: [{
    id: "housing",
    name: "Housing", 
    items: [
      { id: "rent", name: "Rent", amount: 1500 }
    ]
  }]
}

// After:
{
  expenses: [{
    id: "housing", 
    name: "Housing",
    category: "essential",  // New field
    items: [
      { 
        id: "rent", 
        name: "Rent", 
        amount: 1500,
        category: "housing"  // New field
      }
    ]
  }]
}

// Migration:
async function addExpenseCategories(uid) {
  const budgetsRef = collection(db, `users/${uid}/budgets`);
  const snapshot = await getDocs(budgetsRef);
  
  const categoryMapping = {
    'housing': 'essential',
    'food': 'essential', 
    'entertainment': 'discretionary',
    'savings': 'savings'
  };
  
  const batch = writeBatch(db);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const updatedExpenses = data.expenses?.map(expense => ({
      ...expense,
      category: categoryMapping[expense.id] || 'other',
      items: expense.items?.map(item => ({
        ...item,
        category: expense.id
      }))
    }));
    
    batch.update(doc.ref, { expenses: updatedExpenses });
  });
  
  await batch.commit();
}
```

### Example 2: Data Structure Normalization

**Scenario**: Split combined savings/goals into separate collections

```javascript
// Before: Goals embedded in savings
{
  savings: [{
    id: "emergency",
    name: "Emergency Fund",
    currentAmount: 5000,
    goalAmount: 10000,  // Goal data embedded
    goalDeadline: "2025-12-31",
    items: [...]
  }]
}

// After: Separate goals collection
{
  savings: [{
    id: "emergency", 
    name: "Emergency Fund",
    currentAmount: 5000,
    goalId: "goal_emergency",  // Reference to goal
    items: [...]
  }],
  goals: [{  // New collection
    id: "goal_emergency",
    savingsId: "emergency", 
    targetAmount: 10000,
    deadline: "2025-12-31",
    progress: 0.5
  }]
}

// Migration:
async function separateGoalsFromSavings(uid) {
  const budgetsRef = collection(db, `users/${uid}/budgets`);
  const snapshot = await getDocs(budgetsRef);
  
  const batch = writeBatch(db);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const goals = [];
    const updatedSavings = [];
    
    data.savings?.forEach(saving => {
      // Extract goal data if present
      if (saving.goalAmount) {
        const goalId = `goal_${saving.id}`;
        goals.push({
          id: goalId,
          savingsId: saving.id,
          targetAmount: saving.goalAmount,
          deadline: saving.goalDeadline,
          progress: saving.currentAmount / saving.goalAmount
        });
        
        // Update savings reference
        updatedSavings.push({
          ...saving,
          goalId: goalId,
          // Remove goal-specific fields
          goalAmount: undefined,
          goalDeadline: undefined
        });
      } else {
        updatedSavings.push(saving);
      }
    });
    
    batch.update(doc.ref, { 
      savings: updatedSavings,
      goals: goals.length > 0 ? goals : undefined
    });
  });
  
  await batch.commit();
}
```

## Rollback Procedures

### 1. Automatic Rollback Detection
```javascript
// Monitor for migration failures
async function checkMigrationHealth() {
  const failureRate = await getMigrationFailureRate();
  
  if (failureRate > 0.05) {  // > 5% failure rate
    await disableMigrations();
    await alertDevelopmentTeam();
  }
}
```

### 2. Manual Rollback
```bash
# 1. Stop migration rollout
# Set MIGRATION_ENABLED = false in configuration

# 2. Restore from backup if necessary
firebase firestore:import gs://budget-buckets-backup/pre-migration-YYYYMMDD

# 3. Rollback application code
git checkout previous-stable-version
firebase deploy --only hosting

# 4. Communication
# Notify affected users of temporary data rollback
```

## Performance Considerations

### 1. Batch Operations
- Use `writeBatch()` for multiple document updates
- Limit batches to 500 operations
- Process users in chunks to avoid memory issues

### 2. Migration Scheduling
```javascript
// Spread migrations over time to avoid load spikes
function delayMigration(uid) {
  const delay = hashString(uid) % 3600000;  // 0-1 hour delay
  setTimeout(() => runMigrations(uid), delay);
}
```

### 3. Progress Tracking
```javascript
// Track migration progress across user base
async function updateMigrationProgress(version, completed, total) {
  await setDoc(doc(db, 'admin', 'migration-status'), {
    version,
    completed,
    total,
    percentage: (completed / total * 100).toFixed(2),
    lastUpdated: new Date().toISOString()
  });
}
```

## Best Practices

### 1. Migration Design
- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Preserve original data during transition
- **Backward compatible**: Support old and new data formats
- **Testable**: Include comprehensive test coverage

### 2. Error Handling
```javascript
async function safeMigration(uid, migrationFn) {
  try {
    await migrationFn(uid);
    await logMigrationResult(uid, 'success');
  } catch (error) {
    await logMigrationResult(uid, 'failed', error);
    // Don't update schema version on failure
    throw error;
  }
}
```

### 3. Documentation
- Document all schema changes in this file
- Include migration reasoning and impact assessment  
- Provide rollback procedures for each migration
- Track migration history and completion rates

## References

- [Firestore Data Model](../architecture/data-model.md)
- [Cloud Store Implementation](../reference/http-api.md#database-api)
- [Data Validation Guide](./troubleshooting.md#data-validation-errors)
- [System Architecture](../architecture/system-overview.md)