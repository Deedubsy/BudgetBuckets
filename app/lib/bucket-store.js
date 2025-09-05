import { 
  getFirestore, 
  writeBatch, 
  doc, 
  increment, 
  serverTimestamp,
  deleteDoc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Lazy initialization to ensure Firebase is ready
let db;
function getDB() {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

/**
 * Create a bucket with atomic counter increment
 * @param {string} uid - User ID
 * @param {string} budgetId - Budget ID  
 * @param {Object} bucketData - Bucket data
 */
export async function createBucketDoc(uid, budgetId, bucketData) {
  const db = getDB();
  const batch = writeBatch(db);
  
  // Create bucket document
  const bucketRef = doc(db, 'users', uid, 'budgets', budgetId);
  batch.set(bucketRef, bucketData);
  
  // Increment bucket counter
  const counterRef = doc(db, 'users', uid, 'meta', 'bucketCounts');
  batch.set(counterRef, {
    total: increment(1),
    updatedAt: serverTimestamp()
  }, { merge: true });
  
  await batch.commit();
}

/**
 * Delete a bucket with atomic counter decrement
 * @param {string} uid - User ID
 * @param {string} budgetId - Budget ID (bucket document ID)
 */
export async function deleteBucketDoc(uid, budgetId) {
  const db = getDB();
  const batch = writeBatch(db);
  
  // Delete bucket document
  const bucketRef = doc(db, 'users', uid, 'budgets', budgetId);
  batch.delete(bucketRef);
  
  // Decrement bucket counter
  const counterRef = doc(db, 'users', uid, 'meta', 'bucketCounts');
  batch.set(counterRef, {
    total: increment(-1),
    updatedAt: serverTimestamp()
  }, { merge: true });
  
  await batch.commit();
}

/**
 * Initialize user bootstrap documents
 * @param {string} uid - User ID
 * @param {string} email - User email
 */
export async function bootstrapUser(uid, email) {
  const db = getDB();
  const batch = writeBatch(db);
  
  // Create user profile document (only if it doesn't exist)
  const userRef = doc(db, 'users', uid);
  
  // Check if user document already exists to avoid overwriting subscription data
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    // Only create initial document for truly new users
    batch.set(userRef, {
      email,
      createdAt: serverTimestamp(),
      plan: 'Free',
      planSelected: false
    });
    console.log(`👤 Creating new user profile for ${uid}`);
  } else {
    // User exists, just update email if needed (preserve plan data)
    const existingData = userDoc.data();
    if (existingData.email !== email) {
      batch.set(userRef, {
        email,
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log(`📧 Updated email for existing user ${uid}`);
    } else {
      console.log(`✅ User profile exists for ${uid}, preserving subscription data`);
    }
  }
  
  // Initialize bucket counter
  const counterRef = doc(db, 'users', uid, 'meta', 'bucketCounts');
  batch.set(counterRef, {
    total: 0,
    createdAt: serverTimestamp()
  }, { merge: true });
  
  await batch.commit();
}

/**
 * Get current bucket count
 * @param {string} uid - User ID
 * @returns {number} Current bucket count
 */
export async function getBucketCount(uid) {
  const db = getDB();
  const counterRef = doc(db, 'users', uid, 'meta', 'bucketCounts');
  const counterDoc = await getDoc(counterRef);
  
  if (counterDoc.exists()) {
    return counterDoc.data().total || 0;
  }
  
  return 0;
}