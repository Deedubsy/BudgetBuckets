/**
 * Express server for Budget Buckets - Firebase App Hosting
 * Serves static files and handles SPA routing
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();

// Get port from environment or default to 8080
const PORT = process.env.PORT || 8080;

// Security headers with CSP for Firebase
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://www.gstatic.com",
        "https://www.googletagmanager.com",
        "https://apis.google.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://*.googleapis.com",
        "https://*.firebaseapp.com",
        "https://*.firebaseio.com",
        "wss://*.firebaseio.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://firestore.googleapis.com",
        "http://localhost:*",
        "ws://localhost:*"
      ],
      frameSrc: ["'self'", "https://accounts.google.com", "https://*.firebaseapp.com"]
    }
  }
}));

// Enable gzip compression
app.use(compression());

// Serve static files from root directory with proper MIME types
app.use(express.static(path.join(__dirname), {
  maxAge: '1h',
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

// Root path - serve index.html which redirects to login
app.get('/', (req, res) => {
  // Check if index.html exists, otherwise serve login directly
  const indexPath = path.join(__dirname, 'index.html');
  const loginPath = path.join(__dirname, 'auth', 'login.html');
  
  // Prefer index.html for cleaner redirect
  res.sendFile(indexPath, (err) => {
    if (err) {
      // Fallback to direct login page
      res.sendFile(loginPath);
    }
  });
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
  
  // For paths without extensions, serve the login page
  res.sendFile(path.join(__dirname, 'auth', 'login.html'));
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