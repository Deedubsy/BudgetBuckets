/**
 * Express server for Budget Buckets - Development Version
 * Serves static files without Stripe/Firebase secrets dependency
 */

const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const ROOT = __dirname;

// Get port from environment or default to 8080
const PORT = process.env.PORT || 8080;

console.log('🔧 Running in DEVELOPMENT mode (no Stripe/Firebase secrets required)');

// Enable gzip compression
app.use(compression());

// Body parser for JSON
app.use(express.json());

// Serve static files from root directory with proper MIME types
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
    
    // Set CORS headers for Firebase resources
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}));

// Health check endpoint
app.get('/__/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'budget-buckets-dev' });
});

// Mock billing API endpoints for development
app.post('/api/billing/checkout', (req, res) => {
  console.log('🔧 DEV: Mock billing checkout requested');
  res.status(503).json({ error: 'Billing not available in development mode' });
});

app.post('/api/billing/portal', (req, res) => {
  console.log('🔧 DEV: Mock billing portal requested');
  res.status(503).json({ error: 'Billing not available in development mode' });
});

app.post('/api/billing/webhook', (req, res) => {
  console.log('🔧 DEV: Mock webhook called');
  res.json({ received: true });
});

app.get('/api/billing/config', (req, res) => {
  res.json({
    priceId: 'price_dev_monthly_placeholder'
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
  if (!path.extname(req.path) || req.path.endsWith('.html')) {
    res.sendFile(path.join(__dirname, 'app', 'index.html'));
  } else {
    next();
  }
});

app.get('/auth/*', (req, res, next) => {
  if (!path.extname(req.path) || req.path.endsWith('.html')) {
    res.sendFile(path.join(__dirname, 'auth', 'login.html'));
  } else {
    next();
  }
});

app.get('/test/*', (req, res, next) => {
  if (!path.extname(req.path) || req.path.endsWith('.html')) {
    res.sendFile(path.join(__dirname, 'test.html'));
  } else {
    next();
  }
});

// Final fallback for other paths (but not files with extensions)
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) {
    return res.status(404).send('File not found');
  }
  
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
    message: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Budget Buckets DEV server running on port ${PORT}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
  console.log('💡 Note: Billing features are disabled in development mode');
});