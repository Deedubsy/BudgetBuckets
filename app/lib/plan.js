import { getAuth, onIdTokenChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

let currentPlan = 'free';
let planWatchers = [];
let isWatching = false;

/**
 * Start watching plan changes via ID token changes
 * @param {Function} onChange - Callback when plan changes
 */
export function watchPlan(onChange) {
  planWatchers.push(onChange);
  
  if (!isWatching) {
    isWatching = true;
    const auth = getAuth();
    
    onIdTokenChanged(auth, async (user) => {
      if (user) {
        await refreshPlan(user);
      } else {
        currentPlan = 'free';
        notifyWatchers();
      }
    });
    
    // Handle URL params for billing returns
    handleBillingReturn();
    
    // Refresh on tab focus (for Portal returns)
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && auth.currentUser) {
        await refreshPlan(auth.currentUser);
      }
    });
  }
}

/**
 * Get current plan
 * @returns {string} 'free' or 'plus'
 */
export function getPlan() {
  return currentPlan;
}

/**
 * Check if user has Plus plan
 * @returns {boolean}
 */
export function isPlus() {
  return currentPlan === 'plus';
}

/**
 * Manually refresh plan from server
 */
export async function refreshPlan(user = null) {
  const auth = getAuth();
  const currentUser = user || auth.currentUser;
  
  if (!currentUser) {
    currentPlan = 'free';
    notifyWatchers();
    return;
  }
  
  try {
    // First try ID token claims
    const tokenResult = await currentUser.getIdTokenResult(true); // Force refresh
    let newPlan = tokenResult.claims.plan;
    
    // If no claims or claims show free, check Firestore as fallback
    if (!newPlan || newPlan === 'free') {
      try {
        const { doc, getDoc, getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');
        const db = getFirestore();
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          // Check plan status
          if (userData.plan === 'Plus') {
            newPlan = 'plus';
          } else {
            newPlan = 'free';
          }
          console.log('📋 Plan loaded from Firestore:', newPlan, 'plan:', userData.plan);
        } else {
          newPlan = 'free';
        }
      } catch (firestoreError) {
        console.warn('Failed to load plan from Firestore:', firestoreError);
        newPlan = 'free';
      }
    } else {
      console.log('📋 Plan loaded from ID token claims:', newPlan);
    }
    
    if (newPlan !== currentPlan) {
      currentPlan = newPlan;
      console.log('📋 Plan updated:', currentPlan);
      notifyWatchers();
    }
  } catch (error) {
    console.error('Failed to refresh plan:', error);
    // Fallback to free plan
    if (currentPlan !== 'free') {
      currentPlan = 'free';
      notifyWatchers();
    }
  }
}

function notifyWatchers() {
  planWatchers.forEach(watcher => watcher(currentPlan));
}

function handleBillingReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.has('upgraded') || urlParams.has('billing')) {
    // Force token refresh on billing return
    setTimeout(async () => {
      const auth = getAuth();
      if (auth.currentUser) {
        await refreshPlan(auth.currentUser);
      }
    }, 500);
    
    // Clean URL params
    const url = new URL(window.location);
    url.searchParams.delete('upgraded');
    url.searchParams.delete('billing');
    window.history.replaceState({}, '', url.toString());
  }
}