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

// Load .env file for local development
if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env')) {
  require('dotenv').config();
}

// Initialize Stripe
console.log('🔧 Environment check:');
console.log('  STRIPE_SECRET_KEY:', (process.env.STRIPE_SECRET_KEY || process.env['stripe-secret-key']) ? 'SET' : 'MISSING');
console.log('  STRIPE_WEBHOOK_SECRET:', (process.env.STRIPE_WEBHOOK_SECRET || process.env['stripe-webhook-secret']) ? 'SET' : 'MISSING');
console.log('  STRIPE_PUBLISH_KEY:', (process.env.STRIPE_PUBLISH_KEY || process.env['stripe-publish-key']) ? 'SET' : 'MISSING');
console.log('  PRICE_ID_MONTHLY:', process.env.PRICE_ID_MONTHLY ? 'SET' : 'MISSING');

// Get Stripe configuration from either naming convention
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env['stripe-secret-key'];
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env['stripe-webhook-secret'];
const stripePublishKey = process.env.STRIPE_PUBLISH_KEY || process.env['stripe-publish-key'];

// Validate Stripe configuration
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY is required. Please check your environment configuration.');
  console.log('💡 For local development, copy .env.example to .env and add your test keys');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
console.log('✅ Stripe', stripe ? 'initialized' : 'NOT INITIALIZED (missing secret key)');

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

// EJS template engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static assets with long cache
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '1y' }));

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
  console.log('💳 Checkout request received');
  console.log('  Body:', req.body);
  console.log('  Headers:', { auth: !!req.headers.authorization, contentType: req.headers['content-type'] });
  
  // Check if Stripe is configured
  if (!stripe) {
    console.log('❌ Stripe not configured');
    return res.status(503).json({ error: 'Billing service not configured' });
  }
  
  try {
    // Verify Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid auth header');
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
  console.log('🏛️ Portal request received');
  console.log('  Headers:', { auth: !!req.headers.authorization, origin: req.headers.origin });
  
  // Check if Stripe is configured
  if (!stripe) {
    console.log('❌ Stripe not configured');
    return res.status(503).json({ error: 'Billing service not configured' });
  }
  
  try {
    // Verify Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid auth header');
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
  const webhookSecret = stripeWebhookSecret;

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
  console.log('⚙️ Config request received');
  
  if (!process.env.PRICE_ID_MONTHLY) {
    console.log('❌ PRICE_ID_MONTHLY not configured');
    return res.status(503).json({ error: 'Billing configuration not available' });
  }
  
  res.json({
    priceId: process.env.PRICE_ID_MONTHLY
  });
});

// Get Stripe publishable key for client-side integration
app.get('/api/billing/stripe-key', (req, res) => {
  console.log('🔑 Stripe key request received');
  
  if (!stripePublishKey) {
    console.log('❌ STRIPE_PUBLISH_KEY not configured');
    return res.status(503).json({ error: 'Stripe publishable key not available' });
  }
  
  res.json({
    publishableKey: stripePublishKey
  });
});

