/**
 * Express server for Budget Buckets - Firebase App Hosting
 * Serves static files and handles SPA routing
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const fs = require('fs');

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
  res.sendFile(path.join(__dirname, 'home.html'));
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