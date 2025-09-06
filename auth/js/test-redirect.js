// Test redirect functionality
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';

const app = initializeApp({
    apiKey: "AIzaSyAyQnI3I5IRm2MZ16ttVaaA-8bneE3lWeo",
    authDomain: "budgetbuckets-79b3b.firebaseapp.com", 
    projectId: "budgetbuckets-79b3b"
});
const auth = getAuth(app);

// Check for redirect result on page load
getRedirectResult(auth).then((result) => {
    if (result) {
        document.getElementById('status').innerHTML = `
            <h2>✅ SUCCESS!</h2>
            <p>Email: ${result.user.email}</p>
            <p>UID: ${result.user.uid}</p>
            <p>Name: ${result.user.displayName}</p>
        `;
    } else {
        document.getElementById('status').innerHTML = '<p>No redirect result found.</p>';
    }
}).catch((error) => {
    document.getElementById('status').innerHTML = `<p>❌ Error: ${error.message}</p>`;
});

// Handle redirect button click
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('redirectBtn').addEventListener('click', async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            await signInWithRedirect(auth, provider);
            // Page will redirect - this line won't execute
        } catch (error) {
            document.getElementById('status').innerHTML = `<p>❌ Error: ${error.message}</p>`;
        }
    });
});