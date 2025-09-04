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
    const tokenResult = await currentUser.getIdTokenResult(true); // Force refresh
    const newPlan = tokenResult.claims.plan || 'free';
    
    if (newPlan !== currentPlan) {
      currentPlan = newPlan;
      notifyWatchers();
    }
  } catch (error) {
    console.error('Failed to refresh plan:', error);
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