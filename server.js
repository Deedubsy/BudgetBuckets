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

// Serve static files from root directory
app.use(express.static(path.join(__dirname), {
  maxAge: '1h',
  setHeaders: (res, filepath) => {
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

// Route handlers for SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'login.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

app.get('/app/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

app.get('/auth/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'login.html'));
});

app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

app.get('/test/*', (req, res) => {
  const testFile = req.params[0];
  const validTestFiles = ['smoke-test.html', 'network-diagnostic.html'];
  
  if (validTestFiles.includes(testFile)) {
    res.sendFile(path.join(__dirname, 'test', testFile));
  } else {
    res.sendFile(path.join(__dirname, 'test', 'smoke-test.html'));
  }
});

app.get('/environment', (req, res) => {
  res.sendFile(path.join(__dirname, 'environment-switcher.html'));
});

// 404 handler - redirect to login
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'auth', 'login.html'));
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