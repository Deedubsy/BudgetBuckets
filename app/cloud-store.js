/**
 * Cloud Storage Module for Budget Buckets
 * Production-quality Firestore operations with Firebase v10+ modular SDK
 * Includes defensive data scrubbing, auth validation, and comprehensive error handling
 */

import { authHelpers, firestoreHelpers } from '../auth/firebase.js';

// Defensive data scrubbing helpers
function scrubUndefined(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj === undefined ? null : obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(scrubUndefined).filter(item => item !== null && item !== undefined);
    }
    
    const scrubbed = {};
    Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined) {
            scrubbed[key] = scrubUndefined(value);
        }
    });
    
    return scrubbed;
}

function validateNumber(value, min = 0) {
    if (value === null || value === undefined || value === '') return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : Math.max(num, min);
}

function validateString(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function validateBudgetItem(item) {
    if (!item || typeof item !== 'object') {
        return {
            id: generateId(),
            name: '',
            amount: 0,
            include: false
        };
    }
    
    return scrubUndefined({
        id: validateString(item.id) || generateId(),
        name: validateString(item.name),
        amount: validateNumber(item.amount),
        include: Boolean(item.include)
    });
}

function validateBucket(bucket) {
    if (!bucket || typeof bucket !== 'object') {
        return {
            id: generateId(),
            name: '',
            bankAccount: '',
            include: false,
            color: '',
            items: []
        };
    }
    
    const validated = {
        id: validateString(bucket.id) || generateId(),
        name: validateString(bucket.name),
        bankAccount: validateString(bucket.bankAccount),
        include: Boolean(bucket.include),
        color: validateString(bucket.color),
        type: validateString(bucket.type) || 'expense',
        orderIndex: validateNumber(bucket.orderIndex) || 0,
        notes: validateString(bucket.notes) || '',
        overspendThresholdPct: validateNumber(bucket.overspendThresholdPct) || 80,
        spentThisPeriodCents: validateNumber(bucket.spentThisPeriodCents) || 0,
        items: []
    };

    // Add savings-specific goal structure
    if (bucket.goal && typeof bucket.goal === 'object') {
        validated.goal = {
            amountCents: validateNumber(bucket.goal.amountCents) || 0,
            targetDate: validateString(bucket.goal.targetDate) || null,
            savedSoFarCents: validateNumber(bucket.goal.savedSoFarCents) || 0,
            contributionPerPeriodCents: validateNumber(bucket.goal.contributionPerPeriodCents) || 0,
            autoCalc: Boolean(bucket.goal.autoCalc)
        };
    }

    // Add debt-specific structure
    if (bucket.debt && typeof bucket.debt === 'object') {
        validated.debt = {
            aprPct: validateNumber(bucket.debt.aprPct) || 0,
            minPaymentCents: validateNumber(bucket.debt.minPaymentCents) || 0
        };
    }

    // Legacy support for old savings fields
    if (bucket.goalEnabled !== undefined || bucket.goalAmount !== undefined) {
        validated.goalEnabled = Boolean(bucket.goalEnabled);
        validated.goalAmount = validateNumber(bucket.goalAmount);
    }

    // Validate items (limit to 200 per bucket for performance)
    if (Array.isArray(bucket.items)) {
        validated.items = bucket.items
            .slice(0, 200)
            .map(validateBudgetItem)
            .filter(item => item.name || item.amount > 0);
    }

    return scrubUndefined(validated);
}

function validateBudgetData(data) {
    if (!data || typeof data !== 'object') {
        return {
            name: 'My Budget',
            settings: {
                incomeAmount: 0,
                incomeFrequency: 'Fortnightly',
                currency: 'AUD'
            },
            expenses: [],
            savings: [],
            debt: []
        };
    }
    
    const validFrequencies = ['Weekly', 'Fortnightly', 'Monthly', 'Yearly'];
    const settings = data.settings || {};
    
    const validated = {
        name: validateString(data.name, 'My Budget'),
        settings: {
            incomeAmount: validateNumber(settings.incomeAmount),
            incomeFrequency: validFrequencies.includes(settings.incomeFrequency) 
                ? settings.incomeFrequency 
                : 'Fortnightly',
            currency: validateString(settings.currency, 'AUD')
        },
        expenses: [],
        savings: [],
        debt: []
    };

    // Validate expenses array
    if (Array.isArray(data.expenses)) {
        validated.expenses = data.expenses
            .slice(0, 50) // Limit buckets for performance
            .map(validateBucket);
    }

    // Validate savings array
    if (Array.isArray(data.savings)) {
        validated.savings = data.savings
            .slice(0, 50) // Limit buckets for performance
            .map(validateBucket);
    }

    // Validate debt array
    if (Array.isArray(data.debt)) {
        validated.debt = data.debt
            .slice(0, 50) // Limit buckets for performance
            .map(validateBucket);
    }

    return scrubUndefined(validated);
}

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Auth validation helpers
async function requireAuth() {
    const user = await authHelpers.waitForAuth();
    if (!user) {
        throw new Error('Authentication required. Please sign in.');
    }
    return user;
}

async function validateUserAccess(uid) {
    const currentUser = await requireAuth();
    if (currentUser.uid !== uid) {
        throw new Error('Access denied. User can only access their own data.');
    }
    return currentUser;
}

// User Profile Functions
async function ensureUserProfile(user) {
    if (!user || !user.uid) {
        throw new Error('Invalid user object');
    }
    
    try {
        console.log('🔧 Ensuring user profile for:', user.uid);
        
        const userRef = firestoreHelpers.doc('users', user.uid);
        const userDoc = await firestoreHelpers.getDoc(userRef);
        
        const now = firestoreHelpers.serverTimestamp();
        
        if (!userDoc.exists()) {
            console.log('👤 Creating new user profile');
            
            const profile = scrubUndefined({
                email: validateString(user.email),
                displayName: validateString(user.displayName),
                photoURL: validateString(user.photoURL),
                defaultFrequency: 'Fortnightly',
                currency: 'AUD',
                createdAt: now,
                lastLoginAt: now
            });
            
            await firestoreHelpers.setDoc(userRef, profile);
            console.log('✅ User profile created');
            return profile;
        } else {
            console.log('🔄 Updating existing user profile');
            
            const updates = {
                lastLoginAt: now
            };
            
            // Update profile info if changed
            const currentData = userDoc.data();
            const email = validateString(user.email);
            const displayName = validateString(user.displayName);
            const photoURL = validateString(user.photoURL);
            
            if (currentData.email !== email) updates.email = email;
            if (currentData.displayName !== displayName) updates.displayName = displayName;
            if (currentData.photoURL !== photoURL) updates.photoURL = photoURL;
            
            const scrubbedUpdates = scrubUndefined(updates);
            await firestoreHelpers.updateDoc(userRef, scrubbedUpdates);
            
            console.log('✅ User profile updated');
            return { ...currentData, ...scrubbedUpdates };
        }
    } catch (error) {
        console.error('❌ Error ensuring user profile:', error);
        throw new Error(`Failed to setup user profile: ${error.message}`);
    }
}

async function getUserProfile(uid) {
    await validateUserAccess(uid);
    
    try {
        console.log('📖 Getting user profile for:', uid);
        
        const userRef = firestoreHelpers.doc('users', uid);
        const userDoc = await firestoreHelpers.getDoc(userRef);
        
        if (!userDoc.exists()) {
            throw new Error('User profile not found');
        }
        
        const profile = {
            id: userDoc.id,
            ...userDoc.data()
        };
        
        console.log('✅ User profile retrieved');
        return profile;
    } catch (error) {
        console.error('❌ Error getting user profile:', error);
        throw new Error(`Failed to get user profile: ${error.message}`);
    }
}

async function updateUserProfile(uid, updates) {
    await validateUserAccess(uid);
    
    if (!updates || typeof updates !== 'object') {
        throw new Error('Invalid updates object');
    }
    
    try {
        console.log('🔄 Updating user profile for:', uid);
        
        const userRef = firestoreHelpers.doc('users', uid);
        
        // Validate and sanitize updates
        const allowedFields = ['displayName', 'defaultFrequency', 'currency'];
        const validUpdates = {};
        
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                switch (field) {
                    case 'displayName':
                        validUpdates[field] = validateString(updates[field]);
                        break;
                    case 'defaultFrequency':
                        const validFreqs = ['Weekly', 'Fortnightly', 'Monthly', 'Yearly'];
                        validUpdates[field] = validFreqs.includes(updates[field]) 
                            ? updates[field] 
                            : 'Fortnightly';
                        break;
                    case 'currency':
                        validUpdates[field] = validateString(updates[field], 'AUD');
                        break;
                }
            }
        });
        
        if (Object.keys(validUpdates).length === 0) {
            throw new Error('No valid fields to update');
        }
        
        const scrubbedUpdates = scrubUndefined(validUpdates);
        await firestoreHelpers.updateDoc(userRef, scrubbedUpdates);
        
        console.log('✅ User profile updated successfully');
        return await getUserProfile(uid);
    } catch (error) {
        console.error('❌ Error updating user profile:', error);
        throw new Error(`Failed to update user profile: ${error.message}`);
    }
}

