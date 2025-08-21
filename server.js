/**
 * Express server for Budget Buckets - Firebase App Hosting
 * Serves static files and handles SPA routing
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const fs = require('fs');
const Stripe = require('stripe');
const admin = require('firebase-admin');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    // Firebase will use default credentials in the App Hosting environment
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  });
}

const app = express();
const ROOT = __dirname;

// Get port from environment or default to 8080
const PORT = process.env.PORT || 8080;

// Security headers with CSP for Firebase
app.use(helmet({
  // Strong HSTS (".app" is HSTS by default, but keep this for any proxies)
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  // Basic hardening
  xssFilter: true,
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // CSP aligned with Firebase SDK + your libs
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // Firebase / Google
        "https://www.gstatic.com",
        "https://apis.google.com",
        "https://www.googleapis.com",
        // (optional) GTM/GA — only keep if you actually use them
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        // (optional) tinycolor2 via jsDelivr; remove if you self-host it
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://firestore.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.googleapis.com",
        // dev tools / local testing
        "http://localhost:*", "ws://localhost:*"
      ],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

// Enable gzip compression
app.use(compression());

// Body parser for JSON (except webhook endpoint)
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Serve static files from root directory with proper MIME types
// Exclude index.html from being served automatically to allow our custom routing
app.use(express.static(path.join(__dirname), {
  maxAge: '1h',
  index: false, // Disable automatic index.html serving
  setHeaders: (res, filepath) => {
    // Set proper MIME types explicitly
    if (filepath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filepath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filepath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filepath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    
    // Set longer cache for assets
    if (filepath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
    
    // Set CORS headers for Firebase resources
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}));

// Health check endpoint for Firebase App Hosting
app.get('/__/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'budget-buckets' });
});

// Billing API endpoints
app.post('/api/billing/checkout', async (req, res) => {
  try {
    // Verify Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid: tokenUid, email: tokenEmail } = decodedToken;
    
    const { uid, email, priceId } = req.body;
    
    // Verify the token matches the request
    if (uid !== tokenUid || email !== tokenEmail) {
      return res.status(403).json({ error: 'Token mismatch' });
    }
    
    if (!uid || !email || !priceId) {
      return res.status(400).json({ error: 'Missing required fields: uid, email, priceId' });
    }

    // Create or retrieve Stripe customer
    let customer;
    try {
      // Try to find existing customer by email
      const customers = await stripe.customers.list({ email, limit: 1 });
      
      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email,
          metadata: {
            firebase_uid: uid
          }
        });
      }
    } catch (stripeError) {
      console.error('Stripe customer error:', stripeError);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${req.headers.origin}/app?upgrade=success`,
      cancel_url: `${req.headers.origin}/app?upgrade=cancelled`,
      metadata: {
        firebase_uid: uid
      },
      subscription_data: {
        metadata: {
          firebase_uid: uid
        }
      }
    });

    // Store customer ID in Firestore for future reference
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      stripeCustomerId: customer.id,
      email: email
    }, { merge: true });

    res.json({ url: session.url });
    
  } catch (error) {
    console.error('Checkout error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/billing/portal', async (req, res) => {
  try {
    // Verify Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid } = decodedToken;
    
    // Get user's Stripe customer ID from Firestore
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeCustomerId;
    
    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found. Please upgrade first.' });
    }

    // Create Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${req.headers.origin}/app`,
    });

    res.json({ url: session.url });
    
  } catch (error) {
    console.error('Portal error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stripe webhook endpoint
app.post('/api/billing/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    const db = admin.firestore();
    
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;
        const firebaseUid = subscription.metadata?.firebase_uid;

        if (firebaseUid) {
          await db.collection('users').doc(firebaseUid).set({
            subscriptionId: subscription.id,
            subscriptionStatus: status,
            stripeCustomerId: customerId,
            planType: status === 'active' ? 'plus' : 'free',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // Set custom claims for plan access
          if (status === 'active') {
            await admin.auth().setCustomUserClaims(firebaseUid, { plan: 'plus' });
          } else {
            await admin.auth().setCustomUserClaims(firebaseUid, { plan: 'free' });
          }

          console.log(`Updated user ${firebaseUid} subscription to ${status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const firebaseUid = subscription.metadata?.firebase_uid;

        if (firebaseUid) {
          await db.collection('users').doc(firebaseUid).set({
            subscriptionStatus: 'canceled',
            planType: 'free',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // Remove plus plan from custom claims
          await admin.auth().setCustomUserClaims(firebaseUid, { plan: 'free' });

          console.log(`Canceled subscription for user ${firebaseUid}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        
        if (subscriptionId) {
          // Get subscription to find the Firebase UID
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const firebaseUid = subscription.metadata?.firebase_uid;

          if (firebaseUid) {
            await db.collection('users').doc(firebaseUid).set({
              lastPaymentStatus: 'succeeded',
              lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`Payment succeeded for user ${firebaseUid}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        
        if (subscriptionId) {
          // Get subscription to find the Firebase UID
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const firebaseUid = subscription.metadata?.firebase_uid;

          if (firebaseUid) {
            await db.collection('users').doc(firebaseUid).set({
              lastPaymentStatus: 'failed',
              lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`Payment failed for user ${firebaseUid}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get billing configuration
app.get('/api/billing/config', (req, res) => {
  res.json({
    priceId: process.env.PRICE_ID_MONTHLY
  });
});

// Root path - serve home.html as the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'login.html'));
});

app.get('/auth/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'login.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/home.html', (req, res) => {
  res.redirect(301, '/');
});

app.get('/calculators', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators.html'));
});

app.get('/calculators.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators.html'));
});

app.get('/method', (req, res) => {
  res.sendFile(path.join(__dirname, 'Method.html'));
});

app.get('/Method.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'Method.html'));
});

app.get('/guide', (req, res) => {
  res.sendFile(path.join(__dirname, 'Method.html'));
});

// SEO redirects for Google-expected URLs
app.get('/guide/budget-buckets-method', (req, res) => {
  res.redirect(301, '/method');
});

app.get('/contact', (req, res) => {
  res.redirect(301, '/support');
});

app.get('/blog', (req, res) => {
  res.redirect(301, '/');
});

app.get('/blog/', (req, res) => {
  res.redirect(301, '/');
});

// Pricing page
app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, 'pricing.html'));
});

app.get('/pricing.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pricing.html'));
});

// Legal pages
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.html'));
});

app.get('/privacy.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'terms.html'));
});

app.get('/terms.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'terms.html'));
});

app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'support.html'));
});

app.get('/support.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'support.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'support.html'));
});

// SEO files
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/environment', (req, res) => {
  res.sendFile(path.join(__dirname, 'environment-switcher.html'));
});

// Specific test file routes
app.get('/test/smoke-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test', 'smoke-test.html'));
});

app.get('/test/network-diagnostic.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test', 'network-diagnostic.html'));
});

app.get('/test/debug-firestore.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test', 'debug-firestore.html'));
});

// SPA fallback routes - only if no static file was found
app.get('/app/*', (req, res, next) => {
  // Only serve the HTML if this isn't a request for a static file
  if (!path.extname(req.path) || req.path.endsWith('.html')) {
    res.sendFile(path.join(__dirname, 'app', 'index.html'));
  } else {
    next(); // Let the static middleware or 404 handler deal with it
  }
});

app.get('/auth/*', (req, res, next) => {
  // Only serve the HTML if this isn't a request for a static file
  if (!path.extname(req.path) || req.path.endsWith('.html')) {
    res.sendFile(path.join(__dirname, 'auth', 'login.html'));
  } else {
    next(); // Let the static middleware or 404 handler deal with it
  }
});

app.get('/test/*', (req, res, next) => {
  // Only serve the HTML if this isn't a request for a static file
  if (!path.extname(req.path) || req.path.endsWith('.html')) {
    res.sendFile(path.join(__dirname, 'test.html'));
  } else {
    next(); // Let the static middleware or 404 handler deal with it
  }
});

// Final fallback for other paths (but not files with extensions)
app.get('*', (req, res, next) => {
  // If it's a file request that wasn't found, return proper 404
  if (path.extname(req.path)) {
    return res.status(404).send('File not found');
  }
  
  // For unknown paths without extensions, return 404 with helpful message
  res.status(404).send(`
    <html>
      <head><title>Page Not Found - Budget Buckets</title></head>
      <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <p><a href="/">Go to Home</a> | <a href="/auth/login">Login</a></p>
      </body>
    </html>
  `);
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Budget Buckets server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
});