// Create Setup Intent for subscription payment method
app.post('/api/billing/setup-intent', async (req, res) => {
  console.log('🎯 Setup Intent request received');
  
  // Check if Stripe is configured
  if (!stripe) {
    console.log('❌ Stripe not configured');
    return res.status(503).json({ error: 'Billing service not configured' });
  }
  
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
    
    const { email, priceId } = req.body;
    
    if (!email || !priceId) {
      return res.status(400).json({ error: 'Missing required fields: email, priceId' });
    }
    
    // Create or retrieve Stripe customer
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    });
    
    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
      // Update metadata if needed
      if (customer.metadata.firebase_uid !== uid) {
        customer = await stripe.customers.update(customer.id, {
          metadata: { firebase_uid: uid }
        });
      }
    } else {
      customer = await stripe.customers.create({
        email: email,
        metadata: { firebase_uid: uid }
      });
    }
    
    // Create Setup Intent for future payments
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: {
        firebase_uid: uid,
        price_id: priceId
      }
    });
    
    // Store customer ID in Firestore for reference
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      stripeCustomerId: customer.id,
      email: email
    }, { merge: true });
    
    res.json({ 
      clientSecret: setupIntent.client_secret,
      customerId: customer.id
    });
    
  } catch (error) {
    console.error('Setup Intent error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create subscription after payment method setup
app.post('/api/billing/create-subscription', async (req, res) => {
  console.log('💳 Create subscription request received');
  
  // Check if Stripe is configured
  if (!stripe) {
    console.log('❌ Stripe not configured');
    return res.status(503).json({ error: 'Billing service not configured' });
  }
  
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
    
    const { customerId, paymentMethodId, priceId } = req.body;
    
    if (!customerId || !paymentMethodId || !priceId) {
      return res.status(400).json({ error: 'Missing required fields: customerId, paymentMethodId, priceId' });
    }
    
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
    
    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        firebase_uid: uid
      }
    });
    
    res.json(subscription);
    
  } catch (error) {
    console.error('Create subscription error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// EJS-rendered public pages
app.get(['/', '/home'], (req, res) =>
  res.render('pages/home', { 
    active: 'home', 
    pageCss: 'home.css', 
    pageScript: null, // Home page uses only JSON-LD, no interactive JS
    year: new Date().getFullYear() 
  })
);

app.get(['/pricing', '/pricing/'], (req, res) =>
  res.render('pages/pricing', { 
    active: 'pricing', 
    pageCss: 'pricing.css', 
    pageScript: 'pricing.js', // Smooth scrolling functionality
    year: new Date().getFullYear() 
  })
);

app.get(['/guide/budget-buckets-method', '/guide', '/method'], (req, res) =>
  res.render('pages/guide-budget-method', { 
    active: 'guide', 
    pageCss: 'guide.css', 
    pageScript: null, // No interactive JS needed after EJS substitution
    year: new Date().getFullYear(),
    lastUpdated: 'August 2025'
  })
);

app.get(['/calculators', '/calculator'], (req, res) =>
  res.render('pages/calculators', { 
    active: 'calculators', 
    pageCss: 'calculators.css', 
    pageScript: 'calculators.js', // Complex calculator functionality
    year: new Date().getFullYear() 
  })
);

app.get(['/privacy'], (req, res) =>
  res.render('pages/privacy', { 
    active: null, 
    pageCss: 'privacy.css', 
    pageScript: null, // No interactive JS needed
    year: new Date().getFullYear() 
  })
);

app.get(['/terms'], (req, res) =>
  res.render('pages/terms', { 
    active: null, 
    pageCss: 'terms.css', 
    pageScript: null, // No interactive JS needed
    year: new Date().getFullYear() 
  })
);

app.get(['/support', '/contact'], (req, res) =>
  res.render('pages/support', { 
    active: null, 
    pageCss: 'support.css', 
    pageScript: null, // No interactive JS needed
    year: new Date().getFullYear() 
  })
);

// Redirects for old .html URLs
app.get('/home.html', (req, res) => res.redirect(301, '/'));
app.get('/calculators.html', (req, res) => res.redirect(301, '/calculators'));
app.get('/Method.html', (req, res) => res.redirect(301, '/guide/budget-buckets-method'));
app.get('/pricing.html', (req, res) => res.redirect(301, '/pricing'));
app.get('/privacy.html', (req, res) => res.redirect(301, '/privacy'));
app.get('/terms.html', (req, res) => res.redirect(301, '/terms'));
app.get('/support.html', (req, res) => res.redirect(301, '/support'));

// Auth and App routes (keep existing functionality)
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
  res.redirect(301, '/test/smoke-test.html');
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

// Legacy redirects (routes now handled by EJS above)

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
  res.sendFile(path.join(__dirname, '_archive', 'environment-switcher.html'));
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
    // For /test/* routes, let static middleware handle test files first
    next();
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