// Budget Functions
async function listBudgets(uid) {
    await validateUserAccess(uid);
    
    try {
        console.log('📚 Listing budgets for user:', uid);
        
        const budgetsCollection = firestoreHelpers.collection('users', uid, 'budgets');
        
        // Try with ordering first, fallback to simple query if index doesn't exist
        let snapshot;
        try {
            const orderedQuery = firestoreHelpers.query(
                budgetsCollection,
                firestoreHelpers.orderBy('updatedAt', 'desc'),
                firestoreHelpers.limit(100) // Reasonable limit for performance
            );
            snapshot = await firestoreHelpers.getDocs(orderedQuery);
        } catch (orderError) {
            console.warn('⚠️ Ordering failed (index may not exist), using simple query:', orderError.message);
            // Fallback to simple query without ordering
            const simpleQuery = firestoreHelpers.query(
                budgetsCollection,
                firestoreHelpers.limit(100)
            );
            snapshot = await firestoreHelpers.getDocs(simpleQuery);
        }
        
        console.log(`📊 Found ${snapshot.docs.length} budgets`);
        
        const budgets = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Ensure timestamps are handled properly
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
            };
        });
        
        // Sort in memory if we couldn't do it in the query
        budgets.sort((a, b) => {
            const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bTime - aTime;
        });
        
        console.log('✅ Budgets retrieved successfully');
        return budgets;
    } catch (error) {
        console.error('❌ Error listing budgets:', error);
        throw new Error(`Failed to list budgets: ${getErrorMessage(error)}`);
    }
}

async function createBudget(uid, budgetData) {
    await validateUserAccess(uid);
    
    if (!budgetData) {
        throw new Error('Budget data is required');
    }
    
    try {
        console.log('💰 Creating new budget for user:', uid);
        
        const validated = validateBudgetData(budgetData);
        const now = firestoreHelpers.serverTimestamp();
        
        const budgetWithTimestamps = scrubUndefined({
            ...validated,
            createdAt: now,
            updatedAt: now
        });
        
        const budgetsCollection = firestoreHelpers.collection('users', uid, 'budgets');
        const docRef = await firestoreHelpers.addDoc(budgetsCollection, budgetWithTimestamps);
        
        console.log('✅ Budget created with ID:', docRef.id);
        
        return {
            id: docRef.id,
            ...validated,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    } catch (error) {
        console.error('❌ Error creating budget:', error);
        throw new Error(`Failed to create budget: ${getErrorMessage(error)}`);
    }
}

async function readBudget(uid, budgetId) {
    await validateUserAccess(uid);
    
    if (!budgetId || typeof budgetId !== 'string') {
        throw new Error('Valid budget ID is required');
    }
    
    try {
        console.log('📖 Reading budget:', budgetId, 'for user:', uid);
        
        const budgetRef = firestoreHelpers.doc('users', uid, 'budgets', budgetId);
        const budgetDoc = await firestoreHelpers.getDoc(budgetRef);
        
        if (!budgetDoc.exists()) {
            throw new Error('Budget not found');
        }
        
        const data = budgetDoc.data();
        const budget = {
            id: budgetDoc.id,
            ...data,
            // Ensure timestamps are handled properly
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
        };
        
        console.log('✅ Budget retrieved successfully');
        return budget;
    } catch (error) {
        console.error('❌ Error reading budget:', error);
        throw new Error(`Failed to read budget: ${getErrorMessage(error)}`);
    }
}

async function updateBudget(uid, budgetId, updates) {
    await validateUserAccess(uid);
    
    if (!budgetId || typeof budgetId !== 'string') {
        throw new Error('Valid budget ID is required');
    }
    
    if (!updates || typeof updates !== 'object') {
        throw new Error('Update data is required');
    }
    
    try {
        console.log('🔄 Updating budget:', budgetId, 'for user:', uid);
        
        const validated = validateBudgetData(updates);
        const budgetRef = firestoreHelpers.doc('users', uid, 'budgets', budgetId);
        
        const updateData = scrubUndefined({
            ...validated,
            updatedAt: firestoreHelpers.serverTimestamp()
        });
        
        await firestoreHelpers.updateDoc(budgetRef, updateData);
        
        console.log('✅ Budget updated successfully');
        return await readBudget(uid, budgetId);
    } catch (error) {
        console.error('❌ Error updating budget:', error);
        throw new Error(`Failed to update budget: ${getErrorMessage(error)}`);
    }
}

async function deleteBudget(uid, budgetId) {
    await validateUserAccess(uid);
    
    if (!budgetId || typeof budgetId !== 'string') {
        throw new Error('Valid budget ID is required');
    }
    
    try {
        console.log('🗑️ Deleting budget:', budgetId, 'for user:', uid);
        
        const budgetRef = firestoreHelpers.doc('users', uid, 'budgets', budgetId);
        
        // Check if budget exists first
        const budgetDoc = await firestoreHelpers.getDoc(budgetRef);
        if (!budgetDoc.exists()) {
            throw new Error('Budget not found');
        }
        
        await firestoreHelpers.deleteDoc(budgetRef);
        
        console.log('✅ Budget deleted successfully');
    } catch (error) {
        console.error('❌ Error deleting budget:', error);
        throw new Error(`Failed to delete budget: ${getErrorMessage(error)}`);
    }
}

// Auto-save functionality with improved error handling
let autoSaveTimeout;
let autoSaveInProgress = false;

function scheduleAutoSave(uid, budgetId, budgetData, delay = 2000) {
    if (!uid || !budgetId || !budgetData) {
        console.warn('⚠️ Auto-save skipped: missing required parameters');
        return;
    }
    
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        if (autoSaveInProgress) {
            console.log('🔄 Auto-save already in progress, skipping');
            return;
        }
        
        autoSaveInProgress = true;
        try {
            console.log('💾 Auto-saving budget...');
            await updateBudget(uid, budgetId, budgetData);
            console.log('✅ Auto-save completed');
        } catch (error) {
            console.error('❌ Auto-save failed:', error);
            // Fire custom event for UI to handle
            window.dispatchEvent(new CustomEvent('autoSaveFailed', {
                detail: { error: getErrorMessage(error) }
            }));
        } finally {
            autoSaveInProgress = false;
        }
    }, delay);
}

// Batch operations for better performance
async function batchUpdateBudget(uid, budgetId, operations) {
    await validateUserAccess(uid);
    
    if (!budgetId || typeof budgetId !== 'string') {
        throw new Error('Valid budget ID is required');
    }
    
    if (!Array.isArray(operations) || operations.length === 0) {
        throw new Error('Operations array is required');
    }
    
    try {
        console.log('📦 Starting batch update for budget:', budgetId);
        
        const batch = firestoreHelpers.writeBatch();
        const budgetRef = firestoreHelpers.doc('users', uid, 'budgets', budgetId);
        
        // Apply all operations to the batch
        operations.forEach((operation, index) => {
            if (!operation || typeof operation !== 'object') {
                console.warn(`⚠️ Skipping invalid operation at index ${index}`);
                return;
            }
            
            const scrubbedOperation = scrubUndefined(operation);
            batch.update(budgetRef, scrubbedOperation);
        });
        
        // Add timestamp
        batch.update(budgetRef, {
            updatedAt: firestoreHelpers.serverTimestamp()
        });
        
        await batch.commit();
        
        console.log('✅ Batch update completed');
        return await readBudget(uid, budgetId);
    } catch (error) {
        console.error('❌ Error in batch update:', error);
        throw new Error(`Batch update failed: ${getErrorMessage(error)}`);
    }
}

// Enhanced error handling helpers
function isNetworkError(error) {
    const networkCodes = [
        'unavailable', 
        'deadline-exceeded',
        'cancelled',
        'unknown'
    ];
    
    return networkCodes.includes(error.code) || 
           error.message?.toLowerCase().includes('network') ||
           error.message?.toLowerCase().includes('connection') ||
           error.message?.toLowerCase().includes('timeout');
}

function isRetryableError(error) {
    const retryableCodes = [
        'unavailable',
        'deadline-exceeded', 
        'resource-exhausted',
        'aborted'
    ];
    
    return retryableCodes.includes(error.code) || isNetworkError(error);
}

function getErrorMessage(error) {
    if (!error) return 'An unknown error occurred.';
    
    // Handle auth helper errors
    if (error.message?.includes('Authentication required')) {
        return 'Please sign in to continue.';
    }
    
    if (error.message?.includes('Access denied')) {
        return 'You can only access your own data.';
    }
    
    if (isNetworkError(error)) {
        return 'Network error. Please check your connection and try again.';
    }
    
    // Handle specific Firestore error codes
    const errorMessages = {
        'permission-denied': 'You do not have permission to perform this action.',
        'not-found': 'The requested data was not found.',
        'already-exists': 'This item already exists.',
        'resource-exhausted': 'Too many requests. Please try again later.',
        'unauthenticated': 'Please sign in to continue.',
        'failed-precondition': 'The operation cannot be completed in the current state.',
        'invalid-argument': 'Invalid data provided.',
        'out-of-range': 'The requested operation is out of range.',
        'unimplemented': 'This feature is not yet supported.',
        'internal': 'Internal server error. Please try again.',
        'aborted': 'Operation was aborted. Please try again.',
        'cancelled': 'Operation was cancelled.'
    };
    
    return errorMessages[error.code] || error.message || 'An unexpected error occurred.';
}

// Retry helper for network operations
async function withRetry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (!isRetryableError(error) || attempt === maxRetries) {
                throw error;
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            console.warn(`⚠️ Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error.message);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// Health check function for troubleshooting
async function healthCheck() {
    try {
        console.log('🔍 Running cloud storage health check...');
        
        // Check auth state
        const user = await authHelpers.waitForAuth();
        if (!user) {
            throw new Error('Not authenticated');
        }
        console.log('✅ Auth: User authenticated as', user.uid);
        
        // Test basic Firestore access
        const testCollection = firestoreHelpers.collection('users', user.uid, 'budgets');
        const testQuery = firestoreHelpers.query(testCollection, firestoreHelpers.limit(1));
        
        await firestoreHelpers.getDocs(testQuery);
        console.log('✅ Firestore: Basic read access confirmed');
        
        // Test write access
        const testDoc = firestoreHelpers.doc('users', user.uid, 'health-check', 'test');
        await firestoreHelpers.setDoc(testDoc, { 
            timestamp: firestoreHelpers.serverTimestamp(),
            test: true 
        });
        console.log('✅ Firestore: Write access confirmed');
        
        // Clean up test document
        await firestoreHelpers.deleteDoc(testDoc);
        console.log('✅ Firestore: Delete access confirmed');
        
        console.log('🎉 Health check completed successfully');
        return { status: 'healthy', user: user.uid };
    } catch (error) {
        console.error('❌ Health check failed:', error);
        return { 
            status: 'unhealthy', 
            error: getErrorMessage(error),
            details: error.message 
        };
    }
}

// Export functions for global access
const cloudStore = {
    // Profile functions
    ensureUserProfile,
    getUserProfile,
    updateUserProfile,
    
    // Budget functions  
    listBudgets,
    createBudget,
    readBudget,
    updateBudget,
    deleteBudget,
    batchUpdateBudget,
    
    // Utility functions
    scheduleAutoSave,
    validateBudgetData,
    generateId,
    getErrorMessage,
    isNetworkError,
    isRetryableError,
    withRetry,
    healthCheck,
    
    // Data validation helpers
    scrubUndefined,
    validateString,
    validateNumber
};

// Make available globally and as module export
window.cloudStore = cloudStore;

export default cloudStore;
export {
    // Profile functions
    ensureUserProfile,
    getUserProfile,
    updateUserProfile,
    
    // Budget functions
    listBudgets,
    createBudget,
    readBudget,
    updateBudget,
    deleteBudget,
    batchUpdateBudget,
    
    // Utility functions
    scheduleAutoSave,
    validateBudgetData,
    generateId,
    getErrorMessage,
    isNetworkError,
    isRetryableError,
    withRetry,
    healthCheck,
    scrubUndefined,
    validateString,
    validateNumber